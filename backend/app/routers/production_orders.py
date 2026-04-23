from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Product
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.production import ProductionOrder, ProductionOrderItem
from app.schemas.master import ProductShort
from app.schemas.production import (
    ProductionOrderCreate, ProductionOrderUpdate,
    ProductionOrderResponse, ProductionOrderListItem,
    ProductionOrderItemResponse, UpdateItemProgress, PagedResponse,
)

router = APIRouter(prefix="/api/production-orders", tags=["production-orders"])


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
    items = [
        ProductionOrderItemResponse(
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
        for item in order.items
    ]
    return ProductionOrderResponse(
        id=order.id,
        so_lenh=order.so_lenh,
        ngay_lenh=order.ngay_lenh,
        sales_order_id=order.sales_order_id,
        so_don=so_don,
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
            joinedload(ProductionOrder.sales_order),
            joinedload(ProductionOrder.items).joinedload(ProductionOrderItem.product),
            joinedload(ProductionOrder.items).joinedload(ProductionOrderItem.sales_order_item),
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
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ProductionOrder).options(joinedload(ProductionOrder.sales_order))

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
        items_resp.append(ProductionOrderListItem(
            id=o.id,
            so_lenh=o.so_lenh,
            ngay_lenh=o.ngay_lenh,
            sales_order_id=o.sales_order_id,
            so_don=o.sales_order.so_don if o.sales_order else None,
            trang_thai=o.trang_thai,
            ngay_hoan_thanh_ke_hoach=o.ngay_hoan_thanh_ke_hoach,
            so_dong=len(items_q),
            tong_sl_ke_hoach=tong_sl,
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
    order = ProductionOrder(
        so_lenh=so_lenh,
        ngay_lenh=data.ngay_lenh,
        sales_order_id=data.sales_order_id,
        trang_thai="moi",
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
