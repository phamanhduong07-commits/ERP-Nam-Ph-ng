from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.accounting import CashReceipt, CashPayment, OpeningBalance
from app.models.master import Customer, Supplier
from app.services.accounting_service import AccountingService
from app.schemas.accounting import (
    PurchaseInvoiceCreate,
    PurchaseInvoiceResponse, PurchaseInvoiceListItem,
    CashReceiptCreate, CashReceiptResponse,
    CashPaymentCreate, CashPaymentResponse,
    OpeningBalanceCreate,
    WorkshopPayrollCreate, WorkshopPayrollResponse,
    OverheadAllocationRequest,
    FixedAssetCreate, FixedAssetResponse,
)
from app.services.excel_import_service import (
    ImportField, build_template_response, parse_bool, parse_decimal, parse_text,
)
import io, pandas as pd
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

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
    thue_suat: Decimal = Query(Decimal("8"), description="Thuế suất VAT: 0, 5, 8, 10"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_purchase_invoice_from_po(po_id, current_user.id, thue_suat=thue_suat)


@router.post("/purchase-invoices/from-gr/{gr_id}", response_model=PurchaseInvoiceResponse)
def create_purchase_invoice_from_gr(
    gr_id: int,
    thue_suat: Decimal = Query(Decimal("8"), description="Thuế suất VAT: 0, 5, 8, 10"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    return AccountingService(db).create_purchase_invoice_from_gr(gr_id, current_user.id, thue_suat=thue_suat)


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

@router.get("/ar/ledger-entries")
def ar_ledger_entries(
    customer_id: int | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_ar_ledger_entries(customer_id, tu_ngay, den_ngay)


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
# SỔ CHI TIẾT MUA HÀNG
# ─────────────────────────────────────────────

@router.get("/purchase/so-chi-tiet")
def so_chi_tiet_mua_hang(
    supplier_id: int | None = Query(None),
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_so_chi_tiet_mua_hang(supplier_id, tu_ngay, den_ngay)


# ─────────────────────────────────────────────
# BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ
# ─────────────────────────────────────────────

@router.get("/ap/doi-chieu/{supplier_id}")
def doi_chieu_cong_no(
    supplier_id: int,
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_doi_chieu_cong_no(supplier_id, tu_ngay, den_ngay)


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


_OB_AR_FIELDS = [
    ImportField("ma_kh",        "Ma KH",       required=True, parser=parse_text,    help_text="Ma khach hang phai ton tai trong he thong"),
    ImportField("ky_mo_so",     "Ngay mo so",  required=True, parser=parse_text,    help_text="YYYY-MM-DD"),
    ImportField("so_du_dau_ky", "So du (VND)", required=True, parser=parse_decimal, help_text="So no phai thu dau ky"),
    ImportField("ghi_chu",      "Ghi chu",     parser=parse_text),
]

_OB_AP_FIELDS = [
    ImportField("ma_ncc",       "Ma NCC",      required=True, parser=parse_text,    help_text="Ma nha cung cap phai ton tai trong he thong"),
    ImportField("ky_mo_so",     "Ngay mo so",  required=True, parser=parse_text,    help_text="YYYY-MM-DD"),
    ImportField("so_du_dau_ky", "So du (VND)", required=True, parser=parse_decimal, help_text="So no phai tra dau ky"),
    ImportField("ghi_chu",      "Ghi chu",     parser=parse_text),
]


@router.get("/opening-balances/template-ar")
def download_ob_ar_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_cong_no_phai_thu_dau_ky.xlsx", _OB_AR_FIELDS)


@router.get("/opening-balances/template-ap")
def download_ob_ap_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_cong_no_phai_tra_dau_ky.xlsx", _OB_AP_FIELDS)


@router.post("/opening-balances/import-ar")
async def import_opening_balances_ar(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Chi chap nhan file Excel .xlsx/.xls")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "File rong")
    df = pd.read_excel(io.BytesIO(raw), dtype=object)
    rows, created, errors_count = [], 0, 0
    objects_to_save = []
    for idx, src in df.iterrows():
        row_no = int(idx) + 2
        errs = []
        ma_kh = str(src.get("Ma KH", "") or "").strip()
        ky_mo_so_str = str(src.get("Ngay mo so", "") or "").strip()
        so_du_raw = src.get("So du (VND)")
        ghi_chu = str(src.get("Ghi chu", "") or "").strip() or None
        if not ma_kh:
            errs.append("Ma KH: bat buoc")
        if not ky_mo_so_str:
            errs.append("Ngay mo so: bat buoc")
        try:
            ky_mo_so = date.fromisoformat(ky_mo_so_str[:10])
        except Exception:
            errs.append("Ngay mo so: sai dinh dang (phai la YYYY-MM-DD)")
            ky_mo_so = None
        try:
            so_du = Decimal(str(so_du_raw).replace(",", "")) if so_du_raw is not None else None
        except Exception:
            errs.append("So du: phai la so")
            so_du = None
        if so_du is None:
            errs.append("So du: bat buoc")
        kh = db.query(Customer).filter(Customer.ma_kh == ma_kh).first() if ma_kh else None
        if ma_kh and not kh:
            errs.append(f"Ma KH: khong ton tai '{ma_kh}'")
        if errs:
            errors_count += 1
            rows.append({"row": row_no, "status": "error", "errors": errs, "data": {}})
            continue
        ob = db.query(OpeningBalance).filter(
            OpeningBalance.doi_tuong == "khach_hang",
            OpeningBalance.customer_id == kh.id,
            OpeningBalance.ky_mo_so == ky_mo_so,
        ).first()
        status = "update" if ob else "create"
        objects_to_save.append((ob, {"doi_tuong": "khach_hang", "customer_id": kh.id, "ky_mo_so": ky_mo_so, "so_du_dau_ky": so_du, "ghi_chu": ghi_chu, "created_by": current_user.id}))
        created += 1
        rows.append({"row": row_no, "status": status, "errors": [], "data": {"ma_kh": ma_kh, "so_du": str(so_du)}})
    if commit and errors_count == 0:
        for ob, vals in objects_to_save:
            if ob:
                for k, v in vals.items():
                    setattr(ob, k, v)
            else:
                db.add(OpeningBalance(**vals))
        db.commit()
    return {"commit": commit, "total": len(rows), "created": created, "updated": 0, "skipped": 0, "errors": errors_count, "rows": rows[:200]}


@router.post("/opening-balances/import-ap")
async def import_opening_balances_ap(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Chi chap nhan file Excel .xlsx/.xls")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "File rong")
    df = pd.read_excel(io.BytesIO(raw), dtype=object)
    rows, created, errors_count = [], 0, 0
    objects_to_save = []
    for idx, src in df.iterrows():
        row_no = int(idx) + 2
        errs = []
        ma_ncc = str(src.get("Ma NCC", "") or "").strip()
        ky_mo_so_str = str(src.get("Ngay mo so", "") or "").strip()
        so_du_raw = src.get("So du (VND)")
        ghi_chu = str(src.get("Ghi chu", "") or "").strip() or None
        if not ma_ncc:
            errs.append("Ma NCC: bat buoc")
        if not ky_mo_so_str:
            errs.append("Ngay mo so: bat buoc")
        try:
            ky_mo_so = date.fromisoformat(ky_mo_so_str[:10])
        except Exception:
            errs.append("Ngay mo so: sai dinh dang (phai la YYYY-MM-DD)")
            ky_mo_so = None
        try:
            so_du = Decimal(str(so_du_raw).replace(",", "")) if so_du_raw is not None else None
        except Exception:
            errs.append("So du: phai la so")
            so_du = None
        if so_du is None:
            errs.append("So du: bat buoc")
        ncc = db.query(Supplier).filter(Supplier.ma_ncc == ma_ncc).first() if ma_ncc else None
        if ma_ncc and not ncc:
            errs.append(f"Ma NCC: khong ton tai '{ma_ncc}'")
        if errs:
            errors_count += 1
            rows.append({"row": row_no, "status": "error", "errors": errs, "data": {}})
            continue
        ob = db.query(OpeningBalance).filter(
            OpeningBalance.doi_tuong == "nha_cung_cap",
            OpeningBalance.supplier_id == ncc.id,
            OpeningBalance.ky_mo_so == ky_mo_so,
        ).first()
        status = "update" if ob else "create"
        objects_to_save.append((ob, {"doi_tuong": "nha_cung_cap", "supplier_id": ncc.id, "ky_mo_so": ky_mo_so, "so_du_dau_ky": so_du, "ghi_chu": ghi_chu, "created_by": current_user.id}))
        created += 1
        rows.append({"row": row_no, "status": status, "errors": [], "data": {"ma_ncc": ma_ncc, "so_du": str(so_du)}})
    if commit and errors_count == 0:
        for ob, vals in objects_to_save:
            if ob:
                for k, v in vals.items():
                    setattr(ob, k, v)
            else:
                db.add(OpeningBalance(**vals))
        db.commit()
    return {"commit": commit, "total": len(rows), "created": created, "updated": 0, "skipped": 0, "errors": errors_count, "rows": rows[:200]}


# ─────────────────────────────────────────────
# SỐ DƯ ĐẦU KỲ — QUỸ TIỀN MẶT
# ─────────────────────────────────────────────

@router.get("/opening-balances/cash/import-template")
def download_ob_cash_template(_: User = Depends(get_current_user)):
    return build_template_response(
        "mau_import_so_du_quy_tien_mat.xlsx",
        [
            ImportField("ky_mo_so",     "Ngay mo so",  required=True, parser=parse_text,    help_text="YYYY-MM-DD — ngay go-live (bat dau mo so quy)"),
            ImportField("so_du_dau_ky", "So du (VND)", required=True, parser=parse_decimal, help_text="So du quy tien mat dau ky"),
            ImportField("ghi_chu",      "Ghi chu",     parser=parse_text),
        ],
    )


@router.post("/opening-balances/cash/import")
async def import_ob_cash(
    commit: bool = Query(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Chi chap nhan file Excel .xlsx/.xls")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "File rong")
    df = pd.read_excel(io.BytesIO(raw), dtype=object)
    rows, created, errors_count = [], 0, 0
    objects_to_save = []
    for idx, src in df.iterrows():
        row_no = int(idx) + 2
        errs = []
        ky_mo_so_str = str(src.get("Ngay mo so", "") or "").strip()
        so_du_raw = src.get("So du (VND)")
        ghi_chu = str(src.get("Ghi chu", "") or "").strip() or None
        if not ky_mo_so_str:
            errs.append("Ngay mo so: bat buoc")
        try:
            ky_mo_so = date.fromisoformat(ky_mo_so_str[:10])
        except Exception:
            errs.append("Ngay mo so: sai dinh dang (phai la YYYY-MM-DD)")
            ky_mo_so = None
        try:
            so_du = Decimal(str(so_du_raw).replace(",", "")) if so_du_raw is not None else None
        except Exception:
            errs.append("So du: phai la so")
            so_du = None
        if so_du is None:
            errs.append("So du: bat buoc")
        if errs:
            errors_count += 1
            rows.append({"row": row_no, "status": "error", "errors": errs, "data": {}})
            continue
        ob = db.query(OpeningBalance).filter(
            OpeningBalance.doi_tuong == "quy_tien_mat",
            OpeningBalance.ky_mo_so == ky_mo_so,
        ).first()
        status = "update" if ob else "create"
        objects_to_save.append((ob, {
            "doi_tuong": "quy_tien_mat",
            "ky_mo_so": ky_mo_so,
            "so_du_dau_ky": so_du,
            "ghi_chu": ghi_chu,
            "created_by": current_user.id,
        }))
        created += 1
        rows.append({"row": row_no, "status": status, "errors": [], "data": {"ky_mo_so": str(ky_mo_so), "so_du": str(so_du)}})
    if commit and errors_count == 0:
        for ob, vals in objects_to_save:
            if ob:
                for k, v in vals.items():
                    setattr(ob, k, v)
            else:
                db.add(OpeningBalance(**vals))
        db.commit()
    return {"commit": commit, "total": len(rows), "created": created, "updated": 0, "skipped": 0, "errors": errors_count, "rows": rows[:200]}


# ─────────────────────────────────────────────
# SỔ QUỸ TIỀN MẶT
# ─────────────────────────────────────────────

@router.get("/cash-book")
def cash_book(
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    phap_nhan_id: int | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    return AccountingService(db).get_trial_balance(tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id)


# ─────────────────────────────────────────────
# SỔ NGÂN HÀNG
# ─────────────────────────────────────────────

@router.get("/bank-ledger")
def bank_ledger(
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    so_tai_khoan: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return AccountingService(db).get_bank_ledger(tu_ngay, den_ngay, so_tai_khoan)


# ─────────────────────────────────────────────
# BÁO CÁO TÀI CHÍNH
# ─────────────────────────────────────────────

@router.get("/reports/pnl")
def get_pnl_report(
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    phap_nhan_id: int | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo Kết quả kinh doanh (P&L)"""
    return AccountingService(db).get_pnl(tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id)


@router.get("/reports/balance-sheet")
def get_balance_sheet(
    ngay: date = Query(...),
    phap_nhan_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Bảng cân đối kế toán"""
    return AccountingService(db).get_balance_sheet(ngay, phap_nhan_id)


@router.post("/reports/perform-closing")
def perform_closing(
    thang: int = Query(...),
    nam: int = Query(...),
    phap_nhan_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thực hiện kết chuyển lãi lỗ cuối kỳ"""
    return AccountingService(db).perform_closing(thang, nam, phap_nhan_id, current_user.id)


# ─────────────────────────────────────────────
# IN PHIẾU
# ─────────────────────────────────────────────

def _so_thanh_chu(n: float) -> str:
    """Chuyển số tiền VNĐ sang chữ tiếng Việt."""
    n = int(round(n))
    if n == 0:
        return "Không đồng"

    don_vi = ["", "nghìn", "triệu", "tỷ"]
    chu_so = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]

    def doc_ba_chu_so(num: int, is_first: bool) -> str:
        tram = num // 100
        chuc = (num % 100) // 10
        dv = num % 10
        result = ""
        if tram > 0:
            result += chu_so[tram] + " trăm "
        elif not is_first:
            result += "không trăm "
        if chuc == 0 and dv == 0:
            return result.strip()
        if chuc == 0:
            if result:
                result += "lẻ " + chu_so[dv]
            else:
                result += chu_so[dv]
        elif chuc == 1:
            result += "mười "
            if dv == 5:
                result += "lăm"
            elif dv > 0:
                result += chu_so[dv]
        else:
            result += chu_so[chuc] + " mươi "
            if dv == 1:
                result += "mốt"
            elif dv == 5:
                result += "lăm"
            elif dv > 0:
                result += chu_so[dv]
        return result.strip()

    parts = []
    idx = 0
    while n > 0:
        nhom = n % 1000
        if nhom != 0:
            txt = doc_ba_chu_so(nhom, idx == 0 and n < 1000)
            if don_vi[idx]:
                txt += " " + don_vi[idx]
            parts.append(txt)
        n //= 1000
        idx += 1

    result = ", ".join(reversed(parts))
    return result.capitalize() + " đồng"


def _ngay_str(d) -> str:
    if not d:
        return ""
    s = str(d)
    parts = s.split("-")
    if len(parts) == 3:
        return f"Ngày {parts[2]} tháng {parts[1]} năm {parts[0]}"
    return s


HINH_THUC_LABEL = {
    "tien_mat": "Tiền mặt",
    "chuyen_khoan": "Chuyển khoản",
    "TM": "Tiền mặt",
    "CK": "Chuyển khoản",
    "bu_tru_cong_no": "Bù trừ công nợ",
    "khac": "Khác",
}

_PRINT_CSS = """
@page {{ size: A5 portrait; margin: 10mm 10mm; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'Times New Roman', serif; font-size: 10pt; color: #111; }}
.no-print {{ margin-bottom: 8px; }}
@media print {{ .no-print {{ display: none; }} }}
.header {{ display: flex; justify-content: space-between; align-items: flex-start; }}
.company-name {{ font-size: 11pt; font-weight: bold; color: {accent}; }}
.company-info {{ font-size: 8pt; line-height: 1.5; color: #333; }}
.mau {{ font-size: 8pt; text-align: right; color: #555; }}
.divider {{ border: none; border-top: 2px solid {accent}; margin: 6px 0; }}
.title {{ text-align: center; margin: 6px 0; }}
.title h2 {{ font-size: 15pt; font-weight: bold; letter-spacing: 2px; color: #111; text-transform: uppercase; }}
.title .so {{ font-size: 9pt; color: #333; margin-top: 2px; }}
.title .ngay {{ font-style: italic; font-size: 9pt; color: #333; }}
.info-block {{ font-size: 10pt; line-height: 1.9; margin: 8px 0; }}
.row {{ display: flex; margin: 2px 0; }}
.row .label {{ min-width: 110px; font-weight: bold; flex-shrink: 0; }}
.row .dots {{ flex: 1; border-bottom: 1px dotted #888; padding-left: 4px; }}
.amount-box {{ border: 1.5px solid {accent}; border-radius: 3px; padding: 6px 10px;
               text-align: center; font-size: 13pt; font-weight: bold;
               color: {accent}; margin: 8px 0; }}
.chu {{ font-size: 9.5pt; margin: 4px 0; }}
.tk-row {{ display: flex; gap: 20px; font-size: 9pt; margin: 4px 0; }}
.sig-table {{ width: 100%; border-collapse: collapse; margin-top: 14px; }}
.sig-table td {{ border: none; text-align: center; vertical-align: top; width: 20%; padding: 2px; }}
.sig-label {{ font-weight: bold; font-size: 9pt; }}
.sig-sub {{ font-style: italic; font-size: 8pt; color: #555; }}
.sig-name {{ margin-top: 28px; font-weight: bold; font-size: 9pt; }}
"""


@router.get("/receipts/{receipt_id}/print", response_class=HTMLResponse)
def print_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = db.get(CashReceipt, receipt_id)
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu thu")

    accent = "#1565C0"
    ten_kh = r.customer.ten_viet_tat if r.customer else ""
    dia_chi_kh = r.customer.dia_chi if r.customer else ""
    hinh_thuc = HINH_THUC_LABEL.get(r.hinh_thuc_tt, r.hinh_thuc_tt)
    so_tien_chu = _so_thanh_chu(float(r.so_tien))

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu thu {r.so_phieu}</title>
<style>{_PRINT_CSS.format(accent=accent)}</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:6px 16px;background:{accent};color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10pt;">
    🖨 In phiếu
  </button>
</div>
<div class="header">
  <div>
    <div class="company-name">CÔNG TY TNHH NAM PHƯƠNG BAO BÌ</div>
    <div class="company-info">
      Địa chỉ: 123 Đường Nguyễn Văn Linh, Q.7, TP.HCM<br>
      MST: 0312345678 &nbsp;|&nbsp; ĐT: (028) 3456 7890
    </div>
  </div>
  <div class="mau">
    Mẫu số: 01-TT<br>
    (Ban hành theo TT 200/2014/TT-BTC)
  </div>
</div>
<hr class="divider">
<div class="title">
  <h2>Phiếu thu</h2>
  <div class="so">Số: {r.so_phieu}</div>
  <div class="ngay">{_ngay_str(r.ngay_phieu)}</div>
</div>
<div class="info-block">
  <div class="row"><span class="label">Họ tên người nộp:</span><span class="dots">{ten_kh}</span></div>
  <div class="row"><span class="label">Địa chỉ:</span><span class="dots">{dia_chi_kh or ''}</span></div>
  <div class="row"><span class="label">Lý do nộp:</span><span class="dots">{r.dien_giai or ''}</span></div>
  <div class="row"><span class="label">Hình thức TT:</span><span class="dots">{hinh_thuc}</span></div>
  {"<div class='row'><span class='label'>Số TK / Tham chiếu:</span><span class='dots'>" + (r.so_tai_khoan or '') + (' / ' + r.so_tham_chieu if r.so_tham_chieu else '') + "</span></div>" if r.so_tai_khoan or r.so_tham_chieu else ''}
</div>
<div class="amount-box">{float(r.so_tien):,.0f} đồng</div>
<div class="chu">Viết bằng chữ: <em>{so_tien_chu}</em></div>
<div class="tk-row">
  <span>TK Nợ: <strong>{r.tk_no}</strong></span>
  <span>TK Có: <strong>{r.tk_co}</strong></span>
  <span>Chứng từ gốc: 1 bản</span>
</div>
<table class="sig-table">
  <tr>
    <td><div class="sig-label">Giám đốc</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">KT trưởng</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Người nộp tiền</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Người lập phiếu</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Thủ quỹ</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
  </tr>
</table>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/payments/{payment_id}/print", response_class=HTMLResponse)
def print_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(CashPayment, payment_id)
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chi")

    accent = "#B71C1C"
    ten_ncc = p.supplier.ten_viet_tat if p.supplier else ""
    dia_chi_ncc = p.supplier.dia_chi if p.supplier else ""
    hinh_thuc = HINH_THUC_LABEL.get(p.hinh_thuc_tt, p.hinh_thuc_tt)
    so_tien_chu = _so_thanh_chu(float(p.so_tien))

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu chi {p.so_phieu}</title>
<style>{_PRINT_CSS.format(accent=accent)}</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:6px 16px;background:{accent};color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10pt;">
    🖨 In phiếu
  </button>
</div>
<div class="header">
  <div>
    <div class="company-name">CÔNG TY TNHH NAM PHƯƠNG BAO BÌ</div>
    <div class="company-info">
      Địa chỉ: 123 Đường Nguyễn Văn Linh, Q.7, TP.HCM<br>
      MST: 0312345678 &nbsp;|&nbsp; ĐT: (028) 3456 7890
    </div>
  </div>
  <div class="mau">
    Mẫu số: 02-TT<br>
    (Ban hành theo TT 200/2014/TT-BTC)
  </div>
</div>
<hr class="divider">
<div class="title">
  <h2>Phiếu chi</h2>
  <div class="so">Số: {p.so_phieu}</div>
  <div class="ngay">{_ngay_str(p.ngay_phieu)}</div>
</div>
<div class="info-block">
  <div class="row"><span class="label">Họ tên người nhận:</span><span class="dots">{ten_ncc}</span></div>
  <div class="row"><span class="label">Địa chỉ:</span><span class="dots">{dia_chi_ncc or ''}</span></div>
  <div class="row"><span class="label">Lý do chi:</span><span class="dots">{p.dien_giai or ''}</span></div>
  <div class="row"><span class="label">Hình thức TT:</span><span class="dots">{hinh_thuc}</span></div>
  {"<div class='row'><span class='label'>Số TK / Tham chiếu:</span><span class='dots'>" + (p.so_tai_khoan or '') + (' / ' + p.so_tham_chieu if p.so_tham_chieu else '') + "</span></div>" if p.so_tai_khoan or p.so_tham_chieu else ''}
</div>
<div class="amount-box">{float(p.so_tien):,.0f} đồng</div>
<div class="chu">Viết bằng chữ: <em>{so_tien_chu}</em></div>
<div class="tk-row">
  <span>TK Nợ: <strong>{p.tk_no}</strong></span>
  <span>TK Có: <strong>{p.tk_co}</strong></span>
  <span>Chứng từ gốc: 1 bản</span>
</div>
<table class="sig-table">
  <tr>
    <td><div class="sig-label">Giám đốc</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">KT trưởng</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Người nhận tiền</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Người lập phiếu</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Thủ quỹ</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
  </tr>
</table>
</body>
</html>"""
    return HTMLResponse(content=html)

@router.get("/ar/reconciliation/{customer_id}")
def get_customer_reconciliation(
    customer_id: int,
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Lấy dữ liệu đối chiếu công nợ khách hàng dựa trên giao hàng và thanh toán."""
    return AccountingService(db).get_customer_reconciliation(customer_id, tu_ngay, den_ngay)

@router.get("/ap/reconciliation/{supplier_id}")
def get_supplier_reconciliation(
    supplier_id: int,
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Lấy dữ liệu đối chiếu công nợ nhà cung cấp dựa trên nhập kho và phiếu chi."""
    return AccountingService(db).get_supplier_reconciliation(supplier_id, tu_ngay, den_ngay)

@router.get("/general-ledger")
def get_general_ledger(
    so_tk: str = Query(...),
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    phap_nhan_id: int | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Lấy sổ cái chi tiết tài khoản."""
    return AccountingService(db).get_general_ledger(so_tk, tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id)

@router.get("/trial-balance")
def get_trial_balance(
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    phap_nhan_id: int | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Lấy bảng cân đối số phát sinh."""
    return AccountingService(db).get_trial_balance(tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id)


# ─────────────────────────────────────────────
# BÁO CÁO QUẢN TRỊ
# ─────────────────────────────────────────────

@router.get("/reports/workshop-pnl")
def get_workshop_pnl(
    phan_xuong_id: int,
    tu_ngay: date,
    den_ngay: date,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo Lãi/Lỗ theo Phân xưởng"""
    return AccountingService(db).get_workshop_pnl(phan_xuong_id, tu_ngay, den_ngay)


@router.get("/reports/legal-entity-cashflow")
def get_legal_entity_cashflow(
    phap_nhan_id: int,
    tu_ngay: date,
    den_ngay: date,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo Dòng tiền theo Pháp nhân"""
    return AccountingService(db).get_legal_entity_cashflow(phap_nhan_id, tu_ngay, den_ngay)


@router.get("/reports/production-costing")
def get_production_costing(
    tu_ngay: date,
    den_ngay: date,
    phan_xuong_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Báo cáo Giá thành Sản xuất thực tế"""
    return AccountingService(db).get_production_costing(tu_ngay, den_ngay, phan_xuong_id)


# ─────────────────────────────────────────────
# BÁO CÁO THUẾ
# ─────────────────────────────────────────────

@router.get("/reports/trial-balance-tax")
def get_trial_balance_tax(
    tu_ngay: date = Query(...),
    den_ngay: date = Query(...),
    phap_nhan_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Bảng CĐPS dùng cho kê khai thuế/BCTC — loại TK nội bộ 5112/6322/1368/3368."""
    return AccountingService(db).get_trial_balance_tax(tu_ngay, den_ngay, phap_nhan_id)


@router.get("/reports/vat-summary")
def get_vat_summary(
    thang: int = Query(..., ge=1, le=12),
    nam: int = Query(..., ge=2020),
    phap_nhan_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tổng hợp thuế GTGT theo tháng — đầu ra/đầu vào/số phải nộp (mẫu 01/GTGT)."""
    return AccountingService(db).get_vat_summary(thang, nam, phap_nhan_id)


# ─────────────────────────────────────────────
# BẢNG LƯƠNG XƯỞNG
# ─────────────────────────────────────────────

@router.get("/workshop-payroll")
def list_workshop_payroll(
    phan_xuong_id: int | None = Query(None),
    phap_nhan_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Danh sách bảng lương xưởng"""
    return AccountingService(db).list_workshop_payroll(phan_xuong_id, phap_nhan_id)


@router.post("/workshop-payroll", response_model=WorkshopPayrollResponse)
def create_workshop_payroll(
    data: WorkshopPayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Tạo bảng lương xưởng"""
    return AccountingService(db).create_workshop_payroll(data, current_user.id)


@router.get("/journal-entries")
def list_journal_entries(
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    loai_but_toan: str | None = Query(None),
    phap_nhan_id: int | None = Query(None),
    phan_xuong_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.accounting import JournalEntry
    from sqlalchemy import desc
    q = db.query(JournalEntry)
    if tu_ngay: q = q.filter(JournalEntry.ngay_but_toan >= tu_ngay)
    if den_ngay: q = q.filter(JournalEntry.ngay_but_toan <= den_ngay)
    if loai_but_toan: q = q.filter(JournalEntry.loai_but_toan == loai_but_toan)
    if phap_nhan_id: q = q.filter(JournalEntry.phap_nhan_id == phap_nhan_id)
    if phan_xuong_id: q = q.filter(JournalEntry.phan_xuong_id == phan_xuong_id)
    
    total = q.count()
    items = q.order_by(desc(JournalEntry.ngay_but_toan), desc(JournalEntry.id))\
             .offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": items}

@router.post("/journal-entries")
def create_manual_journal_entry(
    data: dict, # Simplification for now, or use a Schema
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Tạo bút toán tổng hợp thủ công"""
    return AccountingService(db)._create_journal_entry(
        ngay=date.fromisoformat(data['ngay_but_toan']),
        dien_giai=data['dien_giai'],
        loai_but_toan='tong_hop',
        chung_tu_loai='tong_hop',
        chung_tu_id=None,
        lines=data['lines'],
        phap_nhan_id=data.get('phap_nhan_id'),
        phan_xuong_id=data.get('phan_xuong_id'),
    )


@router.patch("/workshop-payroll/{wp_id}/approve", response_model=WorkshopPayrollResponse)
def approve_workshop_payroll(
    wp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Duyệt bảng lương và hạch toán vào chi phí xưởng (154)"""
    return AccountingService(db).approve_workshop_payroll(wp_id, current_user.id)


@router.post("/allocate-overhead")
def allocate_overhead(
    data: OverheadAllocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Thực hiện phân bổ chi phí chung cho các xưởng"""
    return AccountingService(db).allocate_overhead(
        tu_ngay=data.tu_ngay,
        den_ngay=data.den_ngay,
        so_tk=data.so_tk,
        allocations=[a.dict() for a in data.allocations],
        phap_nhan_id=data.phap_nhan_id,
        user_id=current_user.id
    )


# ─────────────────────────────────────────────
# TÀI SẢN CỐ ĐỊNH & KHẤU HAO
# ─────────────────────────────────────────────

@router.get("/fixed-assets", response_model=list[FixedAssetResponse])
def list_fixed_assets(
    phan_xuong_id: int | None = Query(None),
    phap_nhan_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.accounting import FixedAsset
    q = db.query(FixedAsset)
    if phan_xuong_id:
        q = q.filter(FixedAsset.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.filter(FixedAsset.phap_nhan_id == phap_nhan_id)
    if trang_thai:
        q = q.filter(FixedAsset.trang_thai == trang_thai)
    return q.order_by(FixedAsset.ngay_mua.desc()).all()


@router.get("/fixed-assets/{asset_id}", response_model=FixedAssetResponse)
def get_fixed_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.accounting import FixedAsset
    asset = db.get(FixedAsset, asset_id)
    if not asset:
        raise HTTPException(404, "Không tìm thấy tài sản")
    return asset


@router.post("/fixed-assets", response_model=FixedAssetResponse)
def create_fixed_asset(
    data: FixedAssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Đăng ký tài sản cố định mới"""
    return AccountingService(db).create_fixed_asset(data)


@router.get("/fixed-assets")
def list_fixed_assets(
    phan_xuong_id: int = Query(None),
    phap_nhan_id: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Danh sách tài sản cố định"""
    return AccountingService(db).list_fixed_assets(phan_xuong_id, phap_nhan_id)


@router.post("/fixed-assets/run-depreciation")
def run_depreciation(
    thang: int = Query(...),
    nam: int = Query(...),
    phap_nhan_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    """Chạy khấu hao hàng tháng cho toàn bộ tài sản"""
    return AccountingService(db).run_monthly_depreciation(thang, nam, phap_nhan_id, current_user.id)


# ─────────────────────────────────────────────
# IMPORT EXCEL
# ─────────────────────────────────────────────

@router.get("/fixed-assets/import-template")
def get_fixed_asset_template():
    from app.services.excel_import_service import build_template_response
    from app.services.accounting_import_service import FIXED_ASSET_FIELDS
    return build_template_response("Mau_Import_Tai_San.xlsx", FIXED_ASSET_FIELDS)

@router.post("/fixed-assets/import")
async def import_fixed_assets(
    file: UploadFile = File(...),
    commit: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    from app.services.excel_import_service import import_excel
    from app.services.accounting_import_service import FIXED_ASSET_FIELDS, fixed_asset_resolver
    from app.models.accounting import FixedAsset
    return await import_excel(
        db=db, file=file, model=FixedAsset, fields=FIXED_ASSET_FIELDS,
        key_field="ma_ts", commit=commit, resolver=fixed_asset_resolver,
        user=user, loai_du_lieu="tai_san_co_dinh"
    )

@router.get("/workshop-payroll/import-template")
def get_workshop_payroll_template():
    from app.services.excel_import_service import build_template_response
    from app.services.accounting_import_service import WORKSHOP_PAYROLL_FIELDS
    return build_template_response("Mau_Import_Luong_Xuong.xlsx", WORKSHOP_PAYROLL_FIELDS)

@router.post("/workshop-payroll/import")
async def import_workshop_payroll(
    file: UploadFile = File(...),
    commit: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*KE_TOAN_ROLES)),
):
    from app.services.excel_import_service import import_excel
    from app.services.accounting_import_service import WORKSHOP_PAYROLL_FIELDS, workshop_payroll_resolver
    from app.models.accounting import WorkshopPayroll
    return await import_excel(
        db=db, file=file, model=WorkshopPayroll, fields=WORKSHOP_PAYROLL_FIELDS,
        key_field="id", # Payroll usually creates new records
        commit=commit, resolver=workshop_payroll_resolver,
        user=user, loai_du_lieu="luong_xuong"
    )
