from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.schemas.accounting import CustomerRefundVoucherUpdate
from app.services.accounting_service import AccountingService

router = APIRouter(prefix="/api/accounting/customer-refunds", tags=["customer-refunds"])


@router.get("")
def list_refunds(
    customer_id: int | None = Query(default=None),
    sales_return_id: int | None = Query(default=None),
    trang_thai: str | None = Query(default=None),
    tu_ngay: date | None = Query(default=None),
    den_ngay: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc = AccountingService(db)
    return svc.list_customer_refunds(
        customer_id=customer_id,
        sales_return_id=sales_return_id,
        trang_thai=trang_thai,
        tu_ngay=tu_ngay,
        den_ngay=den_ngay,
        page=page,
        page_size=page_size,
    )


@router.get("/{voucher_id}")
def get_refund(
    voucher_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_customer_refund(voucher_id)


@router.patch("/{voucher_id}")
def update_refund(
    voucher_id: int,
    data: CustomerRefundVoucherUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).update_customer_refund(voucher_id, data)


@router.patch("/{voucher_id}/approve")
def approve_refund(
    voucher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AccountingService(db).approve_customer_refund(voucher_id, current_user.id)


@router.patch("/{voucher_id}/cancel")
def cancel_refund(
    voucher_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).cancel_customer_refund(voucher_id)
