import html as _html_mod
from datetime import date
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.deps import get_current_user, require_any_permission
from app.models.auth import User
from app.models.master import PhanXuong, Customer, PhapNhan, Product
from app.models.sales import SalesOrder, SalesOrderItem, Quote, QuoteItem
from app.services.inventory_service import (
    get_workshop_warehouse as _get_workshop_warehouse,
    get_or_create_workshop_warehouse as _get_or_create_workshop_warehouse,
    get_phoi_source_warehouse as _get_phoi_source_warehouse,
)
from app.services.production_order_service import ProductionOrderService
from app.services.defect_record_service import auto_defect_record
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.production_plan import ProductionPlanLine
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.production import MayDungLog
from app.schemas.master import ProductShort
from app.schemas.production import (
    ProductionOrderCreate, ProductionOrderUpdate,
    ProductionOrderResponse, ProductionOrderItemResponse,
    UpdateItemProgress, UpdateItemSxParams, PagedResponse,
    TaoLenhBody,
)

router = APIRouter(
    prefix="/api/production-orders",
    dependencies=[Depends(require_any_permission("production_order.view", "inventory.view"))],
    tags=["production-orders"],
)


def _sync_so_trang_thai(db: Session, order: ProductionOrder) -> None:
    """Khi LSX hoàn thành, kiểm tra nếu tất cả LSX của cùng 1 SO đều hoan_thanh → đặt SO thành da_giao."""
    if not order.sales_order_id:
        return
    pending = (
        db.query(ProductionOrder)
        .filter(
            ProductionOrder.sales_order_id == order.sales_order_id,
            ProductionOrder.trang_thai.not_in(["hoan_thanh", "huy"]),
        )
        .count()
    )
    if pending == 0:
        so = db.get(SalesOrder, order.sales_order_id)
        if so and so.trang_thai == "da_duyet":
            so.trang_thai = "da_giao"


def _auto_kho_sx_id(db: Session, phan_xuong_id: int | None, kho_sx_id: int | None) -> int | None:
    """Tự động tìm kho SX nếu chưa có: GIAY_CUON cho xưởng cd1_cd2, PHOI cho xưởng cd2."""
    if kho_sx_id or not phan_xuong_id:
        return kho_sx_id
    px = db.get(PhanXuong, phan_xuong_id)
    if not px:
        return None
    loai_kho = "GIAY_CUON" if getattr(px, "cong_doan", None) == "cd1_cd2" else "PHOI"
    wh = _get_workshop_warehouse(db, phan_xuong_id, loai_kho)
    return wh.id if wh else None


def _generate_so_lenh(db: Session) -> str:
    today = date.today()
    prefix = f"LSX{today.strftime('%Y%m%d')}"
    last = (
        db.query(ProductionOrder)
        .filter(ProductionOrder.so_lenh.like(f"{prefix}%"))
        .order_by(ProductionOrder.so_lenh.desc())
        .first()
    )
    seq = (int(last.so_lenh[-3:]) + 1) if last else 1
    return f"{prefix}{seq:03d}"


def _build_response(order: ProductionOrder, db: Session | None = None) -> ProductionOrderResponse:
    so_don = order.sales_order.so_don if order.sales_order else None
    kh = order.sales_order.customer if order.sales_order else None
    ten_khach_hang = kh.ten_viet_tat if kh else None
    ma_khach_hang = kh.ma_kh if kh else None

    # Queue status: lấy 1 lần cho tất cả items (tránh N+1)
    item_ids = [it.id for it in order.items]
    queue_status_map: dict[int, str] = {}
    if item_ids and db is not None:
        active_lines = (
            db.query(ProductionPlanLine.production_order_item_id, ProductionPlanLine.trang_thai)
            .filter(
                ProductionPlanLine.production_order_item_id.in_(item_ids),
                ProductionPlanLine.trang_thai != "hoan_thanh",
            )
            .all()
        )
        queue_status_map = {row.production_order_item_id: row.trang_thai for row in active_lines}

    def _build_item(item: ProductionOrderItem) -> ProductionOrderItemResponse:
        soi = item.sales_order_item
        qi = soi.quote_item if soi else None

        _DEFAULT_TO_HOP_SONG = {3: 'B', 5: 'BC', 7: 'BCB'}

        def _f(field):
            v = getattr(item, field, None)
            if v is None and soi is not None:
                v = getattr(soi, field, None)
            if v is None and qi is not None:
                v = getattr(qi, field, None)
            return v

        so_lop = _f('so_lop') or 3
        to_hop_song = _f('to_hop_song') or _DEFAULT_TO_HOP_SONG.get(so_lop)

        # Tính cong_doan từ loai_in + các checkbox (POI → SOI → QI)
        _cd: list[str] = []
        _loai_in = _f('loai_in')
        _so_mau = _f('so_mau')
        if _loai_in and _loai_in != 'khong_in':
            _lbl = 'Flexo' if _loai_in == 'flexo' else 'Kỹ thuật số'
            if _so_mau and _so_mau > 0:
                _lbl += f' {_so_mau} màu'
            _cd.append(_lbl)
        if qi:
            if qi.do_kho:
                _cd.append('Độ khó')
            if qi.ghim:
                _cd.append('Ghim')
            if qi.chap_xa:
                _cd.append('Chạp Xã')
            if qi.do_phu:
                _cd.append('Độ phủ')
            if qi.dan:
                _cd.append('Dán')
            if qi.boi:
                _cd.append('Bồi')
            if qi.be_lo:
                _cd.append('Bế Lỗ')
        cong_doan = ' | '.join(_cd) if _cd else None

        return ProductionOrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            sales_order_item_id=item.sales_order_item_id,
            ten_hang=item.ten_hang,
            product=ProductShort.model_validate(item.product) if item.product else None,
            so_luong_ke_hoach=item.so_luong_ke_hoach,
            so_luong_hoan_thanh=item.so_luong_hoan_thanh,
            dvt=item.dvt,
            ngay_giao_hang=item.ngay_giao_hang,
            ghi_chu=item.ghi_chu,
            loai_thung=_f('loai_thung'),
            dai=_f('dai'), rong=_f('rong'), cao=_f('cao'),
            so_lop=so_lop, to_hop_song=to_hop_song,
            mat=_f('mat'), mat_dl=_f('mat_dl'),
            song_1=_f('song_1'), song_1_dl=_f('song_1_dl'),
            mat_1=_f('mat_1'), mat_1_dl=_f('mat_1_dl'),
            song_2=_f('song_2'), song_2_dl=_f('song_2_dl'),
            mat_2=_f('mat_2'), mat_2_dl=_f('mat_2_dl'),
            song_3=_f('song_3'), song_3_dl=_f('song_3_dl'),
            mat_3=_f('mat_3'), mat_3_dl=_f('mat_3_dl'),
            loai_in=_f('loai_in'), so_mau=_f('so_mau'), loai_lan=_f('loai_lan'),
            kho_tt=item.kho_tt, dai_tt=item.dai_tt,
            so_lan_cat=item.so_lan_cat, be_so_con=item.be_so_con,
            qccl=item.qccl,
            dien_tich=item.dien_tich,
            gia_ban_muc_tieu=item.gia_ban_muc_tieu,
            cong_doan=cong_doan,
            queue_status=queue_status_map.get(item.id),
        )

    items = [_build_item(item) for item in order.items]
    return ProductionOrderResponse(
        id=order.id,
        so_lenh=order.so_lenh,
        ngay_lenh=order.ngay_lenh,
        sales_order_id=order.sales_order_id,
        so_don=so_don,
        ten_khach_hang=ten_khach_hang,
        ma_khach_hang=ma_khach_hang,
        phap_nhan_id=order.phap_nhan_id,
        ten_phap_nhan=order.phap_nhan.ten_phap_nhan if order.phap_nhan else (
            order.sales_order.phap_nhan.ten_phap_nhan if order.sales_order and order.sales_order.phap_nhan else None),
        kho_sx_id=order.kho_sx_id,
        ten_kho_sx=order.kho_sx.ten_kho if order.kho_sx else None,
        phan_xuong_id=order.phan_xuong_id,
        ten_phan_xuong=order.phan_xuong.ten_xuong if order.phan_xuong else (
            order.sales_order.phan_xuong.ten_xuong if order.sales_order and order.sales_order.phan_xuong else None),
        nv_theo_doi_id=order.nv_theo_doi_id,
        ten_nv_theo_doi=order.nv_theo_doi.ho_ten if order.nv_theo_doi else None,
        created_by_name=order.creator.ho_ten if order.creator else None,
        so_po_kh=order.so_po_kh,
        trang_thai=order.trang_thai,
        ngay_bat_dau_ke_hoach=order.ngay_bat_dau_ke_hoach,
        ngay_hoan_thanh_ke_hoach=order.ngay_hoan_thanh_ke_hoach,
        ngay_bat_dau_thuc_te=order.ngay_bat_dau_thuc_te,
        ngay_hoan_thanh_thuc_te=order.ngay_hoan_thanh_thuc_te,
        ghi_chu=order.ghi_chu,
        ghi_chu_don_hang=order.sales_order.ghi_chu if order.sales_order else None,
        don_gia_noi_bo=getattr(order, "don_gia_noi_bo", None),
        tan_dung=getattr(order, "tan_dung", False),
        in_2_lan=getattr(order, "in_2_lan", False),
        phoi_phan_xuong_id=getattr(order, "phoi_phan_xuong_id", None),
        ten_phoi_phan_xuong=(
            order.phoi_phan_xuong.ten_xuong if getattr(order, "phoi_phan_xuong", None) else None
        ),
        ten_kho_nhap_phoi_du_kien=(
            getattr(
                _get_phoi_source_warehouse(
                    db, order.phan_xuong_id, order.phap_nhan_id,
                    getattr(order, "phoi_phan_xuong_id", None),
                ),
                "ten_kho", None,
            ) if db else None
        ),
        items=items,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


def _load_order(order_id: int, db: Session) -> ProductionOrder:
    order = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.phap_nhan),
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.phan_xuong),
            joinedload(ProductionOrder.items).joinedload(ProductionOrderItem.product),
            joinedload(ProductionOrder.items)
            .joinedload(ProductionOrderItem.sales_order_item)
            .joinedload(SalesOrderItem.quote_item),
            joinedload(ProductionOrder.phap_nhan),
            joinedload(ProductionOrder.kho_sx),
            joinedload(ProductionOrder.phan_xuong),
            joinedload(ProductionOrder.phoi_phan_xuong),
            joinedload(ProductionOrder.nv_theo_doi),
            joinedload(ProductionOrder.creator),
        )
        .filter(ProductionOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    return order


@router.get("", response_model=PagedResponse)
def list_orders(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    sales_order_id: int | None = Query(default=None),
    phan_xuong_id: int | None = Query(default=None),
    phap_nhan_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=10000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = ProductionOrderService(db)
    return service.get_production_orders_paginated(
        search=search,
        trang_thai=trang_thai,
        sales_order_id=sales_order_id,
        phan_xuong_id=phan_xuong_id,
        phap_nhan_id=phap_nhan_id,
        tu_ngay=tu_ngay,
        den_ngay=den_ngay,
        page=page,
        page_size=page_size,
    )


@router.get("/lenh-summary")
def list_lenh_summary(
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    phan_xuong_id: int | None = Query(default=None),
    phap_nhan_id: int | None = Query(default=None),
    trang_thai: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import select, func, or_
    from app.models.cd2 import PhieuIn
    from app.models.warehouse_doc import ProductionOutput, DeliveryOrderItem
    from app.models.sales import SalesReturnItem, SalesOrder as _SO
    from app.models.master import Customer, PhapNhan as _PhapNhan, PhanXuong as _PX

    # ── Correlated scalar subqueries ──────────────────────────────────────────
    _id = ProductionOrder.id

    sl_kh_sq = (
        select(func.coalesce(func.sum(ProductionOrderItem.so_luong_ke_hoach), 0))
        .where(ProductionOrderItem.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    ten_hang_sq = (
        select(func.max(ProductionOrderItem.ten_hang))
        .where(ProductionOrderItem.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    cd1_chay_sq = (
        select(func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_thuc_te), 0))
        .select_from(PhieuNhapPhoiSongItem)
        .join(PhieuNhapPhoiSong, PhieuNhapPhoiSong.id == PhieuNhapPhoiSongItem.phieu_id)
        .where(PhieuNhapPhoiSong.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    cd1_loi_sq = (
        select(func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_loi), 0))
        .select_from(PhieuNhapPhoiSongItem)
        .join(PhieuNhapPhoiSong, PhieuNhapPhoiSong.id == PhieuNhapPhoiSongItem.phieu_id)
        .where(PhieuNhapPhoiSong.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    in_ok_sq = (
        select(func.coalesce(func.sum(PhieuIn.so_luong_sau_in_ok), 0))
        .where(PhieuIn.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    in_loi_sq = (
        select(func.coalesce(func.sum(PhieuIn.so_luong_sau_in_loi), 0))
        .where(PhieuIn.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    tp_ok_sq = (
        select(func.coalesce(func.sum(ProductionOutput.so_luong_nhap), 0))
        .where(ProductionOutput.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    tp_loi_sq = (
        select(func.coalesce(func.sum(ProductionOutput.so_luong_loi), 0))
        .where(ProductionOutput.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    giao_sq = (
        select(func.coalesce(func.sum(DeliveryOrderItem.so_luong), 0))
        .where(DeliveryOrderItem.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    tra_sq = (
        select(func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0))
        .select_from(SalesReturnItem)
        .join(DeliveryOrderItem, DeliveryOrderItem.id == SalesReturnItem.delivery_order_item_id)
        .where(DeliveryOrderItem.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )
    doanh_thu_sq = (
        select(func.coalesce(func.sum(DeliveryOrderItem.thanh_tien), 0))
        .where(DeliveryOrderItem.production_order_id == _id)
        .correlate(ProductionOrder).scalar_subquery()
    )

    # ── Main query ────────────────────────────────────────────────────────────
    stmt = (
        db.query(
            ProductionOrder.id,
            ProductionOrder.so_lenh,
            ProductionOrder.trang_thai,
            ProductionOrder.ngay_lenh,
            Customer.ten_viet_tat.label("ten_khach"),
            _PX.ten_xuong.label("ten_phan_xuong"),
            _PhapNhan.ten_phap_nhan.label("ten_phap_nhan"),
            ten_hang_sq.label("ten_hang"),
            sl_kh_sq.label("sl_ke_hoach"),
            cd1_chay_sq.label("sl_cd1_chay"),
            cd1_loi_sq.label("sl_cd1_loi"),
            in_ok_sq.label("sl_in_ok"),
            in_loi_sq.label("sl_in_loi"),
            tp_ok_sq.label("sl_tp_ok"),
            tp_loi_sq.label("sl_tp_loi"),
            giao_sq.label("sl_giao"),
            tra_sq.label("sl_tra"),
            doanh_thu_sq.label("doanh_thu"),
        )
        .outerjoin(_SO, _SO.id == ProductionOrder.sales_order_id)
        .outerjoin(Customer, Customer.id == _SO.customer_id)
        .outerjoin(_PX, _PX.id == ProductionOrder.phan_xuong_id)
        .outerjoin(_PhapNhan, _PhapNhan.id == ProductionOrder.phap_nhan_id)
    )

    if tu_ngay:
        stmt = stmt.filter(ProductionOrder.ngay_lenh >= tu_ngay)
    if den_ngay:
        stmt = stmt.filter(ProductionOrder.ngay_lenh <= den_ngay)
    if phan_xuong_id:
        stmt = stmt.filter(ProductionOrder.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        stmt = stmt.filter(ProductionOrder.phap_nhan_id == phap_nhan_id)
    if trang_thai:
        stmt = stmt.filter(ProductionOrder.trang_thai == trang_thai)
    if q:
        ten_hang_match = (
            select(ProductionOrderItem.id)
            .where(
                ProductionOrderItem.production_order_id == ProductionOrder.id,
                ProductionOrderItem.ten_hang.ilike(f"%{q}%"),
            )
            .correlate(ProductionOrder).exists()
        )
        stmt = stmt.filter(
            or_(ProductionOrder.so_lenh.ilike(f"%{q}%"), ten_hang_match)
        )

    rows = stmt.order_by(ProductionOrder.ngay_lenh.desc()).limit(300).all()

    return [
        {
            "id": r.id,
            "so_lenh": r.so_lenh,
            "trang_thai": r.trang_thai,
            "ngay_lenh": str(r.ngay_lenh) if r.ngay_lenh else None,
            "ten_hang": r.ten_hang,
            "ten_khach": r.ten_khach,
            "ten_phan_xuong": (r.ten_phan_xuong or "").replace("Xưởng ", ""),
            "ten_phap_nhan": r.ten_phap_nhan,
            "sl_ke_hoach": float(r.sl_ke_hoach or 0),
            "sl_cd1_chay": float(r.sl_cd1_chay or 0),
            "sl_cd1_loi": float(r.sl_cd1_loi or 0),
            "sl_in_ok": float(r.sl_in_ok or 0),
            "sl_in_loi": float(r.sl_in_loi or 0),
            "sl_tp_ok": float(r.sl_tp_ok or 0),
            "sl_tp_loi": float(r.sl_tp_loi or 0),
            "sl_giao": float(r.sl_giao or 0),
            "sl_tra": float(r.sl_tra or 0),
            "sl_con_kho": float((r.sl_tp_ok or 0) - (r.sl_giao or 0) + (r.sl_tra or 0)),
            "doanh_thu": float(r.doanh_thu or 0),
        }
        for r in rows
    ]


@router.get("/{order_id:int}", response_model=ProductionOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _build_response(_load_order(order_id, db), db)


@router.post("/tu-don-hang/{order_id:int}", response_model=List[ProductionOrderResponse], status_code=201)
def tao_lenh_tu_don_hang(
    order_id: int,
    data: TaoLenhBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("production_order.create")),
):
    """Tạo lệnh sản xuất: mỗi mã hàng trong đơn = 1 lệnh SX riêng biệt."""
    so = (
        db.query(SalesOrder)
        .options(
            joinedload(SalesOrder.items).joinedload(SalesOrderItem.quote_item),
        )
        .filter(SalesOrder.id == order_id)
        .first()
    )
    if not so:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if so.trang_thai not in ("da_duyet", "dang_sx"):
        raise HTTPException(status_code=400, detail="Chỉ lập lệnh SX từ đơn hàng đã duyệt hoặc đang sản xuất")
    if not so.items:
        raise HTTPException(status_code=400, detail="Đơn hàng không có mặt hàng nào")

    # Tạo tất cả so_lenh trước khi INSERT để tránh flush-trong-loop
    today_date = data.ngay_lenh or date.today()
    prefix = f"LSX{today_date.strftime('%Y%m%d')}"
    last = (
        db.query(ProductionOrder)
        .filter(ProductionOrder.so_lenh.like(f"{prefix}%"))
        .order_by(ProductionOrder.so_lenh.desc())
        .first()
    )
    start_seq = (int(last.so_lenh[-3:]) + 1) if last else 1

    # Auto-populate nv_theo_doi_id từ Quote nếu không truyền tường minh
    nv_theo_doi_id = data.nv_theo_doi_id
    if not nv_theo_doi_id:
        for soi_q in so.items:
            if soi_q.quote_item_id:
                qi = db.get(QuoteItem, soi_q.quote_item_id)
                if qi:
                    quote = db.get(Quote, qi.quote_id)
                    if quote and quote.nv_theo_doi_id:
                        nv_theo_doi_id = quote.nv_theo_doi_id
                        break

    created_orders = []
    for idx, soi in enumerate(so.items):
        effective_px_id = soi.phan_xuong_id or data.phan_xuong_id or so.phan_xuong_id
        kho_sx_id = _auto_kho_sx_id(db, effective_px_id, data.kho_sx_id)
        so_lenh = f"{prefix}{(start_seq + idx):03d}"
        order = ProductionOrder(
            so_lenh=so_lenh,
            ngay_lenh=today_date,
            sales_order_id=so.id,
            trang_thai="moi",
            ngay_hoan_thanh_ke_hoach=data.ngay_hoan_thanh_ke_hoach or so.ngay_giao_hang,
            phap_nhan_id=data.phap_nhan_id or so.phap_nhan_id,
            kho_sx_id=kho_sx_id,
            phan_xuong_id=effective_px_id,
            nv_theo_doi_id=nv_theo_doi_id,
            ghi_chu=data.ghi_chu,
            created_by=current_user.id,
        )
        qi = soi.quote_item
        _DEFAULT_THS = {3: 'B', 5: 'BC', 7: 'BCB'}

        def _s(field):
            v = getattr(soi, field, None)
            if v is None and qi is not None:
                v = getattr(qi, field, None)
            return v

        _so_lop = _s('so_lop') or 3
        _to_hop_song = _s('to_hop_song') or _DEFAULT_THS.get(_so_lop)

        item = ProductionOrderItem(
            product_id=soi.product_id,
            sales_order_item_id=soi.id,
            ten_hang=soi.ten_hang,
            so_luong_ke_hoach=soi.so_luong,
            dvt=soi.dvt,
            ngay_giao_hang=soi.ngay_giao_hang,
            gia_ban_muc_tieu=soi.don_gia,
            loai_thung=_s('loai_thung'),
            dai=_s('dai'), rong=_s('rong'), cao=_s('cao'),
            so_lop=_so_lop, to_hop_song=_to_hop_song,
            mat=_s('mat'), mat_dl=_s('mat_dl'),
            song_1=_s('song_1'), song_1_dl=_s('song_1_dl'),
            mat_1=_s('mat_1'), mat_1_dl=_s('mat_1_dl'),
            song_2=_s('song_2'), song_2_dl=_s('song_2_dl'),
            mat_2=_s('mat_2'), mat_2_dl=_s('mat_2_dl'),
            song_3=_s('song_3'), song_3_dl=_s('song_3_dl'),
            mat_3=_s('mat_3'), mat_3_dl=_s('mat_3_dl'),
            loai_in=_s('loai_in'), so_mau=_s('so_mau'),
            loai_lan=_s('loai_lan'),
            c_tham=_s('c_tham'), can_man=_s('can_man'),
            be_so_con=_s('be_so_con'),
            kho_tt=_s('kho_tt'), dai_tt=_s('dai_tt'),
        )
        order.items.append(item)
        db.add(order)
        created_orders.append(order)

    so.trang_thai = "dang_sx"
    db.flush()  # Chắc chắn tất cả INSERT chạy và DB gán ID trước khi commit
    order_ids = [o.id for o in created_orders]  # Thu thập ID khi objects còn "tươi"
    db.commit()

    # Load lại từng order với đầy đủ relationships sau commit
    return [_build_response(_load_order(oid, db), db) for oid in order_ids]


class BatchTanDungPayload(BaseModel):
    ids: list[int]
    tan_dung: bool = True


@router.patch("/batch-tan-dung")
def batch_set_tan_dung(
    payload: BatchTanDungPayload,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit")),
):
    if not payload.ids:
        return {"updated": 0}
    target_ids = list(payload.ids)
    if payload.tan_dung:
        conflict_ids: set[int] = set()
        mua_ngoai_rows = (
            db.query(ProductionOrder.id)
            .filter(ProductionOrder.id.in_(target_ids), ProductionOrder.trang_thai == "mua_ngoai")
            .all()
        )
        conflict_ids.update(r[0] for r in mua_ngoai_rows)
        plan_rows = (
            db.query(ProductionOrderItem.production_order_id)
            .join(ProductionPlanLine, ProductionPlanLine.production_order_item_id == ProductionOrderItem.id)
            .filter(
                ProductionOrderItem.production_order_id.in_(target_ids),
                ProductionPlanLine.trang_thai != "hoan_thanh",
            )
            .distinct()
            .all()
        )
        conflict_ids.update(r[0] for r in plan_rows)
        target_ids = [i for i in target_ids if i not in conflict_ids]
    if not target_ids:
        return {"updated": 0}
    db.query(ProductionOrder).filter(
        ProductionOrder.id.in_(target_ids)
    ).update({"tan_dung": payload.tan_dung}, synchronize_session=False)
    db.commit()
    return {"updated": len(target_ids)}


@router.post("", response_model=ProductionOrderResponse, status_code=201)
def create_order(
    data: ProductionOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("production_order.create")),
):
    service = ProductionOrderService(db)
    return service.create_production_order(data, current_user.id)


@router.put("/{order_id:int}", response_model=ProductionOrderResponse)
def update_order(
    order_id: int,
    data: ProductionOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit")),
):
    service = ProductionOrderService(db)
    return service.update_production_order(order_id, data)


@router.patch("/{order_id:int}/start", response_model=ProductionOrderResponse)
def start_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.start")),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai != "moi":
        raise HTTPException(status_code=400, detail=f"Lệnh đang ở '{order.trang_thai}', không thể bắt đầu")

    order.trang_thai = "dang_chay"
    order.ngay_bat_dau_thuc_te = date.today()
    db.commit()
    return _build_response(_load_order(order_id, db), db)


@router.patch("/{order_id:int}/complete", response_model=ProductionOrderResponse)
def complete_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.complete")),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai == "hoan_thanh":
        return _build_response(_load_order(order_id, db), db)
    if order.trang_thai not in ("moi", "dang_chay", "tam_dung"):
        raise HTTPException(status_code=400, detail=f"Không thể hoàn thành lệnh ở trạng thái '{order.trang_thai}'")

    order.trang_thai = "hoan_thanh"
    order.ngay_hoan_thanh_thuc_te = date.today()
    _sync_so_trang_thai(db, order)
    db.commit()
    return _build_response(_load_order(order_id, db), db)


class PauseOrderBody(BaseModel):
    gio_bat_dau_dung: str           # HH:MM
    ly_do: str = "khac"             # hong_may | het_nguyen_lieu | nghi_giai_lao | giao_ca | khac
    ghi_chu: str | None = None


class ResumeOrderBody(BaseModel):
    gio_tiep_tuc: str               # HH:MM


@router.patch("/{order_id:int}/pause", response_model=ProductionOrderResponse)
def pause_order(
    order_id: int,
    data: PauseOrderBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("production_order.edit", "production_order.start")),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai != "dang_chay":
        raise HTTPException(status_code=400, detail=f"Lệnh đang ở '{order.trang_thai}', không thể tạm dừng")

    from datetime import time as dt_time
    h, m = map(int, data.gio_bat_dau_dung.split(":"))
    log = MayDungLog(
        production_order_id=order_id,
        phan_xuong_id=order.phan_xuong_id,
        ngay=date.today(),
        gio_bat_dau_dung=dt_time(h, m),
        ly_do=data.ly_do,
        ghi_chu=data.ghi_chu,
        created_by=user.id,
    )
    db.add(log)
    order.trang_thai = "tam_dung"
    db.commit()
    return _build_response(_load_order(order_id, db), db)


@router.patch("/{order_id:int}/resume", response_model=ProductionOrderResponse)
def resume_order(
    order_id: int,
    data: ResumeOrderBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit", "production_order.start")),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai != "tam_dung":
        raise HTTPException(status_code=400, detail=f"Lệnh đang ở '{order.trang_thai}', không thể tiếp tục")

    from datetime import time as dt_time
    h, m = map(int, data.gio_tiep_tuc.split(":"))
    tiep_tuc = dt_time(h, m)

    log = (
        db.query(MayDungLog)
        .filter(MayDungLog.production_order_id == order_id, MayDungLog.gio_tiep_tuc.is_(None))
        .order_by(MayDungLog.id.desc())
        .first()
    )
    if log:
        log.gio_tiep_tuc = tiep_tuc
        bat_dau = log.gio_bat_dau_dung
        phut = (tiep_tuc.hour * 60 + tiep_tuc.minute) - (bat_dau.hour * 60 + bat_dau.minute)
        log.thoi_gian_dung = max(phut, 0)

    order.trang_thai = "dang_chay"
    db.commit()
    return _build_response(_load_order(order_id, db), db)


@router.patch("/{order_id:int}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.cancel")),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai in ("hoan_thanh", "huy"):
        raise HTTPException(status_code=400, detail="Không thể huỷ lệnh này")

    order.trang_thai = "huy"
    db.commit()
    return {"message": f"Đã huỷ lệnh {order.so_lenh}"}


@router.patch("/{order_id:int}/items/{item_id:int}/progress", response_model=ProductionOrderItemResponse)
def update_item_progress(
    order_id: int,
    item_id: int,
    data: UpdateItemProgress,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.start")),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai not in ("moi", "dang_chay"):
        raise HTTPException(status_code=400, detail="Lệnh không ở trạng thái có thể cập nhật")

    item = (
        db.query(ProductionOrderItem)
        .options(joinedload(ProductionOrderItem.product))
        .filter(
            ProductionOrderItem.id == item_id,
            ProductionOrderItem.production_order_id == order_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng sản phẩm")
    if data.so_luong_hoan_thanh > item.so_luong_ke_hoach:
        raise HTTPException(status_code=400, detail="Số lượng hoàn thành vượt quá kế hoạch")

    item.so_luong_hoan_thanh = data.so_luong_hoan_thanh
    db.commit()
    db.refresh(item)
    return ProductionOrderItemResponse(
        id=item.id,
        product_id=item.product_id,
        sales_order_item_id=item.sales_order_item_id,
        ten_hang=item.ten_hang,
        product=ProductShort.model_validate(item.product) if item.product else None,
        so_luong_ke_hoach=item.so_luong_ke_hoach,
        so_luong_hoan_thanh=item.so_luong_hoan_thanh,
        dvt=item.dvt,
        ngay_giao_hang=item.ngay_giao_hang,
        ghi_chu=item.ghi_chu,
    )


@router.patch("/{order_id:int}/items/{item_id:int}/sx-params", response_model=ProductionOrderResponse)
def update_item_sx_params(
    order_id: int,
    item_id: int,
    data: UpdateItemSxParams,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit", "production_order.start")),
):
    """Cập nhật thông số sản xuất (kết cấu giấy, chiều khổ).
    Không ảnh hưởng đến giá bán."""
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")

    item = (
        db.query(ProductionOrderItem)
        .filter(
            ProductionOrderItem.id == item_id,
            ProductionOrderItem.production_order_id == order_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng sản phẩm")

    fields = data.model_dump(exclude_none=True)
    for field, value in fields.items():
        setattr(item, field, value)

    db.commit()
    return _build_response(_load_order(order_id, db), db)


# ── Phiếu nhập phôi sóng ─────────────────────────────────────────────────────

class PhieuItemBody(BaseModel):
    production_order_item_id: int
    so_luong_ke_hoach: Decimal
    so_luong_thuc_te: Decimal | None = None
    so_luong_loi: Decimal | None = None
    chieu_kho: Decimal | None = None
    chieu_cat: Decimal | None = None
    so_tam: int | None = None
    ghi_chu: str | None = None


class PhieuBody(BaseModel):
    ngay: date
    ca: str | None = None
    ghi_chu: str | None = None
    gio_bat_dau: str | None = None   # HH:MM
    gio_ket_thuc: str | None = None  # HH:MM
    warehouse_id: int | None = None  # kho phôi sóng để cập nhật tồn kho
    items: list[PhieuItemBody] = []


def _generate_so_phieu(db: Session) -> str:
    today = date.today()
    prefix = f"PNPS-{today.strftime('%Y%m')}-"
    last = (
        db.query(PhieuNhapPhoiSong)
        .filter(PhieuNhapPhoiSong.so_phieu.like(f"{prefix}%"))
        .order_by(PhieuNhapPhoiSong.so_phieu.desc())
        .with_for_update()
        .first()
    )
    seq = (int(last.so_phieu[-4:]) + 1) if last else 1
    return f"{prefix}{seq:04d}"


def _phieu_to_dict(p: PhieuNhapPhoiSong) -> dict:
    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "production_order_id": p.production_order_id,
        "ngay": str(p.ngay),
        "ca": p.ca,
        "ghi_chu": p.ghi_chu,
        "gio_bat_dau": p.gio_bat_dau,
        "gio_ket_thuc": p.gio_ket_thuc,
        "session_id": p.session_id,
        "phoi_du_trang_thai": p.phoi_du_trang_thai,
        "phoi_du_ghi_chu": p.phoi_du_ghi_chu,
        "phoi_du_so_luong": float(p.phoi_du_so_luong) if p.phoi_du_so_luong is not None else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "items": [
            {
                "id": it.id,
                "production_order_item_id": it.production_order_item_id,
                "ten_hang": getattr(getattr(it, "production_order_item", None), "ten_hang", None),
                "so_lop": getattr(getattr(it, "production_order_item", None), "so_lop", None),
                "mat": getattr(getattr(it, "production_order_item", None), "mat", None),
                "mat_dl": getattr(getattr(it, "production_order_item", None), "mat_dl", None),
                "song_1": getattr(getattr(it, "production_order_item", None), "song_1", None),
                "song_1_dl": getattr(getattr(it, "production_order_item", None), "song_1_dl", None),
                "mat_1": getattr(getattr(it, "production_order_item", None), "mat_1", None),
                "mat_1_dl": getattr(getattr(it, "production_order_item", None), "mat_1_dl", None),
                "song_2": getattr(getattr(it, "production_order_item", None), "song_2", None),
                "song_2_dl": getattr(getattr(it, "production_order_item", None), "song_2_dl", None),
                "mat_2": getattr(getattr(it, "production_order_item", None), "mat_2", None),
                "mat_2_dl": getattr(getattr(it, "production_order_item", None), "mat_2_dl", None),
                "song_3": getattr(getattr(it, "production_order_item", None), "song_3", None),
                "song_3_dl": getattr(getattr(it, "production_order_item", None), "song_3_dl", None),
                "mat_3": getattr(getattr(it, "production_order_item", None), "mat_3", None),
                "mat_3_dl": getattr(getattr(it, "production_order_item", None), "mat_3_dl", None),
                "so_luong_ke_hoach": float(it.so_luong_ke_hoach),
                "so_luong_thuc_te": float(it.so_luong_thuc_te) if it.so_luong_thuc_te is not None else None,
                "so_luong_loi": float(it.so_luong_loi) if it.so_luong_loi is not None else None,
                "trang_thai_loi": it.trang_thai_loi,
                "chieu_kho": float(it.chieu_kho) if it.chieu_kho is not None else None,
                "chieu_cat": float(it.chieu_cat) if it.chieu_cat is not None else None,
                "so_tam": it.so_tam,
                "ghi_chu": it.ghi_chu,
            }
            for it in p.items
        ],
    }


@router.post("/{order_id:int}/phieu-nhap-phoi-song", status_code=201)
def create_phieu_nhap_phoi_song(
    order_id: int,
    data: PhieuBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("production_order.edit", "production_order.complete")),
):
    """Tạo phiếu nhập phôi sóng (1 phiếu/phiên, ghi nhận cả giờ bắt đầu và kết thúc)."""
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")

    # Auto-resolve kho phôi nguồn theo pháp nhân → xưởng CD1+CD2 cấu hình sẵn
    warehouse_id = data.warehouse_id
    if not warehouse_id:
        src_wh = _get_phoi_source_warehouse(
            db,
            phan_xuong_id=order.phan_xuong_id,
            phap_nhan_id=order.phap_nhan_id,
        )
        warehouse_id = src_wh.id if src_wh else None

    so_phieu = _generate_so_phieu(db)
    phieu = PhieuNhapPhoiSong(
        so_phieu=so_phieu,
        production_order_id=order_id,
        loai=None,
        ngay=data.ngay,
        ca=data.ca,
        ghi_chu=data.ghi_chu,
        gio_bat_dau=data.gio_bat_dau,
        gio_ket_thuc=data.gio_ket_thuc,
        warehouse_id=warehouse_id,
        created_by=current_user.id,
    )
    for it in data.items:
        phieu.items.append(PhieuNhapPhoiSongItem(
            production_order_item_id=it.production_order_item_id,
            so_luong_ke_hoach=it.so_luong_ke_hoach,
            so_luong_thuc_te=it.so_luong_thuc_te,
            so_luong_loi=it.so_luong_loi,
            trang_thai_loi='da_nhap_kho_ao' if it.so_luong_loi and it.so_luong_loi > 0 else None,
            chieu_kho=it.chieu_kho,
            chieu_cat=it.chieu_cat,
            so_tam=it.so_tam,
            ghi_chu=it.ghi_chu,
        ))
    db.add(phieu)

    # Khi tạo phiếu = kết thúc phiên sản xuất → chuyển lệnh sang hoàn thành
    if order.trang_thai in ("moi", "dang_chay"):
        if order.trang_thai == "moi":
            order.ngay_bat_dau_thuc_te = data.ngay
        order.trang_thai = "hoan_thanh"
        order.ngay_hoan_thanh_thuc_te = data.ngay
        _sync_so_trang_thai(db, order)

    db.commit()
    db.refresh(phieu)

    # D3: Auto-link phiếu vào phiên sản xuất đang active cùng phan_xuong
    # LSX của xưởng cd2 (Hóc Môn/Củ Chi) có phôi đến từ xưởng cd1 (Hoàng Gia/Nam Thuận)
    # → session thuộc xưởng cd1, cần fallback lên phoi_tu_phan_xuong_id
    if order.phan_xuong_id and phieu.session_id is None:
        from app.models.production import ProductionSession
        px = db.query(PhanXuong).filter(PhanXuong.id == order.phan_xuong_id).first()
        session_px_ids = [order.phan_xuong_id]
        if px and px.phoi_tu_phan_xuong_id:
            session_px_ids.append(px.phoi_tu_phan_xuong_id)
        active_session = (
            db.query(ProductionSession)
            .filter(
                ProductionSession.phan_xuong_id.in_(session_px_ids),
                ProductionSession.trang_thai != "da_chot",
            )
            .order_by(ProductionSession.id.desc())
            .first()
        )
        if active_session:
            phieu.session_id = active_session.id
            db.commit()

    # Auto-create DefectRecord cho từng item có phôi lỗi
    for it in phieu.items:
        if it.so_luong_loi and it.so_luong_loi > 0:
            auto_defect_record(
                db,
                ref_id=it.id,
                ref_type="phieu_nhap_phoi_song_item",
                khau="cd1",
                so_luong=it.so_luong_loi,
                created_by=current_user.id,
            )
    db.commit()

    # Cập nhật tồn kho phôi vào kho đã resolve
    if warehouse_id:
        from app.services.inventory_service import get_or_create_balance, nhap_balance, log_tx
        items = db.query(PhieuNhapPhoiSongItem).filter(
            PhieuNhapPhoiSongItem.phieu_id == phieu.id
        ).all()
        for it in items:
            sl_nhap = Decimal(str(it.so_tam or 0))
            if sl_nhap <= 0:
                continue
            poi = db.get(ProductionOrderItem, it.production_order_item_id)
            ten_hang = (poi.ten_hang if poi else None) or "Phôi sóng"
            # Tính đơn giá/tấm từ gia_ban_muc_tieu của lệnh SX
            don_gia = Decimal("0")
            if poi and poi.gia_ban_muc_tieu and poi.gia_ban_muc_tieu > 0:
                net_boxes = Decimal(str(it.so_luong_thuc_te or 0)) - Decimal(str(it.so_luong_loi or 0))
                if net_boxes > 0:
                    don_gia = (poi.gia_ban_muc_tieu * net_boxes) / sl_nhap
            balance = get_or_create_balance(db, warehouse_id, ten_hang=ten_hang, don_vi="Tấm")
            nhap_balance(balance, sl_nhap, don_gia)
            log_tx(db, warehouse_id, "NHAP_PHOI", sl_nhap, don_gia,
                   balance.ton_luong, "phieu_nhap_phoi_song", phieu.id, current_user.id)
        db.commit()

    return _phieu_to_dict(phieu)


def _generate_so_lenh_bu(db: Session, so_lenh_goc: str) -> str:
    """Tạo số lệnh bù: {so_lenh_goc}-B1, -B2, ..."""
    for i in range(1, 100):
        candidate = f"{so_lenh_goc}-B{i}"
        exists = db.query(ProductionOrder).filter(ProductionOrder.so_lenh == candidate).first()
        if not exists:
            return candidate
    raise HTTPException(status_code=400, detail="Không thể tạo số lệnh bù (quá nhiều lần bù)")


@router.post("/{order_id:int}/ngung-phoi-song", status_code=201)
def ngung_phoi_song_tao_lenh_bu(
    order_id: int,
    data: PhieuBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("production_order.edit")),
):
    """Ngưng SX phôi sóng sớm → tạo PhieuNhapPhoiSong cho thực tế + LSX bù cho phần còn lại."""
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai not in ("dang_chay", "tam_dung"):
        raise HTTPException(
            status_code=400,
            detail=f"Lệnh phải ở trạng thái 'dang_chay' hoặc 'tam_dung', hiện tại: '{order.trang_thai}'"
        )

    tong_ke_hoach = sum(Decimal(str(i.so_luong_ke_hoach)) for i in order.items)
    tong_thuc_te = sum(Decimal(str(it.so_luong_thuc_te or 0)) for it in data.items)

    if tong_thuc_te <= 0:
        raise HTTPException(status_code=400, detail="Phải nhập số lượng thực tế (> 0) trước khi ngưng")
    if tong_thuc_te >= tong_ke_hoach:
        raise HTTPException(
            status_code=400,
            detail="Số lượng đạt đã bằng/vượt kế hoạch — hãy dùng Hoàn thành thay vì Ngưng"
        )

    # Resolve kho phôi
    warehouse_id = data.warehouse_id
    if not warehouse_id:
        src_wh = _get_phoi_source_warehouse(
            db, phan_xuong_id=order.phan_xuong_id, phap_nhan_id=order.phap_nhan_id
        )
        warehouse_id = src_wh.id if src_wh else None

    # 1. Tạo phiếu nhập phôi sóng (số lượng thực tế)
    so_phieu = _generate_so_phieu(db)
    phieu = PhieuNhapPhoiSong(
        so_phieu=so_phieu,
        production_order_id=order_id,
        loai=None,
        ngay=data.ngay,
        ca=data.ca,
        ghi_chu=data.ghi_chu,
        gio_bat_dau=data.gio_bat_dau,
        gio_ket_thuc=data.gio_ket_thuc,
        warehouse_id=warehouse_id,
        created_by=current_user.id,
    )
    item_map = {it.production_order_item_id: it for it in data.items}
    for it in data.items:
        phieu.items.append(PhieuNhapPhoiSongItem(
            production_order_item_id=it.production_order_item_id,
            so_luong_ke_hoach=it.so_luong_ke_hoach,
            so_luong_thuc_te=it.so_luong_thuc_te,
            so_luong_loi=it.so_luong_loi,
            trang_thai_loi='da_nhap_kho_ao' if it.so_luong_loi and it.so_luong_loi > 0 else None,
            chieu_kho=it.chieu_kho,
            chieu_cat=it.chieu_cat,
            so_tam=it.so_tam,
            ghi_chu=it.ghi_chu,
        ))
    db.add(phieu)

    # 2. Tạo lệnh SX bù cho phần còn lại
    so_lenh_bu = _generate_so_lenh_bu(db, order.so_lenh)
    lenh_bu = ProductionOrder(
        so_lenh=so_lenh_bu,
        ngay_lenh=date.today(),
        sales_order_id=order.sales_order_id,
        trang_thai="moi",
        ngay_bat_dau_ke_hoach=order.ngay_bat_dau_ke_hoach,
        ngay_hoan_thanh_ke_hoach=order.ngay_hoan_thanh_ke_hoach,
        ghi_chu=order.ghi_chu,
        so_po_kh=order.so_po_kh,
        don_gia_noi_bo=order.don_gia_noi_bo,
        tan_dung=order.tan_dung,
        phan_xuong_id=order.phan_xuong_id,
        phap_nhan_id=order.phap_nhan_id,
        kho_sx_id=order.kho_sx_id,
        phoi_phan_xuong_id=order.phoi_phan_xuong_id,
        nv_theo_doi_id=order.nv_theo_doi_id,
        phieu_goc_id=order.id,
        created_by=current_user.id,
    )
    for orig_item in order.items:
        tt_item = item_map.get(orig_item.id)
        tt = Decimal(str(tt_item.so_luong_thuc_te or 0)) if tt_item else Decimal("0")
        con_lai = Decimal(str(orig_item.so_luong_ke_hoach)) - tt
        if con_lai <= 0:
            continue
        lenh_bu.items.append(ProductionOrderItem(
            sales_order_item_id=orig_item.sales_order_item_id,
            product_id=orig_item.product_id,
            ten_hang=orig_item.ten_hang,
            so_luong_ke_hoach=con_lai,
            so_luong_hoan_thanh=Decimal("0"),
            dvt=orig_item.dvt,
            ngay_giao_hang=orig_item.ngay_giao_hang,
            ghi_chu=orig_item.ghi_chu,
            loai_thung=orig_item.loai_thung,
            dai=orig_item.dai, rong=orig_item.rong, cao=orig_item.cao,
            so_lop=orig_item.so_lop,
            to_hop_song=orig_item.to_hop_song,
            mat=orig_item.mat, mat_dl=orig_item.mat_dl,
            song_1=orig_item.song_1, song_1_dl=orig_item.song_1_dl,
            mat_1=orig_item.mat_1, mat_1_dl=orig_item.mat_1_dl,
            song_2=orig_item.song_2, song_2_dl=orig_item.song_2_dl,
            mat_2=orig_item.mat_2, mat_2_dl=orig_item.mat_2_dl,
            song_3=orig_item.song_3, song_3_dl=orig_item.song_3_dl,
            mat_3=orig_item.mat_3, mat_3_dl=orig_item.mat_3_dl,
            loai_in=orig_item.loai_in, so_mau=orig_item.so_mau,
            loai_lan=orig_item.loai_lan, c_tham=orig_item.c_tham, can_man=orig_item.can_man,
            kho_tt=orig_item.kho_tt, dai_tt=orig_item.dai_tt,
            so_lan_cat=orig_item.so_lan_cat, be_so_con=orig_item.be_so_con,
            qccl=orig_item.qccl, dien_tich=orig_item.dien_tich,
            gia_ban_muc_tieu=orig_item.gia_ban_muc_tieu,
            mua_phoi_ngoai=orig_item.mua_phoi_ngoai,
        ))
    db.add(lenh_bu)

    # 3. Đánh dấu lệnh gốc hoàn thành
    order.trang_thai = "hoan_thanh"
    order.ngay_hoan_thanh_thuc_te = data.ngay
    _sync_so_trang_thai(db, order)

    db.commit()
    db.refresh(phieu)
    db.refresh(lenh_bu)

    # Auto-create DefectRecord
    for it in phieu.items:
        if it.so_luong_loi and it.so_luong_loi > 0:
            auto_defect_record(
                db, ref_id=it.id, ref_type="phieu_nhap_phoi_song_item",
                khau="cd1", so_luong=it.so_luong_loi, created_by=current_user.id,
            )
    db.commit()

    # Cập nhật tồn kho phôi
    if warehouse_id:
        from app.services.inventory_service import get_or_create_balance, nhap_balance, log_tx
        items_db = db.query(PhieuNhapPhoiSongItem).filter(
            PhieuNhapPhoiSongItem.phieu_id == phieu.id
        ).all()
        for it in items_db:
            sl_nhap = Decimal(str(it.so_tam or 0))
            if sl_nhap <= 0:
                continue
            poi = db.get(ProductionOrderItem, it.production_order_item_id)
            ten_hang = (poi.ten_hang if poi else None) or "Phôi sóng"
            don_gia = Decimal("0")
            if poi and poi.gia_ban_muc_tieu and poi.gia_ban_muc_tieu > 0:
                net_boxes = Decimal(str(it.so_luong_thuc_te or 0)) - Decimal(str(it.so_luong_loi or 0))
                if net_boxes > 0:
                    don_gia = (poi.gia_ban_muc_tieu * net_boxes) / sl_nhap
            balance = get_or_create_balance(db, warehouse_id, ten_hang=ten_hang, don_vi="Tấm")
            nhap_balance(balance, sl_nhap, don_gia)
            log_tx(db, warehouse_id, "NHAP_PHOI", sl_nhap, don_gia,
                   balance.ton_luong, "phieu_nhap_phoi_song", phieu.id, current_user.id)
        db.commit()

    return {
        "lsx_goc": _build_response(_load_order(order_id, db), db),
        "lsx_bu": _build_response(_load_order(lenh_bu.id, db), db),
        "phieu_nhap": _phieu_to_dict(phieu),
    }


@router.get("/phieu-nhap-phoi-song")
def list_all_phieu_nhap_phoi_song(
    tu_ngay: date | None = None,
    den_ngay: date | None = None,
    production_order_id: int | None = None,
    warehouse_id: int | None = None,
    phan_xuong_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách tất cả phiếu nhập phôi sóng (toàn hệ thống)."""
    q = (
        db.query(PhieuNhapPhoiSong)
        .options(
            joinedload(PhieuNhapPhoiSong.items).joinedload(PhieuNhapPhoiSongItem.production_order_item),
            joinedload(PhieuNhapPhoiSong.production_order),
            joinedload(PhieuNhapPhoiSong.warehouse),
            joinedload(PhieuNhapPhoiSong.creator),
            joinedload(PhieuNhapPhoiSong.session),
        )
    )
    if tu_ngay:
        q = q.filter(PhieuNhapPhoiSong.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuNhapPhoiSong.ngay <= den_ngay)
    if production_order_id:
        q = q.filter(PhieuNhapPhoiSong.production_order_id == production_order_id)
    if warehouse_id:
        q = q.filter(PhieuNhapPhoiSong.warehouse_id == warehouse_id)
    if phan_xuong_id:
        subq = db.query(ProductionOrder.id).filter(ProductionOrder.phan_xuong_id == phan_xuong_id)
        q = q.filter(PhieuNhapPhoiSong.production_order_id.in_(subq))
    phieus = q.order_by(PhieuNhapPhoiSong.ngay.desc(), PhieuNhapPhoiSong.id.desc()).all()

    result = []
    for p in phieus:
        base = _phieu_to_dict(p)
        base["so_lenh"] = p.production_order.so_lenh if p.production_order else None
        base["phan_xuong_id"] = p.production_order.phan_xuong_id if p.production_order else None
        base["ten_kho"] = p.warehouse.ten_kho if p.warehouse else None
        base["created_by_name"] = (
            getattr(p.creator, "ho_ten", None) or getattr(p.creator, "username", None)
            if p.creator else None
        )
        items = base.get("items", [])
        base["tong_so_tam"] = sum(it.get("so_tam") or 0 for it in items)
        base["tong_so_luong_thuc_te"] = sum(it.get("so_luong_thuc_te") or 0 for it in items)
        base["tong_so_luong_loi"] = sum(it.get("so_luong_loi") or 0 for it in items)
        base["session_ten_phien"] = p.session.ten_phien if p.session else None
        result.append(base)
    return result


@router.get("/{order_id:int}/phieu-nhap-phoi-song")
def list_phieu_nhap_phoi_song(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách phiếu nhập phôi sóng của một lệnh SX."""
    phieus = (
        db.query(PhieuNhapPhoiSong)
        .filter(PhieuNhapPhoiSong.production_order_id == order_id)
        .options(
            joinedload(PhieuNhapPhoiSong.items).joinedload(PhieuNhapPhoiSongItem.production_order_item),
            joinedload(PhieuNhapPhoiSong.warehouse),
        )
        .order_by(PhieuNhapPhoiSong.created_at.desc())
        .all()
    )
    result = []
    for p in phieus:
        d = _phieu_to_dict(p)
        d["ten_kho"] = p.warehouse.ten_kho if p.warehouse else None
        result.append(d)
    return result


class XuLyPhoiDuItem(BaseModel):
    so_luong: float
    loai_xu_ly: str  # 'giao_sx' | 'giao_khach' | 'da_nhap_kho_tan_dung' | 'ban_phe'


class XuLyPhoiDuBody(BaseModel):
    items: list[XuLyPhoiDuItem]
    ghi_chu: str | None = None


@router.post("/phieu/{phieu_id:int}/nhap-phoi-du-kho", status_code=200)
def xu_ly_phoi_du(
    phieu_id: int,
    data: XuLyPhoiDuBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xử lý phôi dư: hỗ trợ split nhiều dòng; tan_dung/ban_phe tạo inventory tx; giao_sx/giao_khach chỉ đánh dấu."""
    phieu = (
        db.query(PhieuNhapPhoiSong)
        .options(
            joinedload(PhieuNhapPhoiSong.production_order),
            joinedload(PhieuNhapPhoiSong.items),
        )
        .filter(PhieuNhapPhoiSong.id == phieu_id)
        .first()
    )
    if not phieu:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập phôi")

    from app.models.inventory import InventoryTransaction
    from app.services.inventory_service import get_or_create_balance, nhap_balance, log_tx

    order = phieu.production_order
    phan_xuong_id = order.phan_xuong_id if order else None
    item0 = phieu.items[0] if phieu.items else None
    ten_hang = (
        f"{int(item0.chieu_kho)}x{int(item0.chieu_cat)}"
        if item0 and item0.chieu_kho and item0.chieu_cat
        else "Phôi dư"
    )

    # Reverse tất cả transaction phôi dư cũ trước khi ghi lại từ đầu
    _PHOI_DU_TX_TYPES = {"NHAP_PHOI_DU", "NHAP_PHOI_LOI"}
    old_txs = (
        db.query(InventoryTransaction)
        .filter(
            InventoryTransaction.chung_tu_loai == "phieu_nhap_phoi_song",
            InventoryTransaction.chung_tu_id == phieu_id,
            InventoryTransaction.loai_giao_dich.in_(_PHOI_DU_TX_TYPES),
        )
        .all()
    )
    if old_txs and phan_xuong_id:
        for tx in old_txs:
            bal_rev = get_or_create_balance(db, tx.warehouse_id, ten_hang=ten_hang, don_vi="Tấm")
            bal_rev.ton_luong = max(Decimal("0"), bal_rev.ton_luong - Decimal(str(tx.so_luong)))
            db.delete(tx)

    phieu.phoi_du_so_luong = Decimal("0")

    # Xử lý từng dòng trong split
    for split_item in data.items:
        sl = Decimal(str(split_item.so_luong))
        if sl <= 0:
            continue

        if split_item.loai_xu_ly in ("da_nhap_kho_tan_dung", "ban_phe") and not phan_xuong_id:
            raise HTTPException(status_code=400, detail="Lệnh SX chưa gắn xưởng.")

        if split_item.loai_xu_ly == "da_nhap_kho_tan_dung":
            kho_td = _get_or_create_workshop_warehouse(db, phan_xuong_id, "TAN_DUNG")
            bal_td = get_or_create_balance(db, kho_td.id, ten_hang=ten_hang, don_vi="Tấm")
            nhap_balance(bal_td, sl, Decimal("0"))
            log_tx(db, kho_td.id, "NHAP_PHOI_DU", sl, Decimal("0"),
                   bal_td.ton_luong, "phieu_nhap_phoi_song", phieu_id,
                   created_by=current_user.id, ghi_chu=data.ghi_chu)

        elif split_item.loai_xu_ly == "ban_phe":
            kho_pl = _get_or_create_workshop_warehouse(db, phan_xuong_id, "PHOI_LOI")
            bal_pl = get_or_create_balance(db, kho_pl.id, ten_hang=ten_hang, don_vi="Tấm")
            nhap_balance(bal_pl, sl, Decimal("0"))
            log_tx(db, kho_pl.id, "NHAP_PHOI_LOI", sl, Decimal("0"),
                   bal_pl.ton_luong, "phieu_nhap_phoi_song", phieu_id,
                   created_by=current_user.id, ghi_chu=data.ghi_chu)
        # giao_sx / giao_khach: mark only — phôi vẫn trong kho phôi

    new_processed = sum(Decimal(str(it.so_luong)) for it in data.items if it.so_luong > 0)
    phieu.phoi_du_so_luong = new_processed
    phieu.phoi_du_ghi_chu = data.ghi_chu

    # Tính remaining theo đơn vị phôi
    total_so_tam  = sum(Decimal(str(it.so_tam or 0)) for it in phieu.items)
    total_kh_thg  = sum(Decimal(str(it.so_luong_ke_hoach)) for it in phieu.items)
    total_tt_thg  = sum(Decimal(str(it.so_luong_thuc_te or 0)) for it in phieu.items)
    total_kh_phoi = (total_kh_thg * total_so_tam / total_tt_thg
                     if total_tt_thg > 0 else Decimal("0"))
    total_excess_phoi = total_so_tam - total_kh_phoi
    remaining = total_excess_phoi - new_processed

    if remaining <= Decimal("0.001"):
        # Xác định trạng thái: 1 loại → dùng loại đó; nhiều loại → 'mixed'
        active_types = {it.loai_xu_ly for it in data.items if it.so_luong > 0}
        phieu.phoi_du_trang_thai = active_types.pop() if len(active_types) == 1 else "mixed"

    db.commit()
    db.refresh(phieu)
    return _phieu_to_dict(phieu)


@router.delete("/{order_id:int}/phieu-nhap-phoi-song/{phieu_id:int}")
def delete_phieu_nhap_phoi_song(
    order_id: int,
    phieu_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.cancel")),
):
    phieu = db.query(PhieuNhapPhoiSong).filter(
        PhieuNhapPhoiSong.id == phieu_id,
        PhieuNhapPhoiSong.production_order_id == order_id,
    ).first()
    if not phieu:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập phôi")

    # Đảo ngược tồn kho nếu phiếu đã cập nhật inventory
    if phieu.warehouse_id:
        from app.services.inventory_service import get_or_create_balance, xuat_balance, log_tx
        for it in phieu.items:
            sl_nhap = Decimal(str(it.so_luong_thuc_te or 0)) - Decimal(str(it.so_luong_loi or 0))
            if sl_nhap <= 0:
                continue
            if it.chieu_kho and it.chieu_cat:
                ten_hang = f"{int(it.chieu_kho)}x{int(it.chieu_cat)}"
            else:
                poi = db.get(ProductionOrderItem, it.production_order_item_id)
                ten_hang = (poi.ten_hang if poi else None) or "Phôi sóng"
            balance = get_or_create_balance(db, phieu.warehouse_id, ten_hang=ten_hang, don_vi="Tấm", lock=True)
            if balance.ton_luong < sl_nhap:
                raise HTTPException(
                    status_code=400,
                    detail=f"Không thể xóa phiếu: tồn kho {ten_hang} ({float(balance.ton_luong):g}) "
                           f"thấp hơn số lượng cần hoàn ({float(sl_nhap):g})"
                )
            xuat_balance(balance, sl_nhap, ten_hang)
            log_tx(db, phieu.warehouse_id, "XUAT_PHOI_HOAN", sl_nhap,
                   balance.don_gia_binh_quan, balance.ton_luong,
                   "phieu_nhap_phoi_song", phieu.id, current_user.id)

    db.delete(phieu)
    db.commit()
    return {"ok": True}


# ── Chuyển lệnh SX sang mua phôi ngoài ──────────────────────────────────────

_KHO_DE_XUAT_MUA_NGOAI = 2000  # mm — kho 1 con >= 2m → đề xuất mua phôi ngoài


@router.patch("/{order_id:int}/chuyen-mua-phoi")
def chuyen_mua_phoi(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit")),
):
    """Chuyển lệnh SX sang trạng thái mua phôi ngoài.
    Kế hoạch dùng khi phôi quá khổ hoặc định lượng không tự sản xuất được.
    Mua hàng sẽ vào MuaGiayPage để lên đơn PO."""
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai not in ("moi", "dang_chay"):
        raise HTTPException(
            status_code=400,
            detail=f"Lệnh đang ở '{order.trang_thai}', không thể chuyển sang mua phôi ngoài"
        )
    if order.tan_dung:
        raise HTTPException(
            status_code=400,
            detail="Lệnh đang ở hướng 'Tận dụng phôi', không thể chuyển sang Mua phôi ngoài",
        )
    active_plan_count = (
        db.query(ProductionPlanLine)
        .join(ProductionOrderItem, ProductionPlanLine.production_order_item_id == ProductionOrderItem.id)
        .filter(
            ProductionOrderItem.production_order_id == order_id,
            ProductionPlanLine.trang_thai != "hoan_thanh",
        )
        .count()
    )
    if active_plan_count:
        raise HTTPException(
            status_code=400,
            detail="Lệnh đang ở hướng 'Kế hoạch chờ', không thể chuyển sang Mua phôi ngoài",
        )

    order.trang_thai = "mua_ngoai"

    items = (
        db.query(ProductionOrderItem)
        .filter(ProductionOrderItem.production_order_id == order_id)
        .all()
    )
    for item in items:
        item.mua_phoi_ngoai = True
        # Nếu có ProductionPlanLine liên kết → set cờ luôn để khsx-can-phoi-ngoai nhận
        plan_lines = (
            db.query(ProductionPlanLine)
            .filter(ProductionPlanLine.production_order_item_id == item.id)
            .all()
        )
        for pl in plan_lines:
            pl.mua_phoi_ngoai = True

    db.commit()
    return {"ok": True, "trang_thai": "mua_ngoai", "so_lenh": order.so_lenh}


@router.patch("/{order_id:int}/huy-mua-phoi")
def huy_mua_phoi(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit")),
):
    """Hủy mua phôi ngoài, đưa lệnh về trạng thái 'mới'.
    Chỉ cho phép nếu chưa có phiếu nhập phôi nào cho lệnh này."""
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai != "mua_ngoai":
        raise HTTPException(
            status_code=400,
            detail=f"Lệnh đang ở '{order.trang_thai}', không phải 'mua_ngoai'",
        )
    has_phieu = (
        db.query(PhieuNhapPhoiSong)
        .filter(PhieuNhapPhoiSong.production_order_id == order_id)
        .first()
    )
    if has_phieu:
        raise HTTPException(
            status_code=400,
            detail="Lệnh đã có phiếu nhập phôi — liên hệ bộ phận kho để xử lý trước",
        )

    order.trang_thai = "moi"

    items = (
        db.query(ProductionOrderItem)
        .filter(ProductionOrderItem.production_order_id == order_id)
        .all()
    )
    for item in items:
        item.mua_phoi_ngoai = False
        plan_lines = (
            db.query(ProductionPlanLine)
            .filter(ProductionPlanLine.production_order_item_id == item.id)
            .all()
        )
        for pl in plan_lines:
            pl.mua_phoi_ngoai = False

    db.commit()
    return {"ok": True, "trang_thai": "moi", "so_lenh": order.so_lenh}


# ── Đẩy lệnh sang hệ thống CD2 (Công Đoạn 2) ────────────────────────────────

@router.post("/{order_id:int}/push-to-cd2")
def push_to_cd2(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("production_order.edit")),
):
    """Đẩy lệnh sản xuất sang hệ thống CD2 (hàng đợi máy in)."""
    order = _load_order(order_id, db)

    # Lấy số lượng thực tế từ phiếu nhập phôi sóng (nếu có)
    phieus = (
        db.query(PhieuNhapPhoiSong)
        .filter(PhieuNhapPhoiSong.production_order_id == order_id)
        .options(joinedload(PhieuNhapPhoiSong.items))
        .all()
    )

    so_luong: float | None = None
    for phieu in phieus:
        for it in phieu.items:
            if it.so_luong_thuc_te is not None:
                so_luong = (so_luong or 0) + float(it.so_luong_thuc_te)

    first_item = order.items[0] if order.items else None

    # Fallback: dùng số lượng kế hoạch nếu chưa có phiếu
    if so_luong is None and first_item:
        so_luong = float(first_item.so_luong_ke_hoach)

    # Tính quy cách: ưu tiên kho_tt × dai_tt, fallback rong × dai
    quy_cach: str | None = None
    if first_item:
        kho = first_item.kho_tt
        dai = first_item.dai_tt
        if kho and dai:
            quy_cach = f"{int(kho)}x{int(dai)}"
        elif first_item.rong and first_item.dai:
            quy_cach = f"{int(first_item.rong)}x{int(first_item.dai)}"

    kh = order.sales_order.customer if order.sales_order else None

    dhcho_payload = {
        "so_lsx": order.so_lenh,
        "ma_kh": kh.ma_kh if kh else None,
        "ten_hang": first_item.ten_hang if first_item else None,
        "quy_cach": quy_cach,
        "ngay_lsx": str(order.ngay_lenh),
        "loai": first_item.loai_thung if first_item else None,
        "so_luong": so_luong,
        "in_may": first_item.loai_in if first_item else None,
        "so_kh": order.sales_order.so_don if order.sales_order else None,
        "ngay_kh": str(order.ngay_hoan_thanh_ke_hoach) if order.ngay_hoan_thanh_ke_hoach else None,
        "ghi_chu": order.ghi_chu,
    }

    try:
        from app.services.cd2_service import cd2_login, cd2_create_dhcho
        token = cd2_login()
        result = cd2_create_dhcho(token, dhcho_payload)
        order.trang_thai = "dang_chay"
        db.commit()
        return {"ok": True, "data": result, "payload_sent": dhcho_payload}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Lỗi kết nối CD2: {exc}")


# ─── PRINT ───────────────────────────────────────────────────────────────────

def _fmt_date(d) -> str:
    if not d:
        return ""
    return d.strftime("%d/%m/%Y") if hasattr(d, "strftime") else str(d)


def _fmt_num(v, decimals: int = 0) -> str:
    if v is None:
        return ""
    try:
        f = float(v)
        if decimals == 0:
            return f"{int(f):,}"
        return f"{f:,.{decimals}f}"
    except (TypeError, ValueError):
        return str(v)


def _ket_cau(item: ProductionOrderItem) -> str:
    layers = [
        item.mat, item.song_1, item.mat_1,
        item.song_2, item.mat_2, item.song_3, item.mat_3,
    ]
    return "/".join(la for la in layers if la)


def _cong_doan(item: ProductionOrderItem) -> str:
    parts = []
    if item.loai_in == "flexo":
        label = "Flexo"
        if item.so_mau:
            label += f" {item.so_mau} màu"
        parts.append(label)
    elif item.loai_in == "ky_thuat_so":
        parts.append("In KTS")
    else:
        parts.append("Không in")
    if item.loai_lan:
        parts.append(item.loai_lan)
    return " / ".join(parts)


@router.get("/{order_id}/print", response_class=HTMLResponse)
def print_production_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lsx = (
        db.query(ProductionOrder)
        .options(selectinload(ProductionOrder.items))
        .filter(ProductionOrder.id == order_id)
        .first()
    )
    if not lsx:
        raise HTTPException(404, "Không tìm thấy lệnh sản xuất")

    # ── Resolve related objects ──────────────────────────────────────────────
    so = db.get(SalesOrder, lsx.sales_order_id) if lsx.sales_order_id else None
    customer = db.get(Customer, so.customer_id) if so and so.customer_id else None
    phap_nhan = db.get(PhapNhan, lsx.phap_nhan_id) if lsx.phap_nhan_id else None
    phan_xuong = db.get(PhanXuong, lsx.phan_xuong_id) if lsx.phan_xuong_id else None
    nv = db.get(User, lsx.nv_theo_doi_id) if lsx.nv_theo_doi_id else None
    creator = db.get(User, lsx.created_by) if lsx.created_by else None

    # Build product ma_amis lookup {product_id: ma_amis}
    product_ids = [it.product_id for it in lsx.items if it.product_id]
    products_map: dict[int, str] = {}
    if product_ids:
        rows = db.query(Product.id, Product.ma_amis).filter(Product.id.in_(product_ids)).all()
        products_map = {r.id: (r.ma_amis or "") for r in rows}

    # ── Header values ────────────────────────────────────────────────────────
    ten_phap_nhan = phap_nhan.ten_phap_nhan if phap_nhan else (phan_xuong.ten_phan_xuong if phan_xuong else "")
    ten_khach = customer.ten_viet_tat if customer else ""
    so_po = lsx.so_po_kh or (so.so_po_kh if so else "") or ""
    so_don_hien_thi = so.so_don if so else ""
    nv_theo_doi = (nv.ho_ten if nv else "") or (creator.ho_ten if creator else "")
    ngay_giao_dau = _fmt_date(lsx.ngay_hoan_thanh_ke_hoach)
    tong_sl = sum(float(it.so_luong_ke_hoach or 0) for it in lsx.items)
    so_dong = len(lsx.items)

    h = _html_mod.escape

    # ── Detail rows ──────────────────────────────────────────────────────────
    rows_html = ""
    for i, it in enumerate(lsx.items, 1):
        ma_np = products_map.get(it.product_id or 0, "")
        ket_cau = _ket_cau(it)
        cong_doan = _cong_doan(it)
        ktu = f"{_fmt_num(it.dai, 1)} × {_fmt_num(it.rong, 1)} × {_fmt_num(it.cao, 1)}" if any([it.dai, it.rong, it.cao]) else ""
        rows_html += f"""
        <tr>
          <td class="center">{i}</td>
          <td class="center">{h(ma_np)}</td>
          <td>{h(it.ten_hang or "")}</td>
          <td class="center">{h(it.loai_thung or "")}</td>
          <td class="center">{it.so_lop or ""}</td>
          <td class="center">{h(it.to_hop_song or "")}</td>
          <td class="center" style="font-size:9pt">{h(ket_cau)}</td>
          <td class="center">{_fmt_num(it.dai, 1)}</td>
          <td class="center">{_fmt_num(it.rong, 1)}</td>
          <td class="center">{_fmt_num(it.cao, 1)}</td>
          <td style="font-size:9pt">{h(cong_doan)}</td>
          <td class="right">{_fmt_num(it.so_luong_ke_hoach)}</td>
          <td class="center">{_fmt_date(it.ngay_giao_hang)}</td>
          <td style="font-size:9pt">{h(it.ghi_chu or "")}</td>
        </tr>"""

    so_lenh_escaped = h(lsx.so_lenh or "")
    page = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>LSX {so_lenh_escaped}</title>
<style>
  @page {{ size: A4 landscape; margin: 10mm 12mm; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Times New Roman', serif; font-size: 11pt; color: #111; line-height: 1.5; }}
  @media print {{ .no-print {{ display: none !important; }} }}

  .hdr {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1B5E20; padding-bottom: 8px; margin-bottom: 10px; }}
  .co-name {{ font-size: 13pt; font-weight: bold; color: #1B5E20; text-transform: uppercase; }}
  .co-info {{ font-size: 9pt; color: #444; margin-top: 3px; line-height: 1.5; }}
  .ttl {{ text-align: center; }}
  .ttl h2 {{ font-size: 18pt; font-weight: bold; letter-spacing: 2px; }}
  .ttl .no {{ font-size: 9.5pt; color: #444; margin-top: 4px; }}

  .section-lbl {{ font-weight: bold; font-size: 10pt; margin: 10px 0 4px; color: #1B5E20; text-transform: uppercase; letter-spacing: 1px; }}
  .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0 30px; border: 1px solid #ccc; padding: 8px 12px; border-radius: 3px; margin-bottom: 10px; font-size: 10.5pt; }}
  .r {{ display: flex; align-items: baseline; margin: 2px 0; }}
  .lbl {{ min-width: 155px; font-weight: bold; flex-shrink: 0; }}
  .val {{ flex: 1; border-bottom: 1px dotted #aaa; padding-left: 4px; min-height: 1.3em; }}
  .info-footer {{ display: flex; gap: 30px; font-size: 10.5pt; margin-bottom: 6px; }}
  .info-footer .r {{ flex: 1; }}

  table {{ width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 4px; }}
  table th {{ background: #1B5E20; color: #fff; padding: 5px 4px; border: 1px solid #888; text-align: center; font-size: 9.5pt; }}
  table td {{ border: 1px solid #ccc; padding: 4px 5px; vertical-align: middle; }}
  .total-row td {{ font-weight: bold; background: #E8F5E9; }}
  .center {{ text-align: center; }}
  .right {{ text-align: right; }}

  .sig {{ width: 100%; border-collapse: collapse; margin-top: 28px; }}
  .sig td {{ border: none; text-align: center; vertical-align: top; width: 25%; }}
  .s-title {{ font-weight: bold; }}
  .s-sub {{ font-style: italic; font-size: 8.5pt; color: #555; }}
  .s-gap {{ height: 45px; }}
</style>
</head>
<body>

<div class="no-print" style="padding:10px;background:#f0f0f0;display:flex;gap:10px;margin-bottom:8px">
  <button onclick="window.print()" style="padding:7px 18px;background:#1B5E20;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ In lệnh SX</button>
  <button onclick="window.close()" style="padding:7px 14px;border:1px solid #ccc;border-radius:4px;cursor:pointer">Đóng</button>
</div>

<div class="hdr">
  <div>
    <div class="co-name">{h(ten_phap_nhan)}</div>
    <div class="co-info">Bộ phận sản xuất</div>
  </div>
  <div class="ttl">
    <h2>LỆNH SẢN XUẤT</h2>
    <div class="no">Số: <strong>{so_lenh_escaped}</strong> &nbsp;|&nbsp; Ngày: {_fmt_date(lsx.ngay_lenh)}</div>
  </div>
  <div style="text-align:right;font-size:9.5pt;color:#444">
    <div>Trạng thái: <strong>{h(lsx.trang_thai or "")}</strong></div>
  </div>
</div>

<div class="section-lbl">Phần I. Thông tin đơn hàng</div>
<div class="info-grid">
  <div class="r"><span class="lbl">Số đơn hàng:</span><span class="val"><strong>{h(so_don_hien_thi)}</strong></span></div>
  <div class="r"><span class="lbl">Ngày HT kế hoạch:</span><span class="val"><strong>{ngay_giao_dau}</strong></span></div>
  <div class="r"><span class="lbl">Bên bán (Xưởng):</span><span class="val">{h(ten_phap_nhan)}</span></div>
  <div class="r"><span class="lbl">Bên mua (Khách hàng):</span><span class="val"><strong>{h(ten_khach)}</strong></span></div>
  <div class="r"><span class="lbl">Số PO khách hàng:</span><span class="val">{h(so_po)}</span></div>
  <div class="r"><span class="lbl">Nhân viên theo dõi:</span><span class="val">{h(nv_theo_doi)}</span></div>
  <div class="r"><span class="lbl">Số mã sản phẩm:</span><span class="val">{so_dong}</span></div>
  <div class="r"><span class="lbl">Tổng số lượng:</span><span class="val"><strong>{_fmt_num(tong_sl)} thùng</strong></span></div>
</div>
{"<div class='r' style='margin-bottom:8px;font-size:10.5pt'><span class='lbl' style='min-width:155px;font-weight:bold'>Ghi chú:</span><span class='val' style='border-bottom:1px dotted #aaa;padding-left:4px'>" + h(lsx.ghi_chu or "") + "</span></div>" if lsx.ghi_chu else ""}

<div class="section-lbl">Phần II. Chi tiết lệnh đặt hàng</div>
<table>
  <thead>
    <tr>
      <th style="width:38px">STT</th>
      <th style="width:70px">Mã NP</th>
      <th style="min-width:130px">Tên sản phẩm</th>
      <th style="width:55px">Kiểu</th>
      <th style="width:40px">Lớp</th>
      <th style="width:50px">Sóng</th>
      <th style="width:100px">Kết cấu</th>
      <th style="width:42px">D<br><small>(mm)</small></th>
      <th style="width:42px">R<br><small>(mm)</small></th>
      <th style="width:42px">C<br><small>(mm)</small></th>
      <th style="width:110px">Công đoạn</th>
      <th style="width:75px">Số lượng<br><small>(thùng)</small></th>
      <th style="width:80px">Ngày giao</th>
      <th style="min-width:80px">Ghi chú</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
    <tr class="total-row">
      <td colspan="11" class="right">TỔNG CỘNG</td>
      <td class="right">{_fmt_num(tong_sl)}</td>
      <td colspan="2"></td>
    </tr>
  </tbody>
</table>

<table class="sig">
  <tr>
    <td>
      <div class="s-title">Giám đốc</div>
      <div class="s-sub">(Ký, họ tên, đóng dấu)</div>
      <div class="s-gap"></div>
    </td>
    <td>
      <div class="s-title">Quản đốc xưởng</div>
      <div class="s-sub">(Ký, họ tên)</div>
      <div class="s-gap"></div>
    </td>
    <td>
      <div class="s-title">Nhân viên theo dõi</div>
      <div class="s-sub">(Ký, họ tên)</div>
      <div class="s-gap"></div>
      <div>{h(nv_theo_doi)}</div>
    </td>
    <td>
      <div class="s-title">Người lập phiếu</div>
      <div class="s-sub">(Ký, họ tên)</div>
      <div class="s-gap"></div>
      <div>{h(creator.ho_ten if creator else "")}</div>
    </td>
  </tr>
</table>

</body>
</html>"""

    return HTMLResponse(content=page)
