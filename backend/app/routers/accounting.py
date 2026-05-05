from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.services.accounting_service import AccountingService
from app.schemas.accounting import (
    PurchaseInvoiceCreate,
    PurchaseInvoiceResponse, PurchaseInvoiceListItem,
    CashReceiptCreate, CashReceiptResponse,
    CashPaymentCreate, CashPaymentResponse,
    OpeningBalanceCreate,
)

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

KE_TOAN_ROLES = ("KE_TOAN", "GIAM_DOC")


# ─────────────────────────────────────────────
# PHIẾU THU
# ─────────────────────────────────────────────

@router.get("/receipts")
def list_receipts(
    customer_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).list_receipts(
        customer_id=customer_id, trang_thai=trang_thai,
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        page=page, page_size=page_size,
    )


@router.post("/receipts", response_model=CashReceiptResponse)
def create_receipt(
    data: CashReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_cash_receipt(data, current_user.id)


@router.get("/receipts/{receipt_id}", response_model=CashReceiptResponse)
def get_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_receipt(receipt_id)


@router.patch("/receipts/{receipt_id}/approve", response_model=CashReceiptResponse)
def approve_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).approve_receipt(receipt_id, current_user.id)


@router.patch("/receipts/{receipt_id}/cancel", response_model=CashReceiptResponse)
def cancel_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).cancel_receipt(receipt_id)


# ─────────────────────────────────────────────
# HÓA ĐƠN MUA HÀNG
# ─────────────────────────────────────────────

@router.get("/purchase-invoices")
def list_purchase_invoices(
    supplier_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    qua_han_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).list_purchase_invoices(
        supplier_id=supplier_id, trang_thai=trang_thai,
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        qua_han_only=qua_han_only,
        page=page, page_size=page_size,
    )


@router.post("/purchase-invoices", response_model=PurchaseInvoiceResponse)
def create_purchase_invoice(
    data: PurchaseInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_purchase_invoice(data, current_user.id)


@router.get("/purchase-invoices/{inv_id}", response_model=PurchaseInvoiceResponse)
def get_purchase_invoice(
    inv_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_purchase_invoice(inv_id)


@router.post("/purchase-invoices/from-po/{po_id}", response_model=PurchaseInvoiceResponse)
def create_purchase_invoice_from_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_purchase_invoice_from_po(po_id, current_user.id)


@router.post("/purchase-invoices/from-gr/{gr_id}", response_model=PurchaseInvoiceResponse)
def create_purchase_invoice_from_gr(
    gr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_purchase_invoice_from_gr(gr_id, current_user.id)


# ─────────────────────────────────────────────
# PHIẾU CHI
# ─────────────────────────────────────────────

@router.get("/payments")
def list_payments(
    supplier_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).list_payments(
        supplier_id=supplier_id, trang_thai=trang_thai,
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        page=page, page_size=page_size,
    )


@router.post("/payments", response_model=CashPaymentResponse)
def create_payment(
    data: CashPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_cash_payment(data, current_user.id)


@router.get("/payments/{payment_id}", response_model=CashPaymentResponse)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_payment(payment_id)


@router.patch("/payments/{payment_id}/approve", response_model=CashPaymentResponse)
def approve_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).approve_payment(payment_id, current_user.id)


@router.patch("/payments/{payment_id}/cancel", response_model=CashPaymentResponse)
def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).cancel_payment(payment_id)


# ─────────────────────────────────────────────
# SỔ CÔNG NỢ — AR (phải thu)
# ─────────────────────────────────────────────

@router.get("/ar/ledger")
def ar_ledger(
    customer_id: int | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    trang_thai: str | None = Query(None),
    qua_han_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_ar_ledger(
        customer_id=customer_id, tu_ngay=tu_ngay, den_ngay=den_ngay,
        trang_thai=trang_thai, qua_han_only=qua_han_only,
    )


@router.get("/ar/aging")
def ar_aging(
    as_of_date: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_ar_aging(as_of_date)


@router.get("/ar/balance")
def ar_balance(
    customer_id: int | None = Query(None),
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_ar_balance(customer_id, tu_ngay, den_ngay)


# ─────────────────────────────────────────────
# SỔ CÔNG NỢ — AP (phải trả)
# ─────────────────────────────────────────────

@router.get("/ap/ledger")
def ap_ledger(
    supplier_id: int | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    trang_thai: str | None = Query(None),
    qua_han_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_ap_ledger(
        supplier_id=supplier_id, tu_ngay=tu_ngay, den_ngay=den_ngay,
        trang_thai=trang_thai, qua_han_only=qua_han_only,
    )


@router.get("/ap/aging")
def ap_aging(
    as_of_date: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_ap_aging(as_of_date)


@router.get("/ap/balance")
def ap_balance(
    supplier_id: int | None = Query(None),
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_ap_balance(supplier_id, tu_ngay, den_ngay)


# ─────────────────────────────────────────────
# SỐ DƯ ĐẦU KỲ (nhập từ AMIS khi chuyển đổi)
# ─────────────────────────────────────────────

@router.post("/opening-balances")
def create_opening_balance(
    data: OpeningBalanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_opening_balance(data, current_user.id)
