import math
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import case
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PhanXuong
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.production_plan import ProductionPlan, ProductionPlanLine
from app.models.bom import ProductionBOM
from app.models.sales import SalesOrder, SalesOrderItem, QuoteItem
from app.schemas.production_plan import (
    ProductionPlanCreate, ProductionPlanUpdate,
    ProductionPlanResponse, ProductionPlanListItem,
    ProductionPlanLineCreate, ProductionPlanLineUpdate, ProductionPlanLineResponse,
    AvailableItemResponse, PagedPlanResponse,
    PushToQueueRequest, QueueLineResponse,
)
from app.services.price_calculator import calculate_dien_tich

router = APIRouter(prefix="/api/production-plans", tags=["production-plans"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _generate_so_ke_hoach(db: Session) -> str:
    today = date.today()
    prefix = f"KH{today.strftime('%Y%m%d')}"
    last = (
        db.query(ProductionPlan)
        .filter(ProductionPlan.so_ke_hoach.like(f"{prefix}%"))
        .order_by(ProductionPlan.so_ke_hoach.desc())
        .first()
    )
    seq = (int(last.so_ke_hoach[-3:]) + 1) if last else 1
    return f"{prefix}{seq:03d}"


QUEUE_POOL_SO = "KHSX-POOL"


def _get_or_create_pool_plan(db: Session) -> "ProductionPlan":
    plan = db.query(ProductionPlan).filter(ProductionPlan.so_ke_hoach == QUEUE_POOL_SO).first()
    if not plan:
        plan = ProductionPlan(
            so_ke_hoach=QUEUE_POOL_SO,
            ngay_ke_hoach=date.today(),
            ghi_chu="Hàng chờ — LSX gỡ khỏi kế hoạch",
            trang_thai="nhap",
        )
        db.add(plan)
        db.flush()
    return plan


def _calc_kho_tt(kho1: Decimal | None, so_dao: int | None) -> Decimal | None:
    if kho1 is not None and so_dao is not None:
        return Decimal(str(round(float(kho1) * so_dao + 1.8, 2)))
    return None


def _get_kho1_from_bom(bom: ProductionBOM | None) -> Decimal | None:
    """Tính kho1 (khổ 1 sản phẩm) từ dữ liệu BOM."""
    if not bom:
        return None
    try:
        dims = calculate_dien_tich(
            bom.loai_thung,
            float(bom.dai),
            float(bom.rong),
            float(bom.cao),
            int(bom.so_lop),
        )
        return Decimal(str(round(dims["kho1"], 2)))
    except Exception:
        return None


def _build_cong_doan(
    item: ProductionOrderItem | None,
    bom: "ProductionBOM | None",
    qi: "QuoteItem | None" = None,
) -> str | None:
    parts: list[str] = []

    # Loại in + số màu: POI → QuoteItem fallback
    loai_in = (item.loai_in if item else None) or (qi.loai_in if qi else None)
    so_mau = (item.so_mau if item else None) or (qi.so_mau if qi else None)
    if loai_in and loai_in != "khong_in":
        label = "Flexo" if loai_in == "flexo" else "Kỹ thuật số"
        if so_mau and so_mau > 0:
            label += f" {so_mau} màu"
        parts.append(label)

    # Công đoạn phụ — QuoteItem có đầy đủ nhất, fallback BOM
    if qi:
        if qi.do_kho:
            parts.append("Độ khó")
        if qi.ghim:
            parts.append("Ghim")
        if qi.chap_xa:
            parts.append("Chạp Xã")
        if qi.do_phu:
            parts.append("Độ phủ")
        if qi.dan:
            parts.append("Dán")
        if qi.boi:
            parts.append("Bồi")
        if qi.be_lo:
            parts.append("Bế Lỗ")
    elif bom:
        if getattr(bom, "ghim", False):
            parts.append("Ghim")
        if getattr(bom, "chap_xa", False):
            parts.append("Chạp Xã")
        if getattr(bom, "dan", False):
            parts.append("Dán")
        if getattr(bom, "boi", False):
            parts.append("Bồi")
        if getattr(bom, "be_so_con", 0):
            parts.append("Bế Lỗ")

    return " | ".join(parts) if parts else None


def _build_line_response(line: ProductionPlanLine) -> ProductionPlanLineResponse:
    item = line.production_order_item
    order = item.production_order if item else None
    customer = None
    if order and order.sales_order and order.sales_order.customer:
        customer = order.sales_order.customer

    # Lấy thông tin BOM để hiển thị loai_thung, kích thước
    bom: ProductionBOM | None = getattr(item, "_bom_cache", None)

    # SOI + QuoteItem (đã joinedload) — dùng làm fallback cho field chưa lưu vào POI
    soi: SalesOrderItem | None = getattr(item, "sales_order_item", None) if item else None
    qi: QuoteItem | None = soi.quote_item if soi else None

    def _bom_mat_str(val: int | None) -> str | None:
        return f"{val} mặt" if val else None

    def _f(field: str, bom_val=None):
        """Fallback: POI → QuoteItem → BOM value."""
        return ((getattr(item, field, None) if item else None)
                or (getattr(qi, field, None) if qi else None)
                or bom_val)

    # Fallback: POI → QuoteItem → BOM
    ghi_chu_val = (line.ghi_chu
                   or (item.ghi_chu if item else None)
                   or (soi.ghi_chu_san_pham if soi else None)
                   or (qi.ghi_chu if qi else None))
    c_tham = _f("c_tham", _bom_mat_str(bom.chong_tham if bom else None))
    can_man = _f("can_man", _bom_mat_str(bom.can_mang if bom else None))

    return ProductionPlanLineResponse(
        id=line.id,
        plan_id=line.plan_id,
        production_order_item_id=line.production_order_item_id,
        thu_tu=line.thu_tu,
        ngay_chay=line.ngay_chay,
        kho1=line.kho1,
        kho_giay=line.kho_giay,
        so_dao=line.so_dao,
        kho_tt=line.kho_tt,
        so_luong_ke_hoach=line.so_luong_ke_hoach,
        so_luong_hoan_thanh=line.so_luong_hoan_thanh,
        trang_thai=line.trang_thai,
        mua_phoi_ngoai=getattr(line, "mua_phoi_ngoai", False),
        ghi_chu=ghi_chu_val,
        cong_doan=_build_cong_doan(item, bom, qi),
        # Joined fields
        so_lenh=order.so_lenh if order else None,
        ma_kh=customer.ma_kh if customer else None,
        ten_khach_hang=customer.ten_viet_tat if customer else None,
        ten_hang=item.ten_hang if item else None,
        ngay_giao_hang=item.ngay_giao_hang if item else None,
        loai_thung=bom.loai_thung if bom else (item.loai_thung if item else None),
        dai=bom.dai if bom else (item.dai if item else None),
        rong=bom.rong if bom else (item.rong if item else None),
        cao=bom.cao if bom else (item.cao if item else None),
        so_lop=bom.so_lop if bom else (item.so_lop if item else None),
        to_hop_song=bom.to_hop_song if bom else (item.to_hop_song if item else None),
        # Thông số kỹ thuật từ item
        dai_tt=item.dai_tt if item else None,
        so_lan_cat=item.so_lan_cat if item else None,
        be_so_con=item.be_so_con if item else None,
        loai_lan=item.loai_lan if item else None,
        mat=item.mat if item else None, mat_dl=item.mat_dl if item else None,
        song_1=item.song_1 if item else None, song_1_dl=item.song_1_dl if item else None,
        mat_1=item.mat_1 if item else None, mat_1_dl=item.mat_1_dl if item else None,
        song_2=item.song_2 if item else None, song_2_dl=item.song_2_dl if item else None,
        mat_2=item.mat_2 if item else None, mat_2_dl=item.mat_2_dl if item else None,
        song_3=item.song_3 if item else None, song_3_dl=item.song_3_dl if item else None,
        mat_3=item.mat_3 if item else None, mat_3_dl=item.mat_3_dl if item else None,
        loai_in=_f("loai_in"),
        so_mau=_f("so_mau"),
        c_tham=c_tham,
        can_man=can_man,
        qccl=item.qccl if item else None,
    )


def _load_plan(plan_id: int, db: Session) -> ProductionPlan:
    plan = (
        db.query(ProductionPlan)
        .options(
            joinedload(ProductionPlan.creator),
            joinedload(ProductionPlan.lines)
            .joinedload(ProductionPlanLine.production_order_item)
            .joinedload(ProductionOrderItem.production_order)
            .joinedload(ProductionOrder.sales_order)
            .joinedload(SalesOrder.customer),
            joinedload(ProductionPlan.lines)
            .joinedload(ProductionPlanLine.production_order_item)
            .joinedload(ProductionOrderItem.sales_order_item)
            .joinedload(SalesOrderItem.quote_item),
        )
        .filter(ProductionPlan.id == plan_id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch sản xuất")

    # Gắn BOM vào từng item để build response
    item_ids = [ln.production_order_item_id for ln in plan.lines]
    boms = (
        db.query(ProductionBOM)
        .filter(ProductionBOM.production_order_item_id.in_(item_ids))
        .all()
    ) if item_ids else []
    bom_by_item = {b.production_order_item_id: b for b in boms}
    for ln in plan.lines:
        ln.production_order_item._bom_cache = bom_by_item.get(ln.production_order_item_id)

    return plan


def _build_plan_response(plan: ProductionPlan) -> ProductionPlanResponse:
    creator = getattr(plan, "creator", None)
    return ProductionPlanResponse(
        id=plan.id,
        so_ke_hoach=plan.so_ke_hoach,
        ngay_ke_hoach=plan.ngay_ke_hoach,
        ghi_chu=plan.ghi_chu,
        trang_thai=plan.trang_thai,
        lines=[_build_line_response(ln) for ln in plan.lines],
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        created_by_name=creator.ho_ten if creator else None,
        noi_sx=creator.phan_xuong if creator else None,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/available-items", response_model=list[AvailableItemResponse])
def get_available_items(
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    search: str = Query(default=""),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lấy danh sách dòng LSX chưa hoặc chưa đủ lên kế hoạch."""
    q = (
        db.query(ProductionOrderItem)
        .join(ProductionOrder)
        .join(SalesOrder, ProductionOrder.sales_order_id == SalesOrder.id, isouter=True)
        .options(
            joinedload(ProductionOrderItem.production_order)
            .joinedload(ProductionOrder.sales_order)
            .joinedload(SalesOrder.customer),
        )
        .filter(
            ProductionOrder.trang_thai.in_(["moi", "dang_chay"]),
            ProductionOrder.tan_dung == False,  # noqa: E712
        )
    )

    if tu_ngay:
        q = q.filter(ProductionOrder.ngay_lenh >= tu_ngay)
    if den_ngay:
        q = q.filter(ProductionOrder.ngay_lenh <= den_ngay)
    if customer_id:
        q = q.filter(SalesOrder.customer_id == customer_id)
    if search:
        like = f"%{search}%"
        q = q.filter(
            ProductionOrder.so_lenh.ilike(like)
            | ProductionOrderItem.ten_hang.ilike(like)
        )

    items = q.order_by(ProductionOrder.ngay_lenh.desc()).limit(200).all()

    # Lấy BOM cho tất cả items
    item_ids = [i.id for i in items]
    boms = (
        db.query(ProductionBOM)
        .filter(ProductionBOM.production_order_item_id.in_(item_ids))
        .all()
    ) if item_ids else []
    bom_by_item = {b.production_order_item_id: b for b in boms}

    result: list[AvailableItemResponse] = []
    for item in items:
        order = item.production_order
        so = order.sales_order if order else None
        customer = so.customer if so else None
        bom = bom_by_item.get(item.id)
        kho1 = _get_kho1_from_bom(bom)

        result.append(AvailableItemResponse(
            production_order_item_id=item.id,
            so_lenh=order.so_lenh if order else "",
            ma_kh=customer.ma_kh if customer else None,
            ten_khach_hang=customer.ten_viet_tat if customer else None,
            ten_hang=item.ten_hang,
            so_luong_ke_hoach=item.so_luong_ke_hoach,
            ngay_giao_hang=item.ngay_giao_hang,
            loai_thung=bom.loai_thung if bom else None,
            dai=bom.dai if bom else None,
            rong=bom.rong if bom else None,
            cao=bom.cao if bom else None,
            so_lop=int(bom.so_lop) if bom else None,
            to_hop_song=bom.to_hop_song if bom else None,
            kho1_tinh_toan=kho1,
        ))

    return result


@router.get("", response_model=PagedPlanResponse)
def list_plans(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    exclude_nhap: bool = Query(default=False),
    noi_sx: str | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ProductionPlan).options(joinedload(ProductionPlan.creator))
    q = q.filter(ProductionPlan.so_ke_hoach != QUEUE_POOL_SO)

    if search:
        q = q.filter(ProductionPlan.so_ke_hoach.ilike(f"%{search}%"))
    if trang_thai:
        q = q.filter(ProductionPlan.trang_thai == trang_thai)
    elif exclude_nhap:
        q = q.filter(ProductionPlan.trang_thai != "nhap")
    if noi_sx:
        # PhanXuong của LSX có thể là CD2 (HM, CC) → follow phoi_tu_phan_xuong_id để ra CD1
        _PX = aliased(PhanXuong)   # xưởng trực tiếp của LSX
        _PX1 = aliased(PhanXuong)   # xưởng CD1 nguồn (nếu LSX là CD2)
        matched_plan_ids = (
            db.query(ProductionPlanLine.plan_id)
            .join(ProductionOrderItem, ProductionOrderItem.id == ProductionPlanLine.production_order_item_id)
            .join(ProductionOrder, ProductionOrder.id == ProductionOrderItem.production_order_id)
            .join(_PX, _PX.id == ProductionOrder.phan_xuong_id)
            .outerjoin(_PX1, _PX1.id == _PX.phoi_tu_phan_xuong_id)
            .filter(
                case(
                    (_PX.cong_doan == 'cd1_cd2', _PX.ten_xuong),
                    else_=_PX1.ten_xuong,
                ) == noi_sx
            )
            .subquery()
        )
        q = q.filter(ProductionPlan.id.in_(matched_plan_ids))
    if tu_ngay:
        q = q.filter(ProductionPlan.ngay_ke_hoach >= tu_ngay)
    if den_ngay:
        q = q.filter(ProductionPlan.ngay_ke_hoach <= den_ngay)

    total = q.count()
    plans = (
        q.order_by(ProductionPlan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Batch-query noi_sx: resolve CD1 xưởng (HM/CC → follow phoi_tu_phan_xuong → NT/HG)
    plan_ids = [p.id for p in plans]
    noi_sx_map: dict[int, str] = {}
    if plan_ids:
        _PX = aliased(PhanXuong)   # xưởng trực tiếp của LSX
        _PX1 = aliased(PhanXuong)   # xưởng CD1 nguồn (nếu LSX là CD2)
        rows = (
            db.query(
                ProductionPlanLine.plan_id,
                case(
                    (_PX.cong_doan == 'cd1_cd2', _PX.ten_xuong),
                    else_=_PX1.ten_xuong,
                ).label("cd1_xuong"),
            )
            .join(ProductionOrderItem, ProductionOrderItem.id == ProductionPlanLine.production_order_item_id)
            .join(ProductionOrder, ProductionOrder.id == ProductionOrderItem.production_order_id)
            .join(_PX, _PX.id == ProductionOrder.phan_xuong_id)
            .outerjoin(_PX1, _PX1.id == _PX.phoi_tu_phan_xuong_id)
            .filter(ProductionPlanLine.plan_id.in_(plan_ids))
            .all()
        )
        for plan_id, xuong in rows:
            if plan_id not in noi_sx_map and xuong:
                noi_sx_map[plan_id] = xuong

    items_resp: list[ProductionPlanListItem] = []
    for p in plans:
        lines = db.query(ProductionPlanLine).filter(ProductionPlanLine.plan_id == p.id).all()
        tong_sl = sum(ln.so_luong_ke_hoach for ln in lines)
        creator = getattr(p, "creator", None)
        items_resp.append(ProductionPlanListItem(
            id=p.id,
            so_ke_hoach=p.so_ke_hoach,
            ngay_ke_hoach=p.ngay_ke_hoach,
            trang_thai=p.trang_thai,
            so_dong=len(lines),
            tong_sl=tong_sl,
            created_at=p.created_at,
            created_by_name=creator.ho_ten if creator else None,
            noi_sx=noi_sx_map.get(p.id),  # từ LSX, không phải creator
        ))

    return PagedPlanResponse(
        items=items_resp,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=ProductionPlanResponse, status_code=201)
def create_plan(
    data: ProductionPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    so_ke_hoach = _generate_so_ke_hoach(db)
    plan = ProductionPlan(
        so_ke_hoach=so_ke_hoach,
        ngay_ke_hoach=data.ngay_ke_hoach,
        ghi_chu=data.ghi_chu,
        trang_thai="nhap",
        created_by=current_user.id,
    )
    db.add(plan)
    db.flush()  # get plan.id

    for i, line_data in enumerate(data.lines):
        _add_line_to_plan(plan.id, line_data, i, db)

    db.commit()
    db.refresh(plan)
    return _build_plan_response(_load_plan(plan.id, db))


def _add_line_to_plan(
    plan_id: int,
    line_data: ProductionPlanLineCreate,
    thu_tu_override: int,
    db: Session,
) -> ProductionPlanLine:
    # Kiểm tra production_order_item tồn tại
    poi = db.query(ProductionOrderItem).filter(
        ProductionOrderItem.id == line_data.production_order_item_id
    ).first()
    if not poi:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy dòng LSX #{line_data.production_order_item_id}",
        )

    order = db.get(ProductionOrder, poi.production_order_id)
    if order:
        if order.tan_dung:
            raise HTTPException(
                status_code=400,
                detail=f"Lệnh {order.so_lenh} đang ở hướng 'Tận dụng phôi', không thể thêm vào Kế hoạch SX",
            )
        if order.trang_thai == "mua_ngoai":
            raise HTTPException(
                status_code=400,
                detail=f"Lệnh {order.so_lenh} đang ở hướng 'Mua phôi ngoài', không thể thêm vào Kế hoạch SX",
            )

    # Tính so_dao và kho_tt
    so_dao = line_data.so_dao
    if line_data.kho1 and line_data.kho_giay and not so_dao:
        so_dao = math.floor(float(line_data.kho_giay) / float(line_data.kho1))
    kho_tt = _calc_kho_tt(line_data.kho1, so_dao)

    thu_tu = line_data.thu_tu if line_data.thu_tu > 0 else thu_tu_override + 1
    line = ProductionPlanLine(
        plan_id=plan_id,
        production_order_item_id=line_data.production_order_item_id,
        thu_tu=thu_tu,
        ngay_chay=line_data.ngay_chay,
        kho1=line_data.kho1,
        kho_giay=line_data.kho_giay,
        so_dao=so_dao,
        kho_tt=kho_tt,
        so_luong_ke_hoach=line_data.so_luong_ke_hoach,
        ghi_chu=line_data.ghi_chu,
    )
    db.add(line)
    return line


@router.get("/queue", response_model=list[QueueLineResponse])
def get_queue(
    trang_thai: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tất cả dòng kế hoạch chờ / đang chạy sản xuất."""
    plans = (
        db.query(ProductionPlan)
        .options(
            joinedload(ProductionPlan.lines)
            .joinedload(ProductionPlanLine.production_order_item)
            .joinedload(ProductionOrderItem.production_order)
            .joinedload(ProductionOrder.sales_order)
            .joinedload(SalesOrder.customer),
        )
        .filter(ProductionPlan.trang_thai.in_(["nhap", "da_xuat"]))
        .all()
    )

    all_lines: list[ProductionPlanLine] = []
    for p in plans:
        all_lines.extend(p.lines)

    item_ids = list({ln.production_order_item_id for ln in all_lines})
    boms = (
        db.query(ProductionBOM).filter(ProductionBOM.production_order_item_id.in_(item_ids)).all()
    ) if item_ids else []
    bom_by_item = {b.production_order_item_id: b for b in boms}
    plan_by_id = {p.id: p for p in plans}
    for ln in all_lines:
        if ln.production_order_item:
            ln.production_order_item._bom_cache = bom_by_item.get(ln.production_order_item_id)

    stati = [trang_thai] if trang_thai else ["cho", "dang_chay"]
    filtered = [ln for ln in all_lines if ln.trang_thai in stati]
    filtered.sort(key=lambda ln: (ln.ngay_chay or date(2099, 1, 1), ln.thu_tu, ln.id))

    return [_build_queue_line(ln, plan_by_id[ln.plan_id]) for ln in filtered]


class _ReorderItem(BaseModel):
    id: int
    thu_tu: int


@router.patch("/queue/reorder")
def reorder_queue(
    items: list[_ReorderItem],
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Cập nhật thứ tự (thu_tu) cho nhiều dòng KHSX cùng lúc."""
    ids = [it.id for it in items]
    lines = db.query(ProductionPlanLine).filter(ProductionPlanLine.id.in_(ids)).all()
    line_map = {ln.id: ln for ln in lines}
    for it in items:
        if it.id in line_map:
            line_map[it.id].thu_tu = it.thu_tu
    db.commit()
    return {"updated": len(lines)}


@router.post("/push-to-queue", response_model=QueueLineResponse, status_code=201)
def push_to_queue(
    data: PushToQueueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thêm dòng LSX vào hàng chờ. Nếu đã có dòng 'cho' thì cập nhật thông số."""
    poi = db.query(ProductionOrderItem).filter(
        ProductionOrderItem.id == data.production_order_item_id
    ).first()
    if not poi:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng LSX")

    order = db.get(ProductionOrder, poi.production_order_id)
    if order:
        if order.tan_dung:
            raise HTTPException(
                status_code=400,
                detail=f"Lệnh {order.so_lenh} đang ở hướng 'Tận dụng phôi', không thể thêm vào Kế hoạch chờ",
            )
        if order.trang_thai == "mua_ngoai":
            raise HTTPException(
                status_code=400,
                detail=f"Lệnh {order.so_lenh} đang ở hướng 'Mua phôi ngoài', không thể thêm vào Kế hoạch chờ",
            )

    so_dao = data.so_dao
    if data.kho1 and data.kho_giay and not so_dao:
        so_dao = math.floor(float(data.kho_giay) / float(data.kho1))
    kho_tt = _calc_kho_tt(data.kho1, so_dao)

    # Sync snapshot sang tất cả plan lines đang active (chưa hoàn thành) của item này
    if data.kho1 is not None or data.kho_giay is not None or so_dao is not None:
        active_lines = (
            db.query(ProductionPlanLine)
            .filter(
                ProductionPlanLine.production_order_item_id == data.production_order_item_id,
                ProductionPlanLine.trang_thai != "hoan_thanh",
            )
            .all()
        )
        for ln in active_lines:
            if data.kho1 is not None:
                ln.kho1 = data.kho1
            if data.kho_giay is not None:
                ln.kho_giay = data.kho_giay
            if so_dao is not None:
                ln.so_dao = so_dao
            if kho_tt is not None:
                ln.kho_tt = kho_tt

    existing = (
        db.query(ProductionPlanLine)
        .join(ProductionPlan)
        .filter(
            ProductionPlanLine.production_order_item_id == data.production_order_item_id,
            ProductionPlanLine.trang_thai.in_(["cho", "dang_chay"]),
            ProductionPlan.trang_thai.in_(["nhap", "da_xuat"]),
        )
        .first()
    )

    if existing:
        # Chỉ cập nhật thông số nếu đang chờ; nếu đang chạy thì chỉ sync snapshot (đã làm trên)
        if existing.trang_thai == "cho":
            existing.so_luong_ke_hoach = data.so_luong_ke_hoach
            if poi.ghi_chu:
                existing.ghi_chu = poi.ghi_chu
            db.commit()
        line_id = existing.id
    else:
        today = date.today()
        plan = (
            db.query(ProductionPlan)
            .filter(ProductionPlan.trang_thai == "nhap", ProductionPlan.ngay_ke_hoach == today)
            .order_by(ProductionPlan.id.desc())
            .first()
        )
        if not plan:
            plan = ProductionPlan(
                so_ke_hoach=_generate_so_ke_hoach(db),
                ngay_ke_hoach=today,
                ghi_chu="Tự động tạo từ Lập lệnh SX",
                trang_thai="nhap",
                created_by=current_user.id,
            )
            db.add(plan)
            db.flush()

        count = db.query(ProductionPlanLine).filter(ProductionPlanLine.plan_id == plan.id).count()
        new_line = ProductionPlanLine(
            plan_id=plan.id,
            production_order_item_id=data.production_order_item_id,
            thu_tu=count + 1,
            kho1=data.kho1,
            kho_giay=data.kho_giay,
            so_dao=so_dao,
            kho_tt=kho_tt,
            so_luong_ke_hoach=data.so_luong_ke_hoach,
            ghi_chu=poi.ghi_chu,
            trang_thai="cho",
        )
        db.add(new_line)
        db.commit()
        line_id = new_line.id

    line_full, plan_full = _load_queue_line_full(line_id, db)
    return _build_queue_line(line_full, plan_full)


@router.patch("/queue/{line_id}/start", response_model=QueueLineResponse)
def start_queue_line(
    line_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Bắt đầu chạy dòng (cho → dang_chay)."""
    line = db.query(ProductionPlanLine).filter(ProductionPlanLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng")
    if line.trang_thai != "cho":
        raise HTTPException(status_code=400, detail="Dòng không ở trạng thái Chờ")
    line.trang_thai = "dang_chay"
    line.ngay_chay = date.today()
    db.commit()
    line_full, plan_full = _load_queue_line_full(line_id, db)
    return _build_queue_line(line_full, plan_full)


@router.get("/{plan_id}", response_model=ProductionPlanResponse)
def get_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _build_plan_response(_load_plan(plan_id, db))


@router.put("/{plan_id}", response_model=ProductionPlanResponse)
def update_plan(
    plan_id: int,
    data: ProductionPlanUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch")
    if plan.trang_thai == "hoan_thanh":
        raise HTTPException(status_code=400, detail="Kế hoạch đã hoàn thành, không thể sửa")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    db.commit()
    return _build_plan_response(_load_plan(plan_id, db))


@router.delete("/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch")
    if plan.so_ke_hoach == QUEUE_POOL_SO:
        raise HTTPException(status_code=400, detail="Không thể xóa kế hoạch hàng chờ hệ thống")
    if plan.trang_thai != "nhap":
        raise HTTPException(status_code=400, detail="Chỉ xóa được kế hoạch ở trạng thái Nháp")
    db.delete(plan)
    db.commit()
    return {"message": f"Đã xóa kế hoạch {plan.so_ke_hoach}"}


@router.patch("/{plan_id}/export", response_model=ProductionPlanResponse)
def export_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Xuất kế hoạch cho sản xuất (nhap → da_xuat)."""
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch")
    if plan.trang_thai != "nhap":
        raise HTTPException(status_code=400, detail=f"Kế hoạch đang ở '{plan.trang_thai}', không thể xuất")
    if not db.query(ProductionPlanLine).filter(ProductionPlanLine.plan_id == plan_id).first():
        raise HTTPException(status_code=400, detail="Kế hoạch chưa có dòng nào")

    plan.trang_thai = "da_xuat"
    db.commit()
    return _build_plan_response(_load_plan(plan_id, db))


# ─── Line endpoints ────────────────────────────────────────────────────────────

@router.post("/{plan_id}/lines", response_model=ProductionPlanResponse, status_code=201)
def add_line(
    plan_id: int,
    data: ProductionPlanLineCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch")
    if plan.trang_thai == "hoan_thanh":
        raise HTTPException(status_code=400, detail="Không thể thêm dòng vào kế hoạch đã hoàn thành")

    existing_count = db.query(ProductionPlanLine).filter(
        ProductionPlanLine.plan_id == plan_id
    ).count()
    _add_line_to_plan(plan_id, data, existing_count, db)
    db.commit()
    return _build_plan_response(_load_plan(plan_id, db))


@router.put("/{plan_id}/lines/{line_id}", response_model=ProductionPlanResponse)
def update_line(
    plan_id: int,
    line_id: int,
    data: ProductionPlanLineUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    line = db.query(ProductionPlanLine).filter(
        ProductionPlanLine.id == line_id,
        ProductionPlanLine.plan_id == plan_id,
    ).first()
    if not line:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng kế hoạch")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(line, field, value)

    # Recalculate so_dao / kho_tt nếu kho1 hoặc kho_giay thay đổi
    if line.kho1 and line.kho_giay:
        if data.so_dao is None:  # không override thủ công
            line.so_dao = math.floor(float(line.kho_giay) / float(line.kho1))
        line.kho_tt = _calc_kho_tt(line.kho1, line.so_dao)

    db.commit()
    return _build_plan_response(_load_plan(plan_id, db))


@router.delete("/{plan_id}/lines/{line_id}", response_model=ProductionPlanResponse)
def delete_line(
    plan_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch")
    if plan.trang_thai == "hoan_thanh":
        raise HTTPException(status_code=400, detail="Không thể xóa dòng của kế hoạch đã hoàn thành")

    line = db.query(ProductionPlanLine).filter(
        ProductionPlanLine.id == line_id,
        ProductionPlanLine.plan_id == plan_id,
    ).first()
    if not line:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng kế hoạch")

    order = (
        db.query(ProductionOrder)
        .join(ProductionOrderItem, ProductionOrderItem.production_order_id == ProductionOrder.id)
        .filter(ProductionOrderItem.id == line.production_order_item_id)
        .first()
    )
    if order and order.trang_thai == "dang_chay":
        raise HTTPException(
            status_code=400,
            detail=f"LSX {order.so_lenh} đang chạy — không thể gỡ khỏi kế hoạch",
        )

    pool = _get_or_create_pool_plan(db)
    line.plan_id = pool.id
    line.trang_thai = "cho"
    line.ngay_chay = None
    line.thu_tu = 0
    db.commit()
    return _build_plan_response(_load_plan(plan_id, db))


@router.patch("/{plan_id}/lines/{line_id}/complete", response_model=ProductionPlanResponse)
def complete_line(
    plan_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    line = db.query(ProductionPlanLine).filter(
        ProductionPlanLine.id == line_id,
        ProductionPlanLine.plan_id == plan_id,
    ).first()
    if not line:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng kế hoạch")

    line.trang_thai = "hoan_thanh"
    line.so_luong_hoan_thanh = line.so_luong_ke_hoach
    db.commit()

    # Tự động cập nhật trạng thái kế hoạch nếu tất cả dòng hoàn thành
    all_lines = db.query(ProductionPlanLine).filter(
        ProductionPlanLine.plan_id == plan_id
    ).all()
    if all(ln.trang_thai == "hoan_thanh" for ln in all_lines):
        plan = db.query(ProductionPlan).filter(ProductionPlan.id == plan_id).first()
        if plan:
            plan.trang_thai = "hoan_thanh"
        db.commit()

    return _build_plan_response(_load_plan(plan_id, db))


# ─── Queue endpoints ──────────────────────────────────────────────────────────

def _build_queue_line(line: ProductionPlanLine, plan: ProductionPlan) -> QueueLineResponse:
    item = line.production_order_item
    order = item.production_order if item else None
    customer = None
    if order and order.sales_order and order.sales_order.customer:
        customer = order.sales_order.customer
    bom: "ProductionBOM | None" = getattr(item, "_bom_cache", None)

    # Derive c_tham / can_man từ BOM nếu item chưa có
    def _bom_mat_str(val: int | None) -> str | None:
        return f"{val} mặt" if val else None

    q_c_tham = (item.c_tham if item else None) or _bom_mat_str(bom.chong_tham if bom else None)
    q_can_man = (item.can_man if item else None) or _bom_mat_str(bom.can_mang if bom else None)

    return QueueLineResponse(
        id=line.id,
        plan_id=line.plan_id,
        so_ke_hoach=plan.so_ke_hoach,
        production_order_id=order.id if order else None,
        production_order_item_id=line.production_order_item_id,
        thu_tu=line.thu_tu,
        ngay_chay=line.ngay_chay,
        kho1=line.kho1,
        kho_giay=line.kho_giay,
        so_dao=line.so_dao,
        kho_tt=line.kho_tt,
        so_luong_ke_hoach=line.so_luong_ke_hoach,
        so_luong_hoan_thanh=line.so_luong_hoan_thanh,
        trang_thai=line.trang_thai,
        plan_trang_thai=plan.trang_thai,
        mua_phoi_ngoai=getattr(line, "mua_phoi_ngoai", False),
        ghi_chu=line.ghi_chu or (item.ghi_chu if item else None),
        so_lenh=order.so_lenh if order else None,
        ma_kh=customer.ma_kh if customer else None,
        ten_khach_hang=customer.ten_viet_tat if customer else None,
        ten_hang=item.ten_hang if item else None,
        ngay_giao_hang=item.ngay_giao_hang if item else None,
        loai_thung=bom.loai_thung if bom else (item.loai_thung if item else None),
        dai=bom.dai if bom else (item.dai if item else None),
        rong=bom.rong if bom else (item.rong if item else None),
        cao=bom.cao if bom else (item.cao if item else None),
        so_lop=bom.so_lop if bom else (item.so_lop if item else None),
        to_hop_song=bom.to_hop_song if bom else (item.to_hop_song if item else None),
        loai_lan=item.loai_lan if item else None,
        loai_in=item.loai_in if item else None,
        so_mau=item.so_mau if item else None,
        c_tham=q_c_tham,
        can_man=q_can_man,
        dai_tt=item.dai_tt if item else None,
        so_lan_cat=item.so_lan_cat if item else None,
        be_so_con=item.be_so_con if item else None,
        mat=item.mat if item else None, mat_dl=item.mat_dl if item else None,
        song_1=item.song_1 if item else None, song_1_dl=item.song_1_dl if item else None,
        mat_1=item.mat_1 if item else None, mat_1_dl=item.mat_1_dl if item else None,
        song_2=item.song_2 if item else None, song_2_dl=item.song_2_dl if item else None,
        mat_2=item.mat_2 if item else None, mat_2_dl=item.mat_2_dl if item else None,
        song_3=item.song_3 if item else None, song_3_dl=item.song_3_dl if item else None,
        mat_3=item.mat_3 if item else None, mat_3_dl=item.mat_3_dl if item else None,
    )


def _load_queue_line_full(line_id: int, db: Session):
    line = (
        db.query(ProductionPlanLine)
        .options(
            joinedload(ProductionPlanLine.production_order_item)
            .joinedload(ProductionOrderItem.production_order)
            .joinedload(ProductionOrder.sales_order)
            .joinedload(SalesOrder.customer),
        )
        .filter(ProductionPlanLine.id == line_id)
        .first()
    )
    if not line:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng")
    bom = db.query(ProductionBOM).filter(
        ProductionBOM.production_order_item_id == line.production_order_item_id
    ).first()
    if line.production_order_item:
        line.production_order_item._bom_cache = bom
    plan = db.query(ProductionPlan).filter(ProductionPlan.id == line.plan_id).first()
    return line, plan


# ─── Toggle mua phôi ngoài ────────────────────────────────────────────────────

@router.patch("/lines/{line_id}/phoi-ngoai")
def toggle_mua_phoi_ngoai(
    line_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Đánh dấu hoặc bỏ đánh dấu KHSX line cần mua phôi sóng từ NCC ngoài.
    Body: {"mua_phoi_ngoai": bool}
    """
    line = db.query(ProductionPlanLine).filter(ProductionPlanLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng KHSX")
    line.mua_phoi_ngoai = bool(body.get("mua_phoi_ngoai", False))
    db.commit()
    return {"id": line.id, "mua_phoi_ngoai": line.mua_phoi_ngoai}


# ─── Promote pool line back to KHSX (auto-resolve xưởng) ─────────────────────

@router.patch("/lines/{line_id}/promote-from-pool")
def promote_pool_line(
    line_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Đưa line từ pool hàng chờ về một nhap plan thực sự.
    Tự xác định CD1 xưởng từ LSX → tìm nhap plan cùng xưởng hôm nay → tạo mới nếu không có.
    """
    line = db.query(ProductionPlanLine).filter(ProductionPlanLine.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh")

    current_plan = db.get(ProductionPlan, line.plan_id)
    if not current_plan or current_plan.so_ke_hoach != QUEUE_POOL_SO:
        raise HTTPException(status_code=400, detail="Lệnh không nằm trong hàng chờ pool")
    if line.trang_thai == "dang_chay":
        raise HTTPException(status_code=400, detail="Không thể di chuyển lệnh đang chạy")

    # Resolve CD1 xưởng từ LSX (giống logic noi_sx trong list_plans)
    poi = db.get(ProductionOrderItem, line.production_order_item_id)
    order = db.get(ProductionOrder, poi.production_order_id) if poi else None
    cd1_xuong: str | None = None
    if order and order.phan_xuong_id:
        px = db.get(PhanXuong, order.phan_xuong_id)
        if px:
            if px.cong_doan == "cd1_cd2":
                cd1_xuong = px.ten_xuong
            elif px.phoi_tu_phan_xuong_id:
                px1 = db.get(PhanXuong, px.phoi_tu_phan_xuong_id)
                cd1_xuong = px1.ten_xuong if px1 else None

    today = date.today()
    target_plan: ProductionPlan | None = None

    # Tìm nhap plan hôm nay có cùng CD1 xưởng
    if cd1_xuong:
        _PX = aliased(PhanXuong)
        _PX1 = aliased(PhanXuong)
        same_xuong_ids = (
            db.query(ProductionPlanLine.plan_id)
            .join(ProductionOrderItem, ProductionOrderItem.id == ProductionPlanLine.production_order_item_id)
            .join(ProductionOrder, ProductionOrder.id == ProductionOrderItem.production_order_id)
            .join(_PX, _PX.id == ProductionOrder.phan_xuong_id)
            .outerjoin(_PX1, _PX1.id == _PX.phoi_tu_phan_xuong_id)
            .filter(
                case((_PX.cong_doan == "cd1_cd2", _PX.ten_xuong), else_=_PX1.ten_xuong) == cd1_xuong
            )
            .subquery()
        )
        target_plan = (
            db.query(ProductionPlan)
            .filter(
                ProductionPlan.id.in_(same_xuong_ids),
                ProductionPlan.trang_thai == "nhap",
                ProductionPlan.so_ke_hoach != QUEUE_POOL_SO,
                ProductionPlan.ngay_ke_hoach == today,
            )
            .order_by(ProductionPlan.id.desc())
            .first()
        )

    # Fallback: nhap plan hôm nay bất kỳ (không phải pool)
    if not target_plan:
        target_plan = (
            db.query(ProductionPlan)
            .filter(
                ProductionPlan.trang_thai == "nhap",
                ProductionPlan.so_ke_hoach != QUEUE_POOL_SO,
                ProductionPlan.ngay_ke_hoach == today,
            )
            .order_by(ProductionPlan.id.desc())
            .first()
        )

    # Tạo nhap plan mới nếu không tìm thấy
    if not target_plan:
        target_plan = ProductionPlan(
            so_ke_hoach=_generate_so_ke_hoach(db),
            ngay_ke_hoach=today,
            ghi_chu="Tạo từ hàng chờ" + (f" — {cd1_xuong}" if cd1_xuong else ""),
            trang_thai="nhap",
            created_by=current_user.id,
        )
        db.add(target_plan)
        db.flush()

    line.plan_id = target_plan.id
    db.commit()
    return {"ok": True, "plan_id": target_plan.id, "so_ke_hoach": target_plan.so_ke_hoach}
