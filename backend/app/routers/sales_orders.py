from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer, Product
from app.models.sales import SalesOrder, SalesOrderItem
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
            joinedload(SalesOrder.items).joinedload(SalesOrderItem.product),
        )
        .filter(SalesOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    result = SalesOrderResponse(
        id=order.id,
        so_don=order.so_don,
        ngay_don=order.ngay_don,
        customer_id=order.customer_id,
        customer=CustomerShort.model_validate(order.customer) if order.customer else None,
        trang_thai=order.trang_thai,
        ngay_giao_hang=order.ngay_giao_hang,
        dia_chi_giao=order.dia_chi_giao,
        ghi_chu=order.ghi_chu,
        tong_tien=order.tong_tien,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=[
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
            )
            for item in order.items
        ],
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
        ngay_giao_hang=data.ngay_giao_hang,
        dia_chi_giao=data.dia_chi_giao or customer.dia_chi_giao_hang,
        ghi_chu=data.ghi_chu,
        trang_thai="moi",
        created_by=current_user.id,
        nv_kinh_doanh_id=current_user.id,
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
