from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Customer
from app.models.sales import SalesOrder, SalesOrderItem, SalesReturn, SalesReturnItem
from app.models.warehouse_doc import DeliveryOrder, DeliveryOrderItem
from app.models.accounting import CustomerRefundVoucher
from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    log_tx as _log_tx,
)
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
    page_size: int = Query(default=20, ge=1, le=1000),
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
    returns = query.order_by(SalesReturn.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return_ids = [r.id for r in returns]
    qty_map = dict(
        db.query(
            SalesReturnItem.sales_return_id,
            func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0),
        )
        .filter(SalesReturnItem.sales_return_id.in_(return_ids))
        .group_by(SalesReturnItem.sales_return_id)
        .all()
    ) if return_ids else {}

    return {
        "items": [{
            "id": r.id,
            "so_phieu_tra": r.so_phieu_tra,
            "ngay_tra": r.ngay_tra,
            "sales_order_id": r.sales_order_id,
            "so_don_ban": r.sales_order.so_don if r.sales_order else None,
            "customer_id": r.customer_id,
            "ten_khach_hang": (
                r.customer.ten_viet_tat
                or r.customer.ten_don_vi
                if r.customer else None
            ),
            "ly_do_tra": r.ly_do_tra,
            "trang_thai": r.trang_thai,
            "tong_so_luong_tra": qty_map.get(r.id, 0),
            "tong_tien_tra": r.tong_tien_tra,
            "created_at": r.created_at,
        } for r in returns],
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
    # Validate sales order exists. Return goods are based on an existing delivery.
    sales_order = db.query(SalesOrder).filter(
        SalesOrder.id == data.sales_order_id
    ).first()
    if not sales_order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng bán")

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

    if not data.delivery_order_id:
        raise HTTPException(status_code=400, detail="Phiếu trả hàng phải lấy từ một phiếu giao hàng")

    delivery_order = db.query(DeliveryOrder).filter(
        DeliveryOrder.id == data.delivery_order_id,
        DeliveryOrder.sales_order_id == data.sales_order_id,
        DeliveryOrder.customer_id == data.customer_id,
    ).first()
    if not delivery_order:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu giao hàng tương ứng với đơn hàng và khách hàng này")

    delivered_qty_by_item: dict[int, float] = {}
    for row in db.query(DeliveryOrderItem).filter(
        DeliveryOrderItem.delivery_id == data.delivery_order_id,
        DeliveryOrderItem.sales_order_item_id.isnot(None),
    ).all():
        delivered_qty_by_item[row.sales_order_item_id] = (
            delivered_qty_by_item.get(row.sales_order_item_id, 0) + float(row.so_luong or 0)
        )

    return_qty_by_item: dict[int, float] = {}
    for item_data in data.items:
        return_qty_by_item[item_data.sales_order_item_id] = (
            return_qty_by_item.get(item_data.sales_order_item_id, 0) + float(item_data.so_luong_tra)
        )

    returned_qty_by_item: dict[int, float] = dict(
        db.query(
            SalesReturnItem.sales_order_item_id,
            func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0),
        )
        .join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id)
        .filter(
            SalesReturn.delivery_order_id == data.delivery_order_id,
            SalesReturn.trang_thai != "huy",
        )
        .group_by(SalesReturnItem.sales_order_item_id)
        .all()
    )

    for sales_order_item_id, return_qty in return_qty_by_item.items():
        delivered_qty = delivered_qty_by_item.get(sales_order_item_id, 0)
        returned_qty = float(returned_qty_by_item.get(sales_order_item_id, 0))
        remaining_qty = delivered_qty - returned_qty
        if delivered_qty <= 0:
            raise HTTPException(status_code=400, detail=f"Item đơn hàng ID {sales_order_item_id} không có trong phiếu giao hàng đã chọn")
        if return_qty > remaining_qty:
            raise HTTPException(status_code=400, detail=f"Số lượng trả không được vượt quá số lượng còn có thể trả ({remaining_qty})")

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
    return_obj = db.query(SalesReturn).options(
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.sales_order_item),
        joinedload(SalesReturn.delivery_order),
        joinedload(SalesReturn.sales_order)
    ).filter(SalesReturn.id == return_id).first()
    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")
    if return_obj.trang_thai != "moi":
        raise HTTPException(status_code=400, detail=f"Phiếu trả đang ở trạng thái '{return_obj.trang_thai}', không thể duyệt")

    # Xác định warehouse để nhập kho
    warehouse_id = None
    if return_obj.delivery_order:
        # Nếu có phiếu xuất kho, nhập lại vào kho đó
        warehouse_id = return_obj.delivery_order.warehouse_id
    else:
        # Nếu không có phiếu xuất kho, tìm kho từ đơn hàng (kho thành phẩm của xưởng)
        from app.services.inventory_service import get_workshop_warehouse as _get_workshop_warehouse
        if return_obj.sales_order.phan_xuong_id:
            wh = _get_workshop_warehouse(db, return_obj.sales_order.phan_xuong_id, "THANH_PHAM")
            warehouse_id = wh.id if wh else None

    if not warehouse_id:
        raise HTTPException(status_code=400, detail="Không thể xác định kho để nhập hàng trả lại")

    # Nhập kho cho từng item trả lại
    for item in return_obj.items:
        sales_order_item = item.sales_order_item
        if not sales_order_item:
            continue

        # Lấy thông tin sản phẩm
        ten_hang = sales_order_item.ten_hang or "Không xác định"
        dvt = sales_order_item.dvt or "Thùng"
        product_id = sales_order_item.product_id

        # Tạo/cập nhật balance
        bal = _get_or_create_balance(
            db, warehouse_id,
            product_id=product_id,
            ten_hang=ten_hang,
            don_vi=dvt
        )

        # Nhập kho với giá trả
        _nhap_balance(bal, item.so_luong_tra, item.don_gia_tra)

        # Ghi log transaction
        _log_tx(
            db, warehouse_id, "NHAP_TRA_HANG",
            item.so_luong_tra, item.don_gia_tra, bal.ton_luong,
            "sales_returns", return_obj.id, current_user.id,
            product_id=product_id,
            ghi_chu=f"Nhập lại hàng trả: {item.ly_do_tra or 'Không có lý do'}"
        )

    return_obj.trang_thai = "da_duyet"
    return_obj.approved_by = current_user.id
    return_obj.approved_at = datetime.utcnow()
    db.flush()

    # Auto-tạo phiếu hoàn tiền (nháp) nếu chưa có
    existing_voucher = db.query(CustomerRefundVoucher).filter(
        CustomerRefundVoucher.sales_return_id == return_obj.id
    ).first()
    if not existing_voucher:
        today_str = date.today().strftime("%Y%m")
        prefix = f"HT{today_str}"
        last = (db.query(CustomerRefundVoucher)
                .filter(CustomerRefundVoucher.so_phieu.like(f"{prefix}%"))
                .order_by(CustomerRefundVoucher.so_phieu.desc())
                .first())
        seq = int(last.so_phieu[-4:]) + 1 if last else 1
        so_phieu_ht = f"{prefix}-{seq:04d}"
        db.add(CustomerRefundVoucher(
            so_phieu=so_phieu_ht,
            ngay=date.today(),
            customer_id=return_obj.customer_id,
            sales_return_id=return_obj.id,
            so_tien=return_obj.tong_tien_tra,
            trang_thai="nhap",
            created_by=current_user.id,
        ))

    db.commit()
    return get_return(return_id, db, current_user)


@router.patch("/{return_id}/cancel")
def cancel_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return_obj = db.query(SalesReturn).options(
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.sales_order_item),
        joinedload(SalesReturn.delivery_order),
        joinedload(SalesReturn.sales_order)
    ).filter(SalesReturn.id == return_id).first()
    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")

    if return_obj.trang_thai == "da_duyet":
        # Nếu đã duyệt, cần hủy nhập kho
        from app.services.inventory_service import xuat_balance as _xuat_balance

        warehouse_id = None
        if return_obj.delivery_order:
            warehouse_id = return_obj.delivery_order.warehouse_id
        else:
            from app.services.inventory_service import get_workshop_warehouse as _get_workshop_warehouse
            if return_obj.sales_order.phan_xuong_id:
                wh = _get_workshop_warehouse(db, return_obj.sales_order.phan_xuong_id, "THANH_PHAM")
                warehouse_id = wh.id if wh else None

        if warehouse_id:
            # Hủy nhập kho cho từng item
            for item in return_obj.items:
                sales_order_item = item.sales_order_item
                if not sales_order_item:
                    continue

                ten_hang = sales_order_item.ten_hang or "Không xác định"
                dvt = sales_order_item.dvt or "Thùng"
                product_id = sales_order_item.product_id

                bal = _get_or_create_balance(
                    db, warehouse_id,
                    product_id=product_id,
                    ten_hang=ten_hang,
                    don_vi=dvt
                )

                # Xuất kho để hủy nhập (trừ tồn)
                _xuat_balance(bal, item.so_luong_tra, ten_hang)

                # Ghi log hủy nhập
                _log_tx(
                    db, warehouse_id, "HUY_NHAP_TRA_HANG",
                    -item.so_luong_tra, item.don_gia_tra, bal.ton_luong,
                    "sales_returns", return_obj.id, current_user.id,
                    product_id=product_id,
                    ghi_chu=f"Hủy nhập hàng trả: {item.ly_do_tra or 'Không có lý do'}"
                )

    return_obj.trang_thai = "huy"
    db.commit()
    return {"message": "Đã hủy phiếu trả hàng"}
