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
from app.services.sales_order_service import SalesOrderService
from app.schemas.master import CustomerShort, ProductShort
from app.schemas.sales import (
    SalesOrderCreate, SalesOrderUpdate,
    SalesOrderResponse, SalesOrderListItem,
    SalesOrderItemResponse, PagedResponse,
)

router = APIRouter(prefix="/api/sales-orders", tags=["sales-orders"])


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
    service = SalesOrderService(db)
    return service.get_sales_orders_paginated(
        search=search,
        trang_thai=trang_thai,
        customer_id=customer_id,
        tu_ngay=tu_ngay,
        den_ngay=den_ngay,
        page=page,
        page_size=page_size,
    )


@router.get("/{order_id}", response_model=SalesOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = SalesOrderService(db)
    return service.get_sales_order_by_id(order_id)


@router.post("", response_model=SalesOrderResponse, status_code=201)
def create_order(
    data: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == data.customer_id, Customer.trang_thai == True).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    so_don = SalesOrderService(db)._generate_so_don()

    order = SalesOrder(
        so_don=so_don,
        ngay_don=data.ngay_don,
        customer_id=data.customer_id,
        phap_nhan_id=data.phap_nhan_id,
        phap_nhan_sx_id=data.phap_nhan_sx_id,
        phan_xuong_id=data.phan_xuong_id,
        ngay_giao_hang=data.ngay_giao_hang,
        dia_chi_giao=data.dia_chi_giao or customer.dia_chi_giao_hang,
        ghi_chu=data.ghi_chu,
        ty_le_giam_gia=data.ty_le_giam_gia,
        so_tien_giam_gia=data.so_tien_giam_gia,
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
            dvt=item_data.dvt or product.dvt,
            don_gia=item_data.don_gia,
            ty_le_giam_gia=item_data.ty_le_giam_gia,
            so_tien_giam_gia=item_data.so_tien_giam_gia,
            ngay_giao_hang=item_data.ngay_giao_hang,
            ghi_chu_san_pham=item_data.ghi_chu_san_pham,
            yeu_cau_in=item_data.yeu_cau_in,
        )
        order.items.append(item)
        tong_tien += float(item.thanh_tien)

    order.tong_tien = round(tong_tien, 2)

    # Tính tổng tiền sau giảm giá đơn hàng
    if order.ty_le_giam_gia > 0:
        order.tong_tien_sau_giam = order.tong_tien * (1 - order.ty_le_giam_gia / 100)
    elif order.so_tien_giam_gia > 0:
        order.tong_tien_sau_giam = max(0, order.tong_tien - order.so_tien_giam_gia)
    else:
        order.tong_tien_sau_giam = order.tong_tien
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


@router.patch("/{order_id}/update-discount")
def update_discount(
    order_id: int,
    ty_le_giam_gia: float | None = None,
    so_tien_giam_gia: float | None = None,
    ghi_chu: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cập nhật giảm giá cho đơn hàng đã duyệt/xuất kho.
    Chỉ cho phép cập nhật giảm giá, không cho phép sửa các thông tin khác.
    """
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    # Chỉ cho phép cập nhật giảm giá cho đơn hàng đã duyệt hoặc đã xuất kho
    if order.trang_thai not in ("da_duyet", "dang_xuat", "hoan_thanh"):
        raise HTTPException(
            status_code=400,
            detail=f"Chỉ có thể cập nhật giảm giá cho đơn hàng đã duyệt. Trạng thái hiện tại: '{order.trang_thai}'"
        )

    # Validate input
    if ty_le_giam_gia is not None and (ty_le_giam_gia < 0 or ty_le_giam_gia > 100):
        raise HTTPException(status_code=400, detail="Tỷ lệ giảm giá phải từ 0 đến 100")

    if so_tien_giam_gia is not None and so_tien_giam_gia < 0:
        raise HTTPException(status_code=400, detail="Số tiền giảm giá không được âm")

    # Cập nhật giảm giá
    if ty_le_giam_gia is not None:
        order.ty_le_giam_gia = ty_le_giam_gia
    if so_tien_giam_gia is not None:
        order.so_tien_giam_gia = so_tien_giam_gia

    # Cập nhật ghi chú nếu có
    if ghi_chu is not None:
        order.ghi_chu = ghi_chu

    # Tính lại tổng tiền
    tong_tien_hang = sum(item.so_luong * item.don_gia for item in order.items)
    order.tong_tien_hang = tong_tien_hang

    # Áp dụng giảm giá
    if order.ty_le_giam_gia and order.ty_le_giam_gia > 0:
        order.tong_tien_giam_gia = tong_tien_hang * (order.ty_le_giam_gia / 100)
    elif order.so_tien_giam_gia and order.so_tien_giam_gia > 0:
        order.tong_tien_giam_gia = order.so_tien_giam_gia
    else:
        order.tong_tien_giam_gia = 0

    order.tong_thanh_toan = tong_tien_hang - order.tong_tien_giam_gia

    # Cập nhật thời gian sửa đổi
    order.updated_at = datetime.utcnow()

    db.commit()
    return get_order(order_id, db, current_user)


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
