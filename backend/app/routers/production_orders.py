from datetime import date, datetime
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import cast, Date
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Product, PhanXuong, Warehouse
from app.models.sales import SalesOrder, SalesOrderItem, Quote, QuoteItem
from app.services.inventory_service import (
    get_workshop_warehouse as _get_workshop_warehouse,
    get_phoi_source_warehouse as _get_phoi_source_warehouse,
)
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.schemas.master import ProductShort
from app.schemas.production import (
    ProductionOrderCreate, ProductionOrderUpdate,
    ProductionOrderResponse, ProductionOrderListItem,
    ProductionOrderItemResponse, UpdateItemProgress, UpdateItemSxParams,
    PagedResponse, TaoLenhBody,
)

router = APIRouter(prefix="/api/production-orders", tags=["production-orders"])


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


def _build_response(order: ProductionOrder) -> ProductionOrderResponse:
    so_don = order.sales_order.so_don if order.sales_order else None
    kh = order.sales_order.customer if order.sales_order else None
    ten_khach_hang = kh.ten_viet_tat if kh else None
    ma_khach_hang = kh.ma_kh if kh else None
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
            mat=_f('mat'),       mat_dl=_f('mat_dl'),
            song_1=_f('song_1'), song_1_dl=_f('song_1_dl'),
            mat_1=_f('mat_1'),   mat_1_dl=_f('mat_1_dl'),
            song_2=_f('song_2'), song_2_dl=_f('song_2_dl'),
            mat_2=_f('mat_2'),   mat_2_dl=_f('mat_2_dl'),
            song_3=_f('song_3'), song_3_dl=_f('song_3_dl'),
            mat_3=_f('mat_3'),   mat_3_dl=_f('mat_3_dl'),
            loai_in=_f('loai_in'), so_mau=_f('so_mau'), loai_lan=_f('loai_lan'),
            kho_tt=item.kho_tt,   dai_tt=item.dai_tt,   qccl=item.qccl,
            dien_tich=item.dien_tich,
            gia_ban_muc_tieu=item.gia_ban_muc_tieu,
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
        phap_nhan_sx_id=order.phap_nhan_sx_id,
        ten_phap_nhan_sx=order.phap_nhan_sx.ten_phap_nhan if order.phap_nhan_sx else None,
        kho_sx_id=order.kho_sx_id,
        ten_kho_sx=order.kho_sx.ten_kho if order.kho_sx else None,
        phan_xuong_id=order.phan_xuong_id,
        ten_phan_xuong=order.phan_xuong.ten_xuong if order.phan_xuong else None,
        nv_theo_doi_id=order.nv_theo_doi_id,
        ten_nv_theo_doi=order.nv_theo_doi.ho_ten if order.nv_theo_doi else None,
        trang_thai=order.trang_thai,
        ngay_bat_dau_ke_hoach=order.ngay_bat_dau_ke_hoach,
        ngay_hoan_thanh_ke_hoach=order.ngay_hoan_thanh_ke_hoach,
        ngay_bat_dau_thuc_te=order.ngay_bat_dau_thuc_te,
        ngay_hoan_thanh_thuc_te=order.ngay_hoan_thanh_thuc_te,
        ghi_chu=order.ghi_chu,
        items=items,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


def _load_order(order_id: int, db: Session) -> ProductionOrder:
    order = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
            joinedload(ProductionOrder.items).joinedload(ProductionOrderItem.product),
            joinedload(ProductionOrder.items)
                .joinedload(ProductionOrderItem.sales_order_item)
                .joinedload(SalesOrderItem.quote_item),
            joinedload(ProductionOrder.phap_nhan_sx),
            joinedload(ProductionOrder.kho_sx),
            joinedload(ProductionOrder.phan_xuong),
            joinedload(ProductionOrder.nv_theo_doi),
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
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=10000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ProductionOrder).options(
        joinedload(ProductionOrder.sales_order).joinedload(SalesOrder.customer),
        joinedload(ProductionOrder.phap_nhan_sx),
        joinedload(ProductionOrder.kho_sx),
    )

    if search:
        like = f"%{search}%"
        q = q.filter(ProductionOrder.so_lenh.ilike(like))
    if trang_thai:
        q = q.filter(ProductionOrder.trang_thai == trang_thai)
    if sales_order_id:
        q = q.filter(ProductionOrder.sales_order_id == sales_order_id)
    if tu_ngay:
        q = q.filter(ProductionOrder.ngay_lenh >= tu_ngay)
    if den_ngay:
        q = q.filter(ProductionOrder.ngay_lenh <= den_ngay)

    total = q.count()
    orders = (
        q.order_by(ProductionOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items_resp = []
    for o in orders:
        items_q = db.query(ProductionOrderItem).filter(
            ProductionOrderItem.production_order_id == o.id
        ).all()
        tong_sl = sum(i.so_luong_ke_hoach for i in items_q)
        kh = o.sales_order.customer if o.sales_order else None
        items_resp.append(ProductionOrderListItem(
            id=o.id,
            so_lenh=o.so_lenh,
            ngay_lenh=o.ngay_lenh,
            sales_order_id=o.sales_order_id,
            so_don=o.sales_order.so_don if o.sales_order else None,
            ten_khach_hang=kh.ten_viet_tat if kh else None,
            ten_hang=items_q[0].ten_hang if items_q else None,
            ten_phap_nhan_sx=o.phap_nhan_sx.ten_phap_nhan if o.phap_nhan_sx else None,
            ten_kho_sx=o.kho_sx.ten_kho if o.kho_sx else None,
            trang_thai=o.trang_thai,
            ngay_hoan_thanh_ke_hoach=o.ngay_hoan_thanh_ke_hoach,
            so_dong=len(items_q),
            tong_sl_ke_hoach=tong_sl,
            created_at=o.created_at,
        ))

    return PagedResponse(
        items=items_resp,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{order_id}", response_model=ProductionOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _build_response(_load_order(order_id, db))


@router.post("/tu-don-hang/{order_id}", response_model=List[ProductionOrderResponse], status_code=201)
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

    kho_sx_id = _auto_kho_sx_id(db, data.phan_xuong_id, data.kho_sx_id)
    created_orders = []
    for idx, soi in enumerate(so.items):
        so_lenh = f"{prefix}{(start_seq + idx):03d}"
        order = ProductionOrder(
            so_lenh=so_lenh,
            ngay_lenh=today_date,
            sales_order_id=so.id,
            trang_thai="moi",
            ngay_hoan_thanh_ke_hoach=data.ngay_hoan_thanh_ke_hoach or so.ngay_giao_hang,
            phap_nhan_sx_id=data.phap_nhan_sx_id or so.phap_nhan_sx_id,
            kho_sx_id=kho_sx_id,
            phan_xuong_id=data.phan_xuong_id,
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
            dai=_s('dai'),         rong=_s('rong'),       cao=_s('cao'),
            so_lop=_so_lop,        to_hop_song=_to_hop_song,
            mat=_s('mat'),         mat_dl=_s('mat_dl'),
            song_1=_s('song_1'),   song_1_dl=_s('song_1_dl'),
            mat_1=_s('mat_1'),     mat_1_dl=_s('mat_1_dl'),
            song_2=_s('song_2'),   song_2_dl=_s('song_2_dl'),
            mat_2=_s('mat_2'),     mat_2_dl=_s('mat_2_dl'),
            song_3=_s('song_3'),   song_3_dl=_s('song_3_dl'),
            mat_3=_s('mat_3'),     mat_3_dl=_s('mat_3_dl'),
            loai_in=_s('loai_in'), so_mau=_s('so_mau'),
            loai_lan=_s('loai_lan'),
            c_tham=_s('c_tham'),   can_man=_s('can_man'),
        )
        order.items.append(item)
        db.add(order)
        created_orders.append(order)

    so.trang_thai = "dang_sx"
    db.flush()  # Chắc chắn tất cả INSERT chạy và DB gán ID trước khi commit
    order_ids = [o.id for o in created_orders]  # Thu thập ID khi objects còn "tươi"
    db.commit()

    # Load lại từng order với đầy đủ relationships sau commit
    return [_build_response(_load_order(oid, db)) for oid in order_ids]


@router.post("", response_model=ProductionOrderResponse, status_code=201)
def create_order(
    data: ProductionOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.sales_order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id).first()
        if not so:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
        if so.trang_thai not in ("da_duyet", "dang_sx"):
            raise HTTPException(status_code=400, detail="Chỉ tạo lệnh SX từ đơn hàng đã duyệt")

    so_lenh = _generate_so_lenh(db)
    kho_sx_id = _auto_kho_sx_id(db, data.phan_xuong_id, data.kho_sx_id)
    order = ProductionOrder(
        so_lenh=so_lenh,
        ngay_lenh=data.ngay_lenh,
        sales_order_id=data.sales_order_id,
        trang_thai="moi",
        phap_nhan_sx_id=data.phap_nhan_sx_id,
        kho_sx_id=kho_sx_id,
        phan_xuong_id=data.phan_xuong_id,
        nv_theo_doi_id=data.nv_theo_doi_id,
        ngay_bat_dau_ke_hoach=data.ngay_bat_dau_ke_hoach,
        ngay_hoan_thanh_ke_hoach=data.ngay_hoan_thanh_ke_hoach,
        ghi_chu=data.ghi_chu,
        created_by=current_user.id,
    )

    for item_data in data.items:
        product = None
        if item_data.product_id:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()
        item = ProductionOrderItem(
            product_id=item_data.product_id,
            sales_order_item_id=item_data.sales_order_item_id,
            ten_hang=item_data.ten_hang or (product.ten_hang if product else ""),
            so_luong_ke_hoach=item_data.so_luong_ke_hoach,
            dvt=item_data.dvt,
            ngay_giao_hang=item_data.ngay_giao_hang,
            ghi_chu=item_data.ghi_chu,
        )
        order.items.append(item)

    db.add(order)

    # Cập nhật trạng thái đơn hàng → dang_sx
    if data.sales_order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id).first()
        if so and so.trang_thai == "da_duyet":
            so.trang_thai = "dang_sx"

    db.commit()
    db.refresh(order)
    return _build_response(_load_order(order.id, db))


@router.put("/{order_id}", response_model=ProductionOrderResponse)
def update_order(
    order_id: int,
    data: ProductionOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai == "huy":
        raise HTTPException(status_code=400, detail="Lệnh đã huỷ, không thể sửa")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    db.commit()
    return _build_response(_load_order(order_id, db))


@router.patch("/{order_id}/start", response_model=ProductionOrderResponse)
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
    return _build_response(_load_order(order_id, db))


@router.patch("/{order_id}/complete", response_model=ProductionOrderResponse)
def complete_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy lệnh sản xuất")
    if order.trang_thai not in ("moi", "dang_chay"):
        raise HTTPException(status_code=400, detail=f"Không thể hoàn thành lệnh ở trạng thái '{order.trang_thai}'")

    order.trang_thai = "hoan_thanh"
    order.ngay_hoan_thanh_thuc_te = date.today()
    db.commit()
    return _build_response(_load_order(order_id, db))


@router.patch("/{order_id}/cancel")
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


@router.patch("/{order_id}/items/{item_id}/progress", response_model=ProductionOrderItemResponse)
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


@router.patch("/{order_id}/items/{item_id}/sx-params", response_model=ProductionOrderResponse)
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
    return _build_response(_load_order(order_id, db))


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
                "so_luong_ke_hoach": float(it.so_luong_ke_hoach),
                "so_luong_thuc_te": float(it.so_luong_thuc_te) if it.so_luong_thuc_te is not None else None,
                "so_luong_loi": float(it.so_luong_loi) if it.so_luong_loi is not None else None,
                "chieu_kho": float(it.chieu_kho) if it.chieu_kho is not None else None,
                "chieu_cat": float(it.chieu_cat) if it.chieu_cat is not None else None,
                "so_tam": it.so_tam,
                "ghi_chu": it.ghi_chu,
            }
            for it in p.items
        ],
    }


@router.post("/{order_id}/phieu-nhap-phoi-song", status_code=201)
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
            phap_nhan_id=order.phap_nhan_sx_id,
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

    db.commit()
    db.refresh(phieu)

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


@router.get("/{order_id}/phieu-nhap-phoi-song")
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
            joinedload(PhieuNhapPhoiSong.items).joinedload(PhieuNhapPhoiSongItem.production_order_item)
        )
        .order_by(PhieuNhapPhoiSong.created_at.desc())
        .all()
    )
    return [_phieu_to_dict(p) for p in phieus]


@router.delete("/{order_id}/phieu-nhap-phoi-song/{phieu_id}")
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
            balance = get_or_create_balance(db, phieu.warehouse_id, ten_hang=ten_hang, don_vi="Tấm")
            try:
                xuat_balance(balance, sl_nhap, ten_hang)
            except Exception:
                balance.ton_luong = Decimal("0")
                balance.gia_tri_ton = Decimal("0")
            log_tx(db, phieu.warehouse_id, "XUAT_PHOI_HOAN", sl_nhap,
                   balance.don_gia_binh_quan, balance.ton_luong,
                   "phieu_nhap_phoi_song", phieu.id, current_user.id)

    db.delete(phieu)
    db.commit()
    return {"ok": True}


# ── Đẩy lệnh sang hệ thống CD2 (Công Đoạn 2) ────────────────────────────────

@router.post("/{order_id}/push-to-cd2")
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
        return {"ok": True, "data": result, "payload_sent": dhcho_payload}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lỗi kết nối CD2: {exc}")
