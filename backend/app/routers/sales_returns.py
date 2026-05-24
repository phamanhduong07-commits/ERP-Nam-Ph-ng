from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user, require_permissions
from app.models.auth import User
from app.models.master import Customer, Warehouse
from app.models.sales import SalesOrder, SalesOrderItem, SalesReturn, SalesReturnItem
from app.models.production import ProductionOrderItem
from app.models.warehouse_doc import DeliveryOrder, DeliveryOrderItem
from app.models.accounting import CustomerRefundVoucher, DebtLedgerEntry
from app.models.billing import SalesInvoice
from app.services.accounting_service import AccountingService
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


def _resolve_delivery_order_item(
    db: Session,
    delivery_order_id: int,
    sales_order_item_id: int | None,
    delivery_order_item_id: int | None = None,
) -> DeliveryOrderItem:
    if delivery_order_item_id:
        delivery_item = db.query(DeliveryOrderItem).filter(
            DeliveryOrderItem.id == delivery_order_item_id,
            DeliveryOrderItem.delivery_id == delivery_order_id,
        ).first()
        if not delivery_item:
            raise HTTPException(status_code=404, detail="Khong tim thay dong phieu giao hang")
        if sales_order_item_id and delivery_item.sales_order_item_id and delivery_item.sales_order_item_id != sales_order_item_id:
            raise HTTPException(status_code=400, detail="Dong phieu giao hang khong khop voi dong don ban")
        return delivery_item

    if not sales_order_item_id:
        raise HTTPException(status_code=400, detail="Can truyen delivery_order_item_id khi tra hang theo lenh san xuat")

    matches = db.query(DeliveryOrderItem).filter(
        DeliveryOrderItem.delivery_id == delivery_order_id,
        DeliveryOrderItem.sales_order_item_id == sales_order_item_id,
    ).all()
    if not matches:
        raise HTTPException(status_code=400, detail=f"Item don hang ID {sales_order_item_id} khong co trong phieu giao hang da chon")
    if len(matches) > 1:
        raise HTTPException(status_code=400, detail="Can truyen delivery_order_item_id vi phieu giao hang co nhieu dong cung item don ban")
    return matches[0]


def _returned_qty_by_delivery_item(
    db: Session,
    delivery_order_id: int,
    exclude_return_id: int | None = None,
) -> dict[int, Decimal]:
    delivery_items = db.query(DeliveryOrderItem).filter(
        DeliveryOrderItem.delivery_id == delivery_order_id,
    ).all()
    item_ids = [it.id for it in delivery_items]
    result: dict[int, Decimal] = {it.id: Decimal("0") for it in delivery_items}

    q = db.query(
        SalesReturnItem.delivery_order_item_id,
        func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0),
    ).join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id).filter(
        SalesReturn.delivery_order_id == delivery_order_id,
        SalesReturn.trang_thai != "huy",
        SalesReturnItem.delivery_order_item_id.in_(item_ids) if item_ids else False,
    )
    if exclude_return_id:
        q = q.filter(SalesReturn.id != exclude_return_id)
    for delivery_item_id, qty in q.group_by(SalesReturnItem.delivery_order_item_id).all():
        if delivery_item_id:
            result[delivery_item_id] = Decimal(str(qty or 0))

    # Legacy rows before delivery_order_item_id existed: only map when the delivery has
    # exactly one row for that sales_order_item_id, otherwise the old data is ambiguous.
    item_ids_by_sales_item: dict[int, list[int]] = {}
    for it in delivery_items:
        if it.sales_order_item_id:
            item_ids_by_sales_item.setdefault(it.sales_order_item_id, []).append(it.id)

    legacy_q = db.query(
        SalesReturnItem.sales_order_item_id,
        func.coalesce(func.sum(SalesReturnItem.so_luong_tra), 0),
    ).join(SalesReturn, SalesReturn.id == SalesReturnItem.sales_return_id).filter(
        SalesReturn.delivery_order_id == delivery_order_id,
        SalesReturn.trang_thai != "huy",
        SalesReturnItem.delivery_order_item_id.is_(None),
    )
    if exclude_return_id:
        legacy_q = legacy_q.filter(SalesReturn.id != exclude_return_id)
    for sales_order_item_id, qty in legacy_q.group_by(SalesReturnItem.sales_order_item_id).all():
        matched_item_ids = item_ids_by_sales_item.get(sales_order_item_id, [])
        if len(matched_item_ids) == 1:
            result[matched_item_ids[0]] += Decimal(str(qty or 0))

    return result


def _resolve_sales_order_item_id(
    db: Session,
    delivery_item: DeliveryOrderItem,
    sales_order_id: int,
    provided_sales_order_item_id: int | None,
) -> int:
    if provided_sales_order_item_id:
        return provided_sales_order_item_id
    if delivery_item.sales_order_item_id:
        return delivery_item.sales_order_item_id
    if delivery_item.production_order_id:
        production_item = db.query(ProductionOrderItem).filter(
            ProductionOrderItem.production_order_id == delivery_item.production_order_id,
            ProductionOrderItem.sales_order_item_id.isnot(None),
        ).first()
        if production_item and production_item.sales_order_item_id:
            return production_item.sales_order_item_id
    raise HTTPException(
        status_code=400,
        detail=f"Khong xac dinh duoc dong don ban cho dong giao hang ID {delivery_item.id}",
    )


def _prepare_return_items(
    db: Session,
    delivery_order_id: int,
    sales_order_id: int,
    items,
    exclude_return_id: int | None = None,
) -> tuple[list[tuple[SalesReturnItem, Decimal]], Decimal]:
    returned_qty = _returned_qty_by_delivery_item(db, delivery_order_id, exclude_return_id)
    requested_qty: dict[int, Decimal] = {}
    prepared: list[tuple[SalesReturnItem, Decimal]] = []
    total = Decimal("0")

    for item_data in items:
        delivery_item = _resolve_delivery_order_item(
            db,
            delivery_order_id,
            item_data.sales_order_item_id,
            item_data.delivery_order_item_id,
        )
        sales_order_item_id = _resolve_sales_order_item_id(
            db,
            delivery_item,
            sales_order_id,
            item_data.sales_order_item_id,
        )
        requested_qty[delivery_item.id] = requested_qty.get(delivery_item.id, Decimal("0")) + item_data.so_luong_tra

        sales_order_item = db.query(SalesOrderItem).filter(
            SalesOrderItem.id == sales_order_item_id,
            SalesOrderItem.order_id == sales_order_id,
        ).first()
        if not sales_order_item:
            raise HTTPException(status_code=404, detail=f"Khong tim thay item don hang ID {sales_order_item_id}")

        unit_price = item_data.don_gia_tra or sales_order_item.don_gia
        return_item = SalesReturnItem(
            delivery_order_item_id=delivery_item.id,
            sales_order_item_id=sales_order_item_id,
            so_luong_tra=item_data.so_luong_tra,
            don_gia_tra=unit_price,
            ly_do_tra=item_data.ly_do_tra,
            tinh_trang_hang=item_data.tinh_trang_hang,
            ghi_chu=item_data.ghi_chu,
        )
        prepared.append((return_item, item_data.so_luong_tra))
        total += item_data.so_luong_tra * unit_price

    for delivery_item_id, return_qty in requested_qty.items():
        delivery_item = db.get(DeliveryOrderItem, delivery_item_id)
        delivered_qty = Decimal(str(delivery_item.so_luong or 0)) if delivery_item else Decimal("0")
        already_returned = returned_qty.get(delivery_item_id, Decimal("0"))
        remaining_qty = delivered_qty - already_returned
        if return_qty > remaining_qty:
            label = delivery_item.ten_hang if delivery_item else f"dong {delivery_item_id}"
            raise HTTPException(
                status_code=400,
                detail=f"So luong tra cua {label} khong duoc vuot qua so luong con co the tra ({remaining_qty})",
            )

    return prepared, total


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

    # Bulk-compute phuong_an_can_tru + trang_thai_hoan_tien for current page
    da_duyet_ids = [r.id for r in returns if r.trang_thai == "da_duyet"]
    phuong_an_map: dict[int, str] = {}
    trang_thai_hoan_tien_map: dict[int, str | None] = {}

    if da_duyet_ids:
        vouchers = db.query(CustomerRefundVoucher).filter(
            CustomerRefundVoucher.sales_return_id.in_(da_duyet_ids)
        ).all()
        voucher_by_return: dict[int, CustomerRefundVoucher] = {
            v.sales_return_id: v for v in vouchers
        }
        for rid in da_duyet_ids:
            v = voucher_by_return.get(rid)
            trang_thai_hoan_tien_map[rid] = v.trang_thai if v else None

        invoice_ids = [v.sales_invoice_id for v in vouchers if v.sales_invoice_id]
        invoice_by_id: dict[int, SalesInvoice] = {}
        if invoice_ids:
            invs = db.query(SalesInvoice).filter(SalesInvoice.id.in_(invoice_ids)).all()
            invoice_by_id = {inv.id: inv for inv in invs}

        for rid in da_duyet_ids:
            v = voucher_by_return.get(rid)
            if v and v.sales_invoice_id:
                inv = invoice_by_id.get(v.sales_invoice_id)
                if inv and inv.da_thanh_toan >= inv.tong_cong:
                    phuong_an_map[rid] = "da_thu_tien"
                else:
                    phuong_an_map[rid] = "da_xuat_hd"
            else:
                phuong_an_map[rid] = "chua_xuat_hd"

    # Summary stats — theo context filter (customer_id, tu_ngay, den_ngay)
    def _apply_context_filter(q):
        if customer_id:
            q = q.filter(SalesReturn.customer_id == customer_id)
        if tu_ngay:
            q = q.filter(SalesReturn.ngay_tra >= tu_ngay)
        if den_ngay:
            q = q.filter(SalesReturn.ngay_tra <= den_ngay)
        return q

    summary = {
        "so_phieu_cho_duyet": _apply_context_filter(
            db.query(func.count(SalesReturn.id)).filter(SalesReturn.trang_thai == "moi")
        ).scalar() or 0,
        "so_phieu_da_duyet": _apply_context_filter(
            db.query(func.count(SalesReturn.id)).filter(SalesReturn.trang_thai == "da_duyet")
        ).scalar() or 0,
        "tong_tien_tra": float(
            _apply_context_filter(
                db.query(func.coalesce(func.sum(SalesReturn.tong_tien_tra), 0)).filter(
                    SalesReturn.trang_thai == "da_duyet"
                )
            ).scalar() or 0
        ),
        "so_hoan_tien_cho_xu_ly": db.query(func.count(CustomerRefundVoucher.id)).filter(
            CustomerRefundVoucher.trang_thai == "nhap"
        ).scalar() or 0,
    }

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
            "phuong_an_can_tru": phuong_an_map.get(r.id) if r.trang_thai == "da_duyet" else None,
            "trang_thai_hoan_tien": trang_thai_hoan_tien_map.get(r.id),
        } for r in returns],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "summary": summary,
    }


@router.get("/{return_id}", response_model=SalesReturnResponse)
def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return_obj = db.query(SalesReturn).options(
        joinedload(SalesReturn.customer),
        joinedload(SalesReturn.delivery_order),
        joinedload(SalesReturn.sales_order),
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.sales_order_item),
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.delivery_order_item),
        joinedload(SalesReturn.creator),
        joinedload(SalesReturn.approver)
    ).filter(SalesReturn.id == return_id).first()

    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")

    # Compute phuong_an_can_tru on-the-fly
    voucher = db.query(CustomerRefundVoucher).filter(
        CustomerRefundVoucher.sales_return_id == return_obj.id
    ).first()

    phuong_an: str | None = None
    invoice_id: int | None = None
    so_hoa_don: str | None = None

    if return_obj.trang_thai == "da_duyet":
        if voucher and voucher.sales_invoice_id:
            invoice = db.get(SalesInvoice, voucher.sales_invoice_id)
            invoice_id = voucher.sales_invoice_id
            so_hoa_don = invoice.so_hoa_don if invoice else None
            if invoice and invoice.da_thanh_toan >= invoice.tong_cong:
                phuong_an = "da_thu_tien"
            else:
                phuong_an = "da_xuat_hd"
        else:
            phuong_an = "chua_xuat_hd"

    response = SalesReturnResponse.model_validate(return_obj)
    response.ten_nguoi_tao = return_obj.creator.ho_ten if return_obj.creator else None
    response.ten_nguoi_duyet = return_obj.approver.ho_ten if return_obj.approver else None
    response.phuong_an_can_tru = phuong_an
    response.sales_invoice_id = invoice_id
    response.so_hoa_don = so_hoa_don
    if return_obj.delivery_order:
        response.so_phieu_giao = return_obj.delivery_order.so_phieu
        response.ngay_giao = return_obj.delivery_order.ngay_xuat
    return response


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

    if not data.delivery_order_id:
        raise HTTPException(status_code=400, detail="Phiếu trả hàng phải lấy từ một phiếu giao hàng")

    delivery_order = db.query(DeliveryOrder).filter(
        DeliveryOrder.id == data.delivery_order_id,
        DeliveryOrder.customer_id == data.customer_id,
    ).first()
    if not delivery_order:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu giao hàng tương ứng với đơn hàng và khách hàng này")

    if delivery_order.sales_order_id and delivery_order.sales_order_id != data.sales_order_id:
        raise HTTPException(status_code=400, detail="Phieu giao hang khong khop voi don hang")

    prepared_items, tong_tien_tra = _prepare_return_items(
        db,
        data.delivery_order_id,
        data.sales_order_id,
        data.items,
    )

    today_str = datetime.now().strftime('%Y%m%d')
    prefix = f"PT{today_str}"
    last = (db.query(SalesReturn)
            .filter(SalesReturn.so_phieu_tra.like(f"{prefix}%"))
            .order_by(SalesReturn.so_phieu_tra.desc())
            .first())
    seq = int(last.so_phieu_tra[len(prefix):]) + 1 if last else 1
    so_phieu_tra = f"{prefix}{seq:03d}"

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

    for return_item, _qty in prepared_items:
        return_obj.items.append(return_item)
    return_obj.tong_tien_tra = tong_tien_tra

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
    return_obj = db.query(SalesReturn).options(
        joinedload(SalesReturn.items)
    ).filter(SalesReturn.id == return_id).first()
    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")
    if return_obj.trang_thai != "moi":
        raise HTTPException(status_code=400, detail="Chỉ có thể sửa phiếu trả ở trạng thái 'Mới'")

    for field, value in data.model_dump(exclude_none=True).items():
        if field != "items":  # Handle items separately
            setattr(return_obj, field, value)

    if data.items is not None:
        if not return_obj.delivery_order_id:
            raise HTTPException(status_code=400, detail="Phieu tra hang chua gan phieu giao hang")

        prepared_items, tong_tien_tra = _prepare_return_items(
            db,
            return_obj.delivery_order_id,
            return_obj.sales_order_id,
            data.items,
            exclude_return_id=return_obj.id,
        )
        return_obj.items.clear()
        for return_item, _qty in prepared_items:
            return_obj.items.append(return_item)
        return_obj.tong_tien_tra = round(float(tong_tien_tra), 2)

    db.commit()
    return get_return(return_id, db, current_user)


@router.patch("/{return_id}/approve", response_model=SalesReturnResponse)
def approve_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions("sales_order.approve")),
):
    return_obj = db.query(SalesReturn).options(
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.sales_order_item),
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.delivery_order_item),
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

    # Ghi bút toán kế toán: Nợ 155 / Có 632 (đảo chiều entry xuất giao hàng — giá vốn)
    wh = db.get(Warehouse, warehouse_id)
    phap_nhan_id_acc = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None
    phan_xuong_id_acc = wh.phan_xuong_id if wh else None
    acc_items = [
        {
            "ten_hang": (item.sales_order_item.ten_hang if item.sales_order_item else "") or "Hàng trả về",
            "so_luong": float(item.so_luong_tra),
            "don_gia": float(item.don_gia_tra or 0),
            "tk_no": "155",
            "tk_co": "632",
        }
        for item in return_obj.items
        if item.so_luong_tra and item.don_gia_tra
    ]
    if acc_items:
        AccountingService(db).post_inventory_journal(
            ngay=return_obj.ngay_tra,
            loai="NHAP_TRA_HANG",
            chung_tu_loai="sales_returns",
            chung_tu_id=return_obj.id,
            items=acc_items,
            phap_nhan_id=phap_nhan_id_acc,
            phan_xuong_id=phan_xuong_id_acc,
        )

    # Ghi bút toán doanh thu: Nợ 5213 / Có 131 (đảo chiều doanh thu bán hàng)
    if return_obj.tong_tien_tra:
        AccountingService(db).post_inventory_journal(
            ngay=return_obj.ngay_tra,
            loai="TRA_HANG_DOANH_THU",
            chung_tu_loai="sales_returns",
            chung_tu_id=return_obj.id,
            items=[{
                "ten_hang": f"Hàng bán bị trả lại ({return_obj.so_phieu_tra})",
                "so_luong": 1,
                "don_gia": float(return_obj.tong_tien_tra),
                "tk_no": "5213",
                "tk_co": "131",
            }],
            phap_nhan_id=phap_nhan_id_acc,
            phan_xuong_id=phan_xuong_id_acc,
        )

    return_obj.trang_thai = "da_duyet"
    return_obj.approved_by = current_user.id
    return_obj.approved_at = datetime.now(timezone.utc)

    # Ghi sổ công nợ phải thu (giam_no — giảm AR khi khách trả hàng)
    db.add(DebtLedgerEntry(
        ngay=return_obj.ngay_tra or date.today(),
        loai="giam_no",
        doi_tuong="khach_hang",
        customer_id=return_obj.customer_id,
        chung_tu_loai="sales_return",
        chung_tu_id=return_obj.id,
        so_tien=return_obj.tong_tien_tra,
        ghi_chu=f"Hàng trả: {getattr(return_obj, 'so_phieu_tra', '') or ''}",
        phap_nhan_id=phap_nhan_id_acc,
    ))

    db.flush()

    # Detect SalesInvoice để phân loại trường hợp cấn trừ
    linked_invoice: SalesInvoice | None = None
    if return_obj.delivery_order_id:
        linked_invoice = (
            db.query(SalesInvoice)
            .filter(SalesInvoice.delivery_id == return_obj.delivery_order_id)
            .order_by(SalesInvoice.created_at.desc())
            .first()
        )
    if not linked_invoice and return_obj.sales_order_id:
        linked_invoice = (
            db.query(SalesInvoice)
            .filter(SalesInvoice.sales_order_id == return_obj.sales_order_id)
            .order_by(SalesInvoice.created_at.desc())
            .first()
        )

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
            sales_invoice_id=linked_invoice.id if linked_invoice else None,
            so_tien=return_obj.tong_tien_tra,
            trang_thai="nhap",
            phap_nhan_id=phap_nhan_id_acc,
            created_by=current_user.id,
        ))
    elif existing_voucher and linked_invoice and not existing_voucher.sales_invoice_id:
        existing_voucher.sales_invoice_id = linked_invoice.id

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
        joinedload(SalesReturn.items).joinedload(SalesReturnItem.delivery_order_item),
        joinedload(SalesReturn.delivery_order),
        joinedload(SalesReturn.sales_order)
    ).filter(SalesReturn.id == return_id).first()
    if not return_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu trả hàng")

    # Hủy phiếu đã duyệt yêu cầu quyền approve
    if return_obj.trang_thai == "da_duyet":
        role_code = current_user.role.ma_vai_tro if current_user.role else None
        if role_code != "ADMIN":
            from app.models.auth import RolePermission, Permission, Role
            owned = [r[0] for r in db.query(Permission.ma_quyen).join(RolePermission).join(Role).join(User).filter(User.id == current_user.id).all()]
            if "sales_order.approve" not in owned:
                raise HTTPException(status_code=403, detail="Bạn không có quyền hủy phiếu đã duyệt")

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

        # Đảo bút toán kế toán đã ghi khi duyệt (155/632)
        AccountingService(db)._reverse_journal_entries("sales_returns", return_obj.id)

        # Hoàn nguyên sổ công nợ phải thu
        db.query(DebtLedgerEntry).filter(
            DebtLedgerEntry.chung_tu_loai == "sales_return",
            DebtLedgerEntry.chung_tu_id == return_obj.id,
        ).delete(synchronize_session=False)

        # Xử lý phiếu hoàn tiền liên quan
        voucher = db.query(CustomerRefundVoucher).filter(
            CustomerRefundVoucher.sales_return_id == return_obj.id
        ).first()
        if voucher:
            if voucher.trang_thai == "da_duyet":
                raise HTTPException(
                    status_code=400,
                    detail="Không thể hủy — phiếu hoàn tiền đã được duyệt. Hãy hủy phiếu hoàn tiền trước."
                )
            db.delete(voucher)

    return_obj.trang_thai = "huy"
    db.commit()
    return {"message": "Đã hủy phiếu trả hàng"}
