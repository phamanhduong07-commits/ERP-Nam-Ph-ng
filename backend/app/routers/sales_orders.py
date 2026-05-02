from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, Date, text
from sqlalchemy.orm import Session, joinedload
from app.database import get_db, _BACKFILL_QI_PG, _BACKFILL_SPEC_PG
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer, Product
from app.models.sales import SalesOrder, SalesOrderItem, QuoteItem
from app.models.production import ProductionOrderItem
from app.schemas.master import CustomerShort, ProductShort
from app.schemas.sales import (
    SalesOrderCreate, SalesOrderUpdate,
    SalesOrderResponse, SalesOrderListItem,
    SalesOrderItemResponse, PagedResponse,
)

router = APIRouter(prefix="/api/sales-orders", tags=["sales-orders"])


def _generate_so_don(db: Session) -> str:
    today = date.today()
    prefix = f"DH{today.strftime('%Y%m%d')}"
    last = (
        db.query(SalesOrder)
        .filter(SalesOrder.so_don.like(f"{prefix}%"))
        .order_by(SalesOrder.so_don.desc())
        .first()
    )
    if last:
        seq = int(last.so_don[-3:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:03d}"


@router.get("", response_model=PagedResponse)
def list_orders(
    search: str = Query(default=""),
    trang_thai: str | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SalesOrder).options(joinedload(SalesOrder.customer))

    if search:
        like = f"%{search}%"
        q = q.join(Customer).filter(
            SalesOrder.so_don.ilike(like) | Customer.ten_viet_tat.ilike(like)
        )
    if trang_thai:
        q = q.filter(SalesOrder.trang_thai == trang_thai)
    if customer_id:
        q = q.filter(SalesOrder.customer_id == customer_id)
    if tu_ngay:
        q = q.filter(SalesOrder.ngay_don >= tu_ngay)
    if den_ngay:
        q = q.filter(SalesOrder.ngay_don <= den_ngay)

    total = q.count()
    orders = q.order_by(SalesOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for o in orders:
        items.append(SalesOrderListItem(
            id=o.id,
            so_don=o.so_don,
            ngay_don=o.ngay_don,
            customer_id=o.customer_id,
            ten_khach_hang=o.customer.ten_viet_tat if o.customer else None,
            trang_thai=o.trang_thai,
            ngay_giao_hang=o.ngay_giao_hang,
            tong_tien=o.tong_tien,
            so_dong=len(o.items),
            created_at=o.created_at,
        ))

    return PagedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{order_id}", response_model=SalesOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    order = (
        db.query(SalesOrder)
        .options(
            joinedload(SalesOrder.customer),
            joinedload(SalesOrder.phap_nhan),
            joinedload(SalesOrder.phap_nhan_sx),
            joinedload(SalesOrder.phan_xuong),
            joinedload(SalesOrder.items).joinedload(SalesOrderItem.product),
            joinedload(SalesOrder.items).joinedload(SalesOrderItem.quote_item).joinedload(QuoteItem.quote),
        )
        .filter(SalesOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    def _spec(item: SalesOrderItem, field: str):
        """Return spec from SOItem; fall back to linked QuoteItem if NULL."""
        val = getattr(item, field, None)
        if val is None and item.quote_item is not None:
            val = getattr(item.quote_item, field, None)
        return val

    # Map sales_order_item_id → production_order_item_id (lấy bản mới nhất)
    soi_ids = [item.id for item in order.items]
    poi_rows = (
        db.query(ProductionOrderItem.id, ProductionOrderItem.sales_order_item_id)
        .filter(ProductionOrderItem.sales_order_item_id.in_(soi_ids))
        .all()
    ) if soi_ids else []
    poi_map: dict[int, int] = {}
    for poi_id, soi_id in poi_rows:
        poi_map[soi_id] = poi_id  # nếu nhiều lệnh → lấy cái cuối

    def _build_items(items, _db):
        return [
            SalesOrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                ten_hang=item.ten_hang,
                product=ProductShort.model_validate(item.product) if item.product else None,
                so_luong=item.so_luong,
                dvt=item.dvt,
                don_gia=item.don_gia,
                thanh_tien=item.thanh_tien,
                ngay_giao_hang=item.ngay_giao_hang,
                ghi_chu_san_pham=item.ghi_chu_san_pham,
                yeu_cau_in=item.yeu_cau_in,
                so_luong_da_xuat=item.so_luong_da_xuat,
                trang_thai_dong=item.trang_thai_dong,
                loai_thung=_spec(item, 'loai_thung'),
                dai=_spec(item, 'dai'),   rong=_spec(item, 'rong'),   cao=_spec(item, 'cao'),
                so_lop=_spec(item, 'so_lop'),
                to_hop_song=_spec(item, 'to_hop_song'),
                mat=_spec(item, 'mat'),         mat_dl=_spec(item, 'mat_dl'),
                song_1=_spec(item, 'song_1'),   song_1_dl=_spec(item, 'song_1_dl'),
                mat_1=_spec(item, 'mat_1'),     mat_1_dl=_spec(item, 'mat_1_dl'),
                song_2=_spec(item, 'song_2'),   song_2_dl=_spec(item, 'song_2_dl'),
                mat_2=_spec(item, 'mat_2'),     mat_2_dl=_spec(item, 'mat_2_dl'),
                song_3=_spec(item, 'song_3'),   song_3_dl=_spec(item, 'song_3_dl'),
                mat_3=_spec(item, 'mat_3'),     mat_3_dl=_spec(item, 'mat_3_dl'),
                loai_in=_spec(item, 'loai_in'),
                so_mau=_spec(item, 'so_mau'),
                production_order_item_id=poi_map.get(item.id),
            )
            for item in items
        ]

    # Fallback: nếu đơn hàng chưa có phan_xuong_id, lấy từ báo giá qua quote_item
    phan_xuong_id = order.phan_xuong_id
    if not phan_xuong_id:
        for item in order.items:
            if item.quote_item and item.quote_item.quote and item.quote_item.quote.phan_xuong_id:
                phan_xuong_id = item.quote_item.quote.phan_xuong_id
                break

    result = SalesOrderResponse(
        id=order.id,
        so_don=order.so_don,
        ngay_don=order.ngay_don,
        customer_id=order.customer_id,
        customer=CustomerShort.model_validate(order.customer) if order.customer else None,
        phap_nhan_id=order.phap_nhan_id,
        ten_phap_nhan=order.phap_nhan.ten_phap_nhan if order.phap_nhan else None,
        phap_nhan_sx_id=order.phap_nhan_sx_id,
        ten_phap_nhan_sx=order.phap_nhan_sx.ten_phap_nhan if order.phap_nhan_sx else None,
        phan_xuong_id=phan_xuong_id,
        ten_phan_xuong=order.phan_xuong.ten_xuong if order.phan_xuong else None,
        trang_thai=order.trang_thai,
        ngay_giao_hang=order.ngay_giao_hang,
        dia_chi_giao=order.dia_chi_giao,
        ghi_chu=order.ghi_chu,
        tong_tien=order.tong_tien,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=_build_items(order.items, db),
    )
    return result


@router.post("", response_model=SalesOrderResponse, status_code=201)
def create_order(
    data: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == data.customer_id, Customer.trang_thai == True).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    so_don = _generate_so_don(db)

    order = SalesOrder(
        so_don=so_don,
        ngay_don=data.ngay_don,
        customer_id=data.customer_id,
        phap_nhan_id=data.phap_nhan_id,
        phan_xuong_id=data.phan_xuong_id,
        ngay_giao_hang=data.ngay_giao_hang,
        dia_chi_giao=data.dia_chi_giao or customer.dia_chi_giao_hang,
        ghi_chu=data.ghi_chu,
        trang_thai="moi",
        created_by=current_user.id,
        nv_kinh_doanh_id=data.nv_kinh_doanh_id or current_user.id,
    )

    tong_tien = 0
    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id, Product.trang_thai == True).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Sản phẩm ID {item_data.product_id} không tồn tại")

        item = SalesOrderItem(
            product_id=item_data.product_id,
            ten_hang=item_data.ten_hang or product.ten_hang,
            so_luong=item_data.so_luong,
            dvt=item_data.dvt,
            don_gia=item_data.don_gia,
            ngay_giao_hang=item_data.ngay_giao_hang,
            ghi_chu_san_pham=item_data.ghi_chu_san_pham,
            yeu_cau_in=item_data.yeu_cau_in,
        )
        order.items.append(item)
        tong_tien += float(item_data.so_luong) * float(item_data.don_gia)

    order.tong_tien = round(tong_tien, 2)
    db.add(order)
    db.commit()
    db.refresh(order)
    return get_order(order.id, db, current_user)


@router.put("/{order_id}", response_model=SalesOrderResponse)
def update_order(
    order_id: int,
    data: SalesOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai not in ("moi",):
        raise HTTPException(status_code=400, detail="Chỉ có thể sửa đơn hàng ở trạng thái 'Mới'")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    db.commit()
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/approve", response_model=SalesOrderResponse)
def approve_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai != "moi":
        raise HTTPException(status_code=400, detail=f"Đơn hàng đang ở trạng thái '{order.trang_thai}', không thể duyệt")

    order.trang_thai = "da_duyet"
    order.approved_by = current_user.id
    order.approved_at = datetime.utcnow()
    db.commit()
    return get_order(order_id, db, current_user)


@router.patch("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    if order.trang_thai in ("hoan_thanh", "huy"):
        raise HTTPException(status_code=400, detail="Không thể huỷ đơn hàng này")

    order.trang_thai = "huy"
    db.commit()
    return {"message": f"Đã huỷ đơn hàng {order.so_don}"}


@router.post("/admin/backfill-spec")
def backfill_spec(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Chạy lại backfill spec từ quote_items → sales_order_items.
    Dùng khi đơn hàng cũ chưa có dữ liệu kỹ thuật từ báo giá.
    """
    try:
        r1 = db.execute(text(_BACKFILL_QI_PG))
        qi_rows = r1.rowcount
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Backfill quote_item_id thất bại: {e}")

    try:
        r2 = db.execute(text(_BACKFILL_SPEC_PG))
        spec_rows = r2.rowcount
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Backfill spec thất bại: {e}")

    db.commit()
    return {
        "message": "Backfill hoàn tất",
        "qi_rows": qi_rows,
        "spec_rows": spec_rows,
    }
