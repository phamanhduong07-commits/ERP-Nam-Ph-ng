import os
import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse
from app.utils.template import apply_template, standard_vars
from app.utils.print_utils import get_selected_columns, build_html_table
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import build_customer_scope_subquery, get_current_user, require_roles
from app.models.auth import User
from app.models.billing import SalesInvoice, InvoiceAdjustmentLog
from app.services.billing_service import BillingService
from app.schemas.billing import (
    AdjustmentApprove,
    AdjustmentRequest,
    InvoiceAdjustmentLogResponse,
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesInvoiceResponse,
)

import html as _html_mod

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _logo_img(pn, settings: dict) -> str:
    src = (
        f"/api/phap-nhan/logo/{pn.ma_phap_nhan}" if pn and pn.ma_phap_nhan
        else settings.get("logo_url") or ""
    )
    return f'<img src="{_html_mod.escape(src)}" style="max-height:50px;max-width:100%;object-fit:contain"/>' if src else ""

# ── Role groups ──────────────────────────────────────────────────────────────
CREATE_ROLES = ("KE_TOAN_CONG_NO", "KE_TOAN_MUA_HANG", "KE_TOAN_TRUONG", "BGD_GIAM_DOC")
EDIT_ROLES = ("SALE_ADMIN", "TRUONG_PHONG_SALE_ADMIN", "KE_TOAN_CONG_NO", "KE_TOAN_MUA_HANG", "KE_TOAN_TRUONG", "BGD_GIAM_DOC")
ADJUST_ROLES = ("KE_TOAN_CONG_NO", "KE_TOAN_TRUONG", "BGD_GIAM_DOC")
APPROVE_ROLES = ("KE_TOAN_TRUONG", "BGD_GIAM_DOC")
READ_ROLES = ("SALE_ADMIN", "TRUONG_PHONG_SALE_ADMIN", "KE_TOAN_CONG_NO", "KE_TOAN_MUA_HANG", "KE_TOAN_TRUONG", "KETOAN_NHAN_VIEN", "BGD_GIAM_DOC", "BGD_TO_TRUONG", "KINH_DOANH_TO_TRUONG", "KINH_DOANH_NHAN_VIEN", "MUA_HANG_TRUONG_PHONG", "MUA_HANG_NHAN_VIEN")

_UPLOAD_DIR = "uploads/invoices"


def _ensure_upload_dir():
    os.makedirs(_UPLOAD_DIR, exist_ok=True)


# ── List / Get ───────────────────────────────────────────────────────────────

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
    phap_nhan_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*READ_ROLES)),
):
    scope_customer_ids = build_customer_scope_subquery(current_user, db)
    return BillingService(db).list_invoices(
        customer_id=customer_id, trang_thai=trang_thai,
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        qua_han_only=qua_han_only, search=search,
        page=page, page_size=page_size,
        phap_nhan_id=phap_nhan_id,
        scope_customer_ids=scope_customer_ids,
    )


@router.get("/invoices/{invoice_id}", response_model=SalesInvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*READ_ROLES)),
):
    inv = BillingService(db).get_invoice(invoice_id)
    # Gắn tên người điều chỉnh vào log để response_model serialize đúng
    for lg in inv.adjustment_logs:
        lg.adjusted_by_name = lg.adjusted_by.ho_ten if lg.adjusted_by else None
        lg.approved_by_name = lg.approved_by.ho_ten if lg.approved_by else None
    return inv


# ── Create ───────────────────────────────────────────────────────────────────

@router.post("/invoices", response_model=SalesInvoiceResponse)
def create_invoice(
    data: SalesInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    return BillingService(db).create_invoice(data, current_user.id)


@router.post("/invoices/from-delivery/{delivery_id}", response_model=SalesInvoiceResponse)
def create_from_delivery(
    delivery_id: int,
    ty_le_vat: Decimal = Query(Decimal("10"), description="VAT: 0, 5, 8, hoặc 10"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    return BillingService(db).create_invoice_from_delivery(
        delivery_id, current_user.id, ty_le_vat=ty_le_vat
    )


@router.post("/invoices/from-order/{order_id}", response_model=SalesInvoiceResponse)
def create_from_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    return BillingService(db).create_invoice_from_order(order_id, current_user.id)


# ── Edit (trước kết chuyển) ───────────────────────────────────────────────────

@router.put("/invoices/{invoice_id}", response_model=SalesInvoiceResponse)
def update_invoice(
    invoice_id: int,
    data: SalesInvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*EDIT_ROLES)),
):
    return BillingService(db).update_invoice(invoice_id, data, current_user.id)


# ── Upload ảnh phiếu giao ────────────────────────────────────────────────────

@router.post("/invoices/{invoice_id}/upload-photo", response_model=SalesInvoiceResponse)
async def upload_photo(
    invoice_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*EDIT_ROLES)),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Chỉ chấp nhận file JPG, PNG hoặc WebP")
    _ensure_upload_dir()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(_UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    url = f"/uploads/invoices/{filename}"
    return BillingService(db).update_anh_phieu_giao(invoice_id, url)


# ── Adjustment sau kết chuyển ────────────────────────────────────────────────

@router.post("/invoices/{invoice_id}/request-adjustment")
def request_adjustment(
    invoice_id: int,
    data: AdjustmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*ADJUST_ROLES)),
):
    log = BillingService(db).request_adjustment(invoice_id, data, current_user.id)
    return {"id": log.id, "trang_thai": log.trang_thai, "message": "Yêu cầu điều chỉnh đã được gửi"}


@router.patch("/adjustment-logs/{log_id}/approve")
def approve_adjustment(
    log_id: int,
    data: AdjustmentApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*APPROVE_ROLES)),
):
    log = BillingService(db).approve_adjustment(log_id, data, current_user.id)
    action = "duyệt" if data.approved else "từ chối"
    return {"id": log.id, "trang_thai": log.trang_thai, "message": f"Đã {action} yêu cầu điều chỉnh"}


# ── Adjustment log list + print ──────────────────────────────────────────────

@router.get("/adjustment-logs", response_model=list[InvoiceAdjustmentLogResponse])
def list_adjustment_logs(
    trang_thai: str | None = Query(None),
    customer_id: int | None = Query(None),
    tu_ngay: date | None = Query(None),
    den_ngay: date | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*READ_ROLES)),
):
    q = (
        db.query(InvoiceAdjustmentLog)
        .join(SalesInvoice, InvoiceAdjustmentLog.invoice_id == SalesInvoice.id)
    )
    if trang_thai:
        q = q.filter(InvoiceAdjustmentLog.trang_thai == trang_thai)
    if customer_id:
        q = q.filter(SalesInvoice.customer_id == customer_id)
    if tu_ngay:
        q = q.filter(InvoiceAdjustmentLog.adjusted_at >= tu_ngay)
    if den_ngay:
        from datetime import datetime, time
        den_ngay_end = datetime.combine(den_ngay, time.max)
        q = q.filter(InvoiceAdjustmentLog.adjusted_at <= den_ngay_end)
    logs = q.order_by(InvoiceAdjustmentLog.adjusted_at.desc()).all()
    # Gắn tên người liên quan và invoice info
    for lg in logs:
        lg.adjusted_by_name = lg.adjusted_by.ho_ten if lg.adjusted_by else None
        lg.approved_by_name = lg.approved_by.ho_ten if lg.approved_by else None
    return logs


@router.get("/adjustment-logs/{log_id}/print", response_class=HTMLResponse)
def print_adjustment_log(
    log_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*READ_ROLES)),
):
    import html as _html_mod
    import json
    from app.models.system import PrintTemplate, SystemSetting

    lg = db.get(InvoiceAdjustmentLog, log_id)
    if not lg:
        raise HTTPException(404, "Không tìm thấy yêu cầu điều chỉnh")
    inv = db.get(SalesInvoice, lg.invoice_id)
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")

    pn = inv.phap_nhan

    tpl_q = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "INVOICE_ADJUSTMENT")
    tpl = tpl_q.filter(PrintTemplate.phap_nhan_id == pn.id).first() if pn else None
    if not tpl:
        tpl = tpl_q.filter(PrintTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(404, "Chưa có mẫu in INVOICE_ADJUSTMENT — vui lòng cấu hình trong Hệ thống > Mẫu in")

    settings = {s.key: s.value for s in db.query(SystemSetting).all()}
    before = json.loads(lg.du_lieu_truoc) if lg.du_lieu_truoc else {}
    after = json.loads(lg.du_lieu_sau) if lg.du_lieu_sau else {}

    def fmt(v):
        try:
            return f"{float(v):,.0f}"
        except Exception:
            return str(v)

    def _ngay(d) -> str:
        if not d:
            return "—"
        s = str(d).split("T")[0]
        p = s.split("-")
        return f"Ngày {p[2]} tháng {p[1]} năm {p[0]}" if len(p) == 3 else s

    accent = "#E65100"
    pn_name = pn.ten_phap_nhan if pn else "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"
    if pn and "VISUN" in pn.ma_phap_nhan.upper():
        accent = "#0277BD"

    trang_thai_map = {
        "pending": ("Chờ duyệt", "#fa8c16"),
        "approved": ("Đã duyệt", "#52c41a"),
        "rejected": ("Từ chối", "#ff4d4f"),
        "na": ("Đã áp dụng", "#1677ff"),
    }
    tt_label, tt_color = trang_thai_map.get(lg.trang_thai, (lg.trang_thai, "#888"))

    ten_kh = inv.ten_don_vi or (inv.customer.ten_viet_tat if inv.customer else "—")
    so_hd = inv.so_hoa_don or f"HĐ #{inv.id}"
    adjusted_by = lg.adjusted_by.ho_ten if lg.adjusted_by else f"User #{lg.adjusted_by_id}"
    approved_by = lg.approved_by.ho_ten if lg.approved_by else "—"
    loai_label = "Trước kết chuyển" if lg.loai == "truoc_ket_chuyen" else "Sau kết chuyển"

    def _changed_cls(key):
        return "changed" if before.get(key) != after.get(key) else ""

    body_html = f"""
<table class="so-sanh">
  <thead><tr><th>Chỉ tiêu</th><th class="right">Trước điều chỉnh</th><th class="right">Sau điều chỉnh</th></tr></thead>
  <tbody>
    <tr class="{_changed_cls('tong_tien_hang')}"><td>Tiền hàng</td><td class="right">{fmt(before.get('tong_tien_hang','0'))} đ</td><td class="right">{fmt(after.get('tong_tien_hang','0'))} đ</td></tr>
    <tr class="{_changed_cls('ty_le_vat')}"><td>Thuế VAT</td><td class="right">{before.get('ty_le_vat','0')}%</td><td class="right">{after.get('ty_le_vat','0')}%</td></tr>
    <tr class="{_changed_cls('tien_vat')}"><td>Tiền VAT</td><td class="right">{fmt(before.get('tien_vat','0'))} đ</td><td class="right">{fmt(after.get('tien_vat','0'))} đ</td></tr>
    <tr class="{_changed_cls('tong_cong')}" style="font-weight:bold;background:#e6f4ff"><td>TỔNG CỘNG</td><td class="right">{fmt(before.get('tong_cong','0'))} đ</td><td class="right">{fmt(after.get('tong_cong','0'))} đ</td></tr>
  </tbody>
</table>"""

    replacements = {
        **standard_vars(subtitle="PHIẾU ĐIỀU CHỈNH", customer_name=_html_mod.escape(ten_kh)),
        "{{document_number}}": f"ĐC-{lg.id:04d}",
        "{{document_date}}": _ngay(str(lg.adjusted_at.date()) if lg.adjusted_at else ""),
        "{{company_name}}": _html_mod.escape(pn_name),
        "{{company_details}}": "Bộ phận: Kế toán công nợ",
        "{{logo_img}}": _logo_img(pn, settings),
        "{{accent}}": accent,
        "{{tt_color}}": tt_color,
        "{{ten_kh}}": _html_mod.escape(ten_kh),
        "{{so_hd}}": _html_mod.escape(so_hd),
        "{{loai}}": loai_label,
        "{{trang_thai}}": _html_mod.escape(tt_label),
        "{{adjusted_by}}": _html_mod.escape(adjusted_by),
        "{{adjusted_at}}": _ngay(str(lg.adjusted_at.date()) if lg.adjusted_at else ""),
        "{{approved_by}}": _html_mod.escape(approved_by),
        "{{approved_at}}": _ngay(str(lg.approved_at.date()) if lg.approved_at else ""),
        "{{body_html}}": body_html,
        "{{ly_do}}": _html_mod.escape(lg.ghi_chu or "—"),
        "{{sig_approved_by}}": _html_mod.escape(approved_by if lg.trang_thai in ("approved", "rejected") else ""),
        "{{sig_adjusted_by}}": _html_mod.escape(adjusted_by),
    }
    content = apply_template(tpl.html_content, replacements)
    page = (
        "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>"
        f"<title>Phiếu điều chỉnh ĐC-{lg.id:04d}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0;display:flex;gap:10px'>"
        "<button onclick='window.print()' style='padding:7px 18px;background:#E65100;color:#fff;border:none;border-radius:4px;cursor:pointer'>🖨️ In phiếu điều chỉnh</button>"
        "<button onclick='window.close()' style='padding:7px 14px;border:1px solid #ccc;border-radius:4px;cursor:pointer'>Đóng</button>"
        "</div>"
        f"{content}</body></html>"
    )
    return HTMLResponse(content=page)


# ── Issue / Cancel ────────────────────────────────────────────────────────────

@router.patch("/invoices/{invoice_id}/issue", response_model=SalesInvoiceResponse)
def issue_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    return BillingService(db).issue_invoice(invoice_id)


@router.patch("/invoices/{invoice_id}/cancel", response_model=SalesInvoiceResponse)
def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*APPROVE_ROLES)),
):
    return BillingService(db).cancel_invoice(invoice_id)


# ── Print ─────────────────────────────────────────────────────────────────────

@router.get("/invoices/{invoice_id}/print", response_class=HTMLResponse)
def print_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*READ_ROLES)),
):
    import html as _html_mod
    from app.models.system import PrintTemplate, SystemSetting

    inv = db.get(SalesInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")

    pn = inv.phap_nhan

    tpl_q = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == "SALES_INVOICE")
    tpl = tpl_q.filter(PrintTemplate.phap_nhan_id == pn.id).first() if pn else None
    if not tpl:
        tpl = tpl_q.filter(PrintTemplate.phap_nhan_id.is_(None)).first() or tpl_q.first()
    if not tpl:
        raise HTTPException(404, "Chưa có mẫu in SALES_INVOICE — vui lòng cấu hình trong Hệ thống > Mẫu in")

    settings = {s.key: s.value for s in db.query(SystemSetting).all()}

    accent = "#E65100"
    pn_name = pn.ten_phap_nhan if pn else "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"
    pn_address = pn.dia_chi if pn else ""
    pn_mst = pn.ma_so_thue if pn else ""
    pn_phone = pn.so_dien_thoai if pn else ""
    pn_email = getattr(pn, "email", None) or ""
    if pn and "VISUN" in pn.ma_phap_nhan.upper():
        accent = "#0277BD"

    logo_src = (
        f"/api/phap-nhan/logo/{pn.ma_phap_nhan}" if pn and pn.ma_phap_nhan
        else settings.get("logo_url") or ""
    )
    ten_kh = inv.ten_don_vi or (inv.customer.ten_viet_tat if inv.customer else "")
    dia_chi_kh = inv.dia_chi or (inv.customer.dia_chi if inv.customer else "")
    mst_kh = inv.ma_so_thue or (inv.customer.ma_so_thue if inv.customer else "")
    hinh_thuc = {"CK": "Chuyển khoản", "TM": "Tiền mặt"}.get(inv.hinh_thuc_tt, inv.hinh_thuc_tt or "")
    so_hd = inv.so_hoa_don or "Chưa phát hành"

    def _ngay(d) -> str:
        if not d:
            return ""
        s = str(d)
        p = s.split("-")
        return f"Ngày {p[2]} tháng {p[1]} năm {p[0]}" if len(p) == 3 else s

    mau_so_html = f"Mẫu số: {inv.mau_so}<br>Ký hiệu: {inv.ky_hieu}" if inv.mau_so else "Hóa đơn nội bộ"

    _default_inv_cols = [
        {"key": "stt", "label": "STT"},
        {"key": "ten_hang", "label": "Tên hàng hóa, dịch vụ"},
        {"key": "dvt", "label": "ĐVT"},
        {"key": "so_luong", "label": "Số lượng"},
        {"key": "gia_ban", "label": "Đơn giá (đ)"},
        {"key": "thanh_tien", "label": "Thành tiền (đ)"},
    ]
    selected_cols = get_selected_columns(tpl.variables_meta, _default_inv_cols)

    items_data = [{
        "stt": "1",
        "ten_hang": "Thùng carton (theo hợp đồng / đơn hàng)",
        "dvt": "Thùng",
        "so_luong": "",
        "gia_ban": "—",
        "don_gia": "—",
        "thanh_tien": f"{float(inv.tong_tien_hang):,.0f}",
    }]
    items_table = build_html_table(selected_cols, items_data)

    _span = max(len(selected_cols) - 1, 1)
    totals_html = (
        '<table style="width:100%;border-collapse:collapse;font-size:10.5pt">'
        f'<tr class="total-row"><td colspan="{_span}" class="right" style="border:1px solid #ddd;padding:4px 6px;text-align:right">Cộng tiền hàng:</td>'
        f'<td class="right" style="border:1px solid #ddd;padding:4px 6px;text-align:right">{float(inv.tong_tien_hang):,.0f}</td></tr>'
        f'<tr class="total-row"><td colspan="{_span}" class="right" style="border:1px solid #ddd;padding:4px 6px;text-align:right">Thuế VAT ({float(inv.ty_le_vat):.0f}%):</td>'
        f'<td class="right" style="border:1px solid #ddd;padding:4px 6px;text-align:right">{float(inv.tien_vat):,.0f}</td></tr>'
        f'<tr class="total-row"><td colspan="{_span}" class="right" style="border:1px solid #ddd;padding:4px 6px;text-align:right">TỔNG CỘNG:</td>'
        f'<td class="right" style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:11pt">{float(inv.tong_cong):,.0f}</td></tr>'
        '</table>'
    )
    body_html = items_table + totals_html

    replacements = {
        **standard_vars(subtitle="HÓA ĐƠN BÁN HÀNG", customer_name=_html_mod.escape(ten_kh), delivery_address=_html_mod.escape(dia_chi_kh)),
        "{{document_number}}": _html_mod.escape(so_hd),
        "{{document_date}}": _ngay(inv.ngay_hoa_don),
        "{{company_name}}": _html_mod.escape(pn_name),
        "{{company_details}}": _html_mod.escape(
            f"Địa chỉ: {pn_address} | MST: {pn_mst} | ĐT: {pn_phone}" + (f" | Email: {pn_email}" if pn_email else "")
        ),
        "{{logo_img}}": f'<img src="{_html_mod.escape(logo_src)}" style="max-width:100%;height:auto"/>' if logo_src else "",
        "{{logo_src}}": logo_src,
        "{{accent}}": accent,
        "{{mau_so}}": mau_so_html,
        "{{ten_kh}}": _html_mod.escape(ten_kh),
        "{{dia_chi_kh}}": _html_mod.escape(dia_chi_kh),
        "{{mst_kh}}": _html_mod.escape(mst_kh),
        "{{nguoi_mua_hang}}": _html_mod.escape(inv.nguoi_mua_hang or ""),
        "{{hinh_thuc}}": _html_mod.escape(hinh_thuc),
        "{{han_tt}}": _ngay(inv.han_tt) if inv.han_tt else "Không có",
        "{{body_html}}": body_html,
        "{{tong_tien_hang}}": f"{float(inv.tong_tien_hang):,.0f}",
        "{{ty_le_vat}}": f"{float(inv.ty_le_vat):.0f}",
        "{{tien_vat}}": f"{float(inv.tien_vat):,.0f}",
        "{{tong_cong}}": f"{float(inv.tong_cong):,.0f}",
        "{{ghi_chu}}": _html_mod.escape(inv.ghi_chu or ""),
    }
    content = apply_template(tpl.html_content, replacements)
    page = (
        "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>"
        f"<title>Hóa đơn {_html_mod.escape(so_hd)}</title>"
        "<style>body{margin:0;padding:0}@media print{.no-print{display:none!important}}</style>"
        "</head><body>"
        "<div class='no-print' style='padding:10px;background:#f0f0f0;display:flex;gap:10px'>"
        "<button onclick='window.print()' style='padding:7px 18px;background:#E65100;color:#fff;border:none;border-radius:4px;cursor:pointer'>🖨️ In hóa đơn</button>"
        "<button onclick='window.close()' style='padding:7px 14px;border:1px solid #ccc;border-radius:4px;cursor:pointer'>Đóng</button>"
        "</div>"
        f"{content}</body></html>"
    )
    return HTMLResponse(content=page)
