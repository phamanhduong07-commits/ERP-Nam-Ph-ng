from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.services.billing_service import BillingService
from app.schemas.billing import (
    SalesInvoiceCreate, SalesInvoiceUpdate,
    SalesInvoiceResponse, SalesInvoiceListItem,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

KE_TOAN_ROLES = ("KE_TOAN", "GIAM_DOC")
READ_ROLES = ("KE_TOAN", "GIAM_DOC", "KINH_DOANH", "MUA_HANG")


@router.get("/invoices")
def list_invoices(
    customer_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    qua_han_only: bool = Query(False),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return BillingService(db).list_invoices(
        customer_id=customer_id, trang_thai=trang_thai,
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        qua_han_only=qua_han_only, search=search,
        page=page, page_size=page_size,
    )


@router.post("/invoices", response_model=SalesInvoiceResponse)
def create_invoice(
    data: SalesInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return BillingService(db).create_invoice(data, current_user.id)


@router.get("/invoices/{invoice_id}", response_model=SalesInvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return BillingService(db).get_invoice(invoice_id)


@router.put("/invoices/{invoice_id}", response_model=SalesInvoiceResponse)
def update_invoice(
    invoice_id: int,
    data: SalesInvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return BillingService(db).update_invoice(invoice_id, data)


@router.patch("/invoices/{invoice_id}/issue", response_model=SalesInvoiceResponse)
def issue_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return BillingService(db).issue_invoice(invoice_id)


@router.patch("/invoices/{invoice_id}/cancel", response_model=SalesInvoiceResponse)
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return BillingService(db).cancel_invoice(invoice_id)


@router.post("/invoices/from-delivery/{delivery_id}", response_model=SalesInvoiceResponse)
def create_from_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return BillingService(db).create_invoice_from_delivery(delivery_id, current_user.id)


@router.post("/invoices/from-order/{order_id}", response_model=SalesInvoiceResponse)
def create_from_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return BillingService(db).create_invoice_from_order(order_id, current_user.id)
