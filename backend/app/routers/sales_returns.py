from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer
from app.models.sales import SalesOrder, SalesOrderItem, SalesReturn, SalesReturnItem
from app.schemas.sales import (
    SalesReturnCreate, SalesReturnUpdate, SalesReturnResponse,
    SalesReturnItemResponse, PagedResponse
)

router = APIRouter(prefix="/api/sales-returns", tags=["sales-returns"])


@router.get("", response_model=PagedResponse)
def list_returns(
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
    query = db.query(SalesReturn).options(
        joinedload(SalesReturn.customer),
        joinedload(SalesReturn.sales_order),
        joinedload(SalesReturn.creator),
        joinedload(SalesReturn.approver)
    )

    if search:
        query = query.filter(
            (SalesReturn.so_phieu_tra.ilike(f"%{search}%")) |
            (SalesReturn.sales_order.has(SalesOrder.so_don.ilike(f"%{search}%"))) |
            (SalesReturn.customer.has(Customer.ten_don_vi.ilike(f"%{search}%")))
        )

    if trang_thai:
        query = query.filter(SalesReturn.trang_thai == trang_thai)

    if customer_id:
        query = query.filter(SalesReturn.customer_id == customer_id)

    if tu_ngay:
        query = query.filter(SalesReturn.ngay_tra >= tu_ngay)

    if den_ngay:
        query = query.filter(SalesReturn.ngay_tra <= den_ngay)

    total = query.count()
    returns = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "data": returns,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/{return_id}", response_model=SalesReturnResponse)
def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return_obj = db.query(SalesReturn).options(
        joinedload(SalesReturn.customer),
        joinedload(SalesReturn.sales_order),
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.sales_order_item),
        joinedload(SalesReturn.creator),
        joinedload(SalesReturn.approver)
    ).filter(SalesReturn.id == return_id).first()

    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")

    return return_obj


@router.post("", response_model=SalesReturnResponse, status_code=201)
def create_return(
    data: SalesReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate sales order exists and is approved
    sales_order = db.query(SalesOrder).filter(
        SalesOrder.id == data.sales_order_id,
        SalesOrder.trang_thai == "da_duyet"
    ).first()
    if not sales_order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng đã duyệt")

    # Validate customer matches
    if sales_order.customer_id != data.customer_id:
        raise HTTPException(status_code=400, detail="Khách hàng không khớp với đơn hàng")

    # Validate delivery order if provided
    if data.delivery_order_id:
        from app.models.warehouse_doc import DeliveryOrder
        delivery_order = db.query(DeliveryOrder).filter(
            DeliveryOrder.id == data.delivery_order_id,
            DeliveryOrder.sales_order_id == data.sales_order_id
        ).first()
        if not delivery_order:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiếu xuất kho tương ứng với đơn hàng này")

    # Generate return number
    so_phieu_tra = f"PT{datetime.now().strftime('%Y%m%d')}{str(db.query(SalesReturn).count() + 1).zfill(3)}"

    return_obj = SalesReturn(
        so_phieu_tra=so_phieu_tra,
        ngay_tra=data.ngay_tra,
        sales_order_id=data.sales_order_id,
        delivery_order_id=data.delivery_order_id,
        customer_id=data.customer_id,
        ly_do_tra=data.ly_do_tra,
        ghi_chu=data.ghi_chu,
        trang_thai="moi",
        created_by=current_user.id,
    )

    tong_tien_tra = 0
    for item_data in data.items:
        # Validate sales order item exists
        sales_order_item = db.query(SalesOrderItem).filter(
            SalesOrderItem.id == item_data.sales_order_item_id,
            SalesOrderItem.order_id == data.sales_order_id
        ).first()
        if not sales_order_item:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy item đơn hàng ID {item_data.sales_order_item_id}")

        # Validate return quantity doesn't exceed sold quantity
        if item_data.so_luong_tra > sales_order_item.so_luong:
            raise HTTPException(status_code=400, detail=f"Số lượng trả không được vượt quá số lượng đã bán ({sales_order_item.so_luong})")

        return_item = SalesReturnItem(
            sales_order_item_id=item_data.sales_order_item_id,
            so_luong_tra=item_data.so_luong_tra,
            don_gia_tra=item_data.don_gia_tra or sales_order_item.don_gia,
            ly_do_tra=item_data.ly_do_tra,
            tinh_trang_hang=item_data.tinh_trang_hang,
            ghi_chu=item_data.ghi_chu,
        )
        return_obj.items.append(return_item)
        tong_tien_tra += float(item_data.so_luong_tra) * float(return_item.don_gia_tra)

    return_obj.tong_tien_tra = round(tong_tien_tra, 2)
    db.add(return_obj)
    db.commit()
    db.refresh(return_obj)
    return get_return(return_obj.id, db, current_user)


@router.put("/{return_id}", response_model=SalesReturnResponse)
def update_return(
    return_id: int,
    data: SalesReturnUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return_obj = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")
    if return_obj.trang_thai != "moi":
        raise HTTPException(status_code=400, detail="Chỉ có thể sửa phiếu trả ở trạng thái 'Mới'")

    for field, value in data.model_dump(exclude_none=True).items():
        if field != "items":  # Handle items separately
            setattr(return_obj, field, value)

    if data.items is not None:
        # Clear existing items
        return_obj.items.clear()

        # Add updated items
        tong_tien_tra = 0
        for item_data in data.items:
            sales_order_item = db.query(SalesOrderItem).filter(
                SalesOrderItem.id == item_data.sales_order_item_id,
                SalesOrderItem.order_id == return_obj.sales_order_id
            ).first()
            if not sales_order_item:
                raise HTTPException(status_code=404, detail=f"Không tìm thấy item đơn hàng ID {item_data.sales_order_item_id}")

            if item_data.so_luong_tra > sales_order_item.so_luong:
                raise HTTPException(status_code=400, detail=f"Số lượng trả không được vượt quá số lượng đã bán ({sales_order_item.so_luong})")

            return_item = SalesReturnItem(
                sales_order_item_id=item_data.sales_order_item_id,
                so_luong_tra=item_data.so_luong_tra,
                don_gia_tra=item_data.don_gia_tra or sales_order_item.don_gia,
                ly_do_tra=item_data.ly_do_tra,
                tinh_trang_hang=item_data.tinh_trang_hang,
                ghi_chu=item_data.ghi_chu,
            )
            return_obj.items.append(return_item)
            tong_tien_tra += float(item_data.so_luong_tra) * float(return_item.don_gia_tra)

        return_obj.tong_tien_tra = round(tong_tien_tra, 2)

    db.commit()
    return get_return(return_id, db, current_user)


@router.patch("/{return_id}/approve", response_model=SalesReturnResponse)
def approve_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return_obj = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")
    if return_obj.trang_thai != "moi":
        raise HTTPException(status_code=400, detail=f"Phiếu trả đang ở trạng thái '{return_obj.trang_thai}', không thể duyệt")

    return_obj.trang_thai = "da_duyet"
    return_obj.approved_by = current_user.id
    return_obj.approved_at = datetime.utcnow()
    db.commit()
    return get_return(return_id, db, current_user)


@router.patch("/{return_id}/cancel")
def cancel_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return_obj = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")
    if return_obj.trang_thai != "moi":
        raise HTTPException(status_code=400, detail=f"Phiếu trả đang ở trạng thái '{return_obj.trang_thai}', không thể hủy")

    return_obj.trang_thai = "huy"
    db.commit()
    return {"message": "Đã hủy phiếu trả hàng"}