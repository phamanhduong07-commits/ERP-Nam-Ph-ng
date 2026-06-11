from datetime import date
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PhanXuong
from app.models.sales import SalesOrder, SalesOrderItem, Quote, QuoteItem
from app.services.inventory_service import (
    get_workshop_warehouse as _get_workshop_warehouse,
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

router = APIRouter(prefix="/api/production-orders", tags=["production-orders"])


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
    current_user: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    service = ProductionOrderService(db)
    return service.create_production_order(data, current_user.id)


@router.put("/{order_id:int}", response_model=ProductionOrderResponse)
def update_order(
    order_id: int,
    data: ProductionOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = ProductionOrderService(db)
    return service.update_production_order(order_id, data)


@router.patch("/{order_id:int}/start", response_model=ProductionOrderResponse)
def start_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
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
    user: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    phieus = q.order_by(PhieuNhapPhoiSong.ngay.desc(), PhieuNhapPhoiSong.id.desc()).all()

    result = []
    for p in phieus:
        base = _phieu_to_dict(p)
        base["so_lenh"] = p.production_order.so_lenh if p.production_order else None
        base["ten_kho"] = p.warehouse.ten_kho if p.warehouse else None
        base["created_by_name"] = (
            getattr(p.creator, "ho_ten", None) or getattr(p.creator, "username", None)
            if p.creator else None
        )
        items = base.get("items", [])
        base["tong_so_tam"] = sum(it.get("so_tam") or 0 for it in items)
        base["tong_so_luong_thuc_te"] = sum(it.get("so_luong_thuc_te") or 0 for it in items)
        base["tong_so_luong_loi"] = sum(it.get("so_luong_loi") or 0 for it in items)
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


@router.delete("/{order_id:int}/phieu-nhap-phoi-song/{phieu_id:int}")
def delete_phieu_nhap_phoi_song(
    order_id: int,
    phieu_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
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


# ── Đẩy lệnh sang hệ thống CD2 (Công Đoạn 2) ────────────────────────────────

@router.post("/{order_id:int}/push-to-cd2")
def push_to_cd2(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
