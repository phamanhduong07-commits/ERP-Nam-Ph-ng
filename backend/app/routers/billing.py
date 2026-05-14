import os
import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.billing import SalesInvoice, InvoiceAdjustmentLog
from app.models.master import Customer
from app.services.billing_service import BillingService
from app.schemas.billing import (
    AdjustmentApprove,
    AdjustmentRequest,
    InvoiceAdjustmentLogResponse,
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesInvoiceResponse,
    SalesInvoiceListItem,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

# ── Role groups ──────────────────────────────────────────────────────────────
CREATE_ROLES  = ("KE_TOAN_CONG_NO", "KE_TOAN", "KE_TOAN_TRUONG", "GIAM_DOC")
EDIT_ROLES    = ("SALE_ADMIN", "KE_TOAN_CONG_NO", "KE_TOAN", "KE_TOAN_TRUONG", "GIAM_DOC")
ADJUST_ROLES  = ("KE_TOAN_CONG_NO", "KE_TOAN_TRUONG", "GIAM_DOC")   # yêu cầu điều chỉnh sau KC
APPROVE_ROLES = ("KE_TOAN_TRUONG", "GIAM_DOC")                        # duyệt sau KC
READ_ROLES    = ("SALE_ADMIN", "KE_TOAN_CONG_NO", "KE_TOAN", "KE_TOAN_TRUONG", "GIAM_DOC", "KINH_DOANH", "MUA_HANG")

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
    _: User = Depends(require_roles(*READ_ROLES)),
):
    return BillingService(db).list_invoices(
        customer_id=customer_id, trang_thai=trang_thai,
        tu_ngay=tu_ngay, den_ngay=den_ngay,
        qua_han_only=qua_han_only, search=search,
        page=page, page_size=page_size,
        phap_nhan_id=phap_nhan_id,
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
    lg = db.query(InvoiceAdjustmentLog).get(log_id)
    if not lg:
        raise HTTPException(404, "Không tìm thấy yêu cầu điều chỉnh")
    inv = db.get(SalesInvoice, lg.invoice_id)
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")

    import json
    before = json.loads(lg.du_lieu_truoc) if lg.du_lieu_truoc else {}
    after  = json.loads(lg.du_lieu_sau)  if lg.du_lieu_sau  else {}

    def fmt(v):
        try:
            return f"{float(v):,.0f}"
        except Exception:
            return str(v)

    def ngay_str(d) -> str:
        if not d:
            return "—"
        s = str(d)
        p = s.split("T")[0].split("-")
        return f"Ngày {p[2]} tháng {p[1]} năm {p[0]}" if len(p) == 3 else s

    pn = inv.phap_nhan
    accent = "#E65100"
    pn_name = pn.ten_phap_nhan if pn else "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"
    if pn and "VISUN" in pn.ma_phap_nhan.upper():
        accent = "#0277BD"

    trang_thai_map = {
        "pending":  ("Chờ duyệt",   "#fa8c16"),
        "approved": ("Đã duyệt",    "#52c41a"),
        "rejected": ("Từ chối",     "#ff4d4f"),
        "na":       ("Đã áp dụng", "#1677ff"),
    }
    tt_label, tt_color = trang_thai_map.get(lg.trang_thai, (lg.trang_thai, "#888"))

    ten_kh = inv.ten_don_vi or (inv.customer.ten_viet_tat if inv.customer else "—")
    so_hd  = inv.so_hoa_don or f"HĐ #{inv.id}"

    adjusted_by = lg.adjusted_by.ho_ten if lg.adjusted_by else f"User #{lg.adjusted_by_id}"
    approved_by = lg.approved_by.ho_ten if lg.approved_by else "—"

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu điều chỉnh #{lg.id}</title>
<style>
@page {{ size: A4 portrait; margin: 15mm 12mm; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'Times New Roman', serif; font-size: 11pt; color: #111; }}
.no-print {{ margin-bottom: 12px; }}
@media print {{ .no-print {{ display: none; }} }}
.header {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }}
.company-name {{ font-size: 13pt; font-weight: bold; color: {accent}; text-transform: uppercase; }}
.company-info {{ font-size: 9pt; line-height: 1.6; color: #333; margin-top: 2px; }}
.divider {{ border: none; border-top: 2px solid {accent}; margin: 8px 0; }}
.title {{ text-align: center; margin: 10px 0 12px; }}
.title h2 {{ font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }}
.title .so {{ font-size: 10pt; color: #333; margin-top: 4px; }}
.status-badge {{ display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10pt;
                 font-weight: bold; color: #fff; background: {tt_color}; }}
.info-block {{ font-size: 10.5pt; line-height: 1.9; margin: 8px 0; }}
.row {{ display: flex; margin: 2px 0; }}
.row .label {{ min-width: 160px; font-weight: bold; flex-shrink: 0; }}
.row .dots {{ flex: 1; border-bottom: 1px dotted #888; padding-left: 4px; }}
table.so-sanh {{ width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10.5pt; }}
table.so-sanh th {{ background: {accent}; color: #fff; padding: 6px 8px; border: 1px solid #ccc; text-align: center; }}
table.so-sanh td {{ border: 1px solid #ccc; padding: 6px 8px; }}
table.so-sanh tr.changed td {{ background: #fffbe6; font-weight: bold; }}
.right {{ text-align: right; }}
.center {{ text-align: center; }}
.ly-do {{ border: 1px solid #ccc; border-radius: 4px; padding: 8px 12px; font-size: 10.5pt;
           background: #fafafa; margin: 8px 0; min-height: 40px; }}
.sig-table {{ width: 100%; border-collapse: collapse; margin-top: 24px; }}
.sig-table td {{ border: none; text-align: center; vertical-align: top; padding: 2px; }}
.sig-label {{ font-weight: bold; font-size: 10pt; }}
.sig-sub {{ font-style: italic; font-size: 9pt; color: #555; }}
.sig-name {{ margin-top: 40px; font-weight: bold; }}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:6px 16px;background:{accent};color:#fff;border:none;border-radius:3px;cursor:pointer;">
    🖨 In phiếu điều chỉnh
  </button>
</div>
<div class="header">
  <div>
    <div class="company-name">{pn_name}</div>
    <div class="company-info">Bộ phận: Kế toán công nợ</div>
  </div>
  <div style="text-align:right;font-size:9pt;color:#555;">
    Phiếu điều chỉnh số: <strong>ĐC-{lg.id:04d}</strong><br>
    {ngay_str(str(lg.adjusted_at.date()) if lg.adjusted_at else "")}
  </div>
</div>
<hr class="divider">
<div class="title">
  <h2>Phiếu yêu cầu điều chỉnh hóa đơn</h2>
  <div class="so">
    Hóa đơn: <strong>{so_hd}</strong> &nbsp;|&nbsp;
    Loại: <strong>{'Trước kết chuyển' if lg.loai == 'truoc_ket_chuyen' else 'Sau kết chuyển'}</strong> &nbsp;|&nbsp;
    Trạng thái: <span class="status-badge">{tt_label}</span>
  </div>
</div>
<div class="info-block">
  <div class="row"><span class="label">Khách hàng:</span><span class="dots">{ten_kh}</span></div>
  <div class="row"><span class="label">Người yêu cầu:</span><span class="dots">{adjusted_by} — {ngay_str(str(lg.adjusted_at.date()) if lg.adjusted_at else "")}</span></div>
  <div class="row"><span class="label">Người phê duyệt:</span><span class="dots">{approved_by}{(' — ' + ngay_str(str(lg.approved_at.date()))) if lg.approved_at else ''}</span></div>
</div>
<p style="font-weight:bold;margin:12px 0 4px;">Nội dung thay đổi:</p>
<table class="so-sanh">
  <thead>
    <tr><th>Chỉ tiêu</th><th class="right">Trước điều chỉnh</th><th class="right">Sau điều chỉnh</th></tr>
  </thead>
  <tbody>
    <tr class="{'changed' if before.get('tong_tien_hang') != after.get('tong_tien_hang') else ''}">
      <td>Tiền hàng</td>
      <td class="right">{fmt(before.get('tong_tien_hang','0'))} đ</td>
      <td class="right">{fmt(after.get('tong_tien_hang','0'))} đ</td>
    </tr>
    <tr class="{'changed' if before.get('ty_le_vat') != after.get('ty_le_vat') else ''}">
      <td>Thuế VAT</td>
      <td class="right">{before.get('ty_le_vat','0')}%</td>
      <td class="right">{after.get('ty_le_vat','0')}%</td>
    </tr>
    <tr class="{'changed' if before.get('tien_vat') != after.get('tien_vat') else ''}">
      <td>Tiền VAT</td>
      <td class="right">{fmt(before.get('tien_vat','0'))} đ</td>
      <td class="right">{fmt(after.get('tien_vat','0'))} đ</td>
    </tr>
    <tr style="font-weight:bold;background:#e6f4ff;" class="{'changed' if before.get('tong_cong') != after.get('tong_cong') else ''}">
      <td>TỔNG CỘNG</td>
      <td class="right">{fmt(before.get('tong_cong','0'))} đ</td>
      <td class="right">{fmt(after.get('tong_cong','0'))} đ</td>
    </tr>
  </tbody>
</table>
<p style="font-weight:bold;margin:8px 0 4px;">Lý do điều chỉnh:</p>
<div class="ly-do">{lg.ghi_chu or '—'}</div>
<table class="sig-table" style="margin-top:32px;">
  <tr>
    <td style="width:33%"><div class="sig-label">Người yêu cầu</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{adjusted_by}</div></td>
    <td style="width:33%"><div class="sig-label">Kế toán trưởng</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{approved_by if lg.trang_thai in ('approved','rejected') else ''}</div></td>
    <td style="width:34%"><div class="sig-label">Giám đốc</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
  </tr>
</table>
</body>
</html>"""
    return HTMLResponse(content=html)


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
    inv = db.get(SalesInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")

    accent = "#E65100"
    pn = inv.phap_nhan
    pn_name = pn.ten_phap_nhan if pn else "CÔNG TY TNHH NAM PHƯƠNG BAO BÌ"
    pn_address = pn.dia_chi if pn else "123 Đường Nguyễn Văn Linh, Q.7, TP.HCM"
    pn_mst = pn.ma_so_thue if pn else "0312345678"
    pn_phone = pn.so_dien_thoai if pn else "(028) 3456 7890"
    pn_email = getattr(pn, 'email', None) or "info@namphuong.vn"

    logo_file = "logo_namphuong.png"
    if pn and "VISUN" in pn.ma_phap_nhan.upper():
        logo_file = "logo_visunpack.png"
        accent = "#0277BD"

    ten_kh = inv.ten_don_vi or (inv.customer.ten_viet_tat if inv.customer else "")
    dia_chi_kh = inv.dia_chi or (inv.customer.dia_chi if inv.customer else "")
    mst_kh = inv.ma_so_thue or (inv.customer.ma_so_thue if inv.customer else "")
    hinh_thuc = {"CK": "Chuyển khoản", "TM": "Tiền mặt"}.get(inv.hinh_thuc_tt, inv.hinh_thuc_tt)

    def ngay_str(d) -> str:
        if not d:
            return ""
        s = str(d)
        p = s.split("-")
        return f"Ngày {p[2]} tháng {p[1]} năm {p[0]}" if len(p) == 3 else s

    han_tt_str = ngay_str(inv.han_tt) if inv.han_tt else "Không có"
    so_hd = inv.so_hoa_don or "Chưa phát hành"

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Hóa đơn {so_hd}</title>
<style>
@page {{ size: A4 portrait; margin: 15mm 12mm; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'Times New Roman', serif; font-size: 11pt; color: #111; }}
.no-print {{ margin-bottom: 10px; }}
@media print {{ .no-print {{ display: none; }} }}
.header {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }}
.logo-container {{ width: 120px; flex-shrink: 0; }}
.logo-container img {{ width: 100%; height: auto; }}
.company-details {{ flex: 1; }}
.company-name {{ font-size: 13pt; font-weight: bold; color: {accent}; text-transform: uppercase; }}
.company-info {{ font-size: 9pt; line-height: 1.6; color: #333; margin-top: 2px; }}
.mau {{ font-size: 9pt; text-align: right; color: #555; flex-shrink: 0; }}
.divider {{ border: none; border-top: 2px solid {accent}; margin: 8px 0; }}
.title {{ text-align: center; margin: 10px 0 8px; }}
.title h2 {{ font-size: 18pt; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }}
.title .so {{ font-size: 10pt; color: #333; margin-top: 3px; }}
.title .ky-hieu {{ font-size: 9pt; color: #555; }}
.info-block {{ font-size: 10.5pt; line-height: 1.9; margin: 8px 0; }}
.row {{ display: flex; margin: 2px 0; }}
.row .label {{ min-width: 130px; font-weight: bold; flex-shrink: 0; }}
.row .dots {{ flex: 1; border-bottom: 1px dotted #888; padding-left: 4px; }}
table.hang-hoa {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }}
table.hang-hoa th {{ background: {accent}; color: #fff; padding: 5px 4px; border: 1px solid #ccc; text-align: center; }}
table.hang-hoa td {{ border: 1px solid #ccc; padding: 4px; }}
.total-row td {{ font-weight: bold; background: #FFF3E0; }}
.right {{ text-align: right; }}
.center {{ text-align: center; }}
.chu {{ font-size: 9.5pt; margin: 4px 0; }}
.sig-table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
.sig-table td {{ border: none; text-align: center; vertical-align: top; width: 25%; padding: 2px; }}
.sig-label {{ font-weight: bold; font-size: 10pt; }}
.sig-sub {{ font-style: italic; font-size: 9pt; color: #555; }}
.sig-name {{ margin-top: 40px; font-weight: bold; }}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:6px 16px;background:{accent};color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10pt;">
    🖨 In hóa đơn
  </button>
</div>
<div class="header">
  <div class="logo-container">
    <img src="/{logo_file}" alt="Logo">
  </div>
  <div class="company-details">
    <div class="company-name">{pn_name}</div>
    <div class="company-info">
      Địa chỉ: {pn_address}<br>
      MST: {pn_mst} &nbsp;|&nbsp; ĐT: {pn_phone} &nbsp;|&nbsp; Email: {pn_email}
    </div>
  </div>
  <div class="mau">
    {f"Mẫu số: {inv.mau_so}<br>Ký hiệu: {inv.ky_hieu}" if inv.mau_so else "Hóa đơn nội bộ"}
  </div>
</div>
<hr class="divider">
<div class="title">
  <h2>Hóa đơn giá trị gia tăng</h2>
  <div class="so">Số: {so_hd}</div>
  <div class="ky-hieu">{ngay_str(inv.ngay_hoa_don)}</div>
</div>
<div class="info-block">
  <div class="row"><span class="label">Đơn vị mua hàng:</span><span class="dots">{ten_kh}</span></div>
  <div class="row"><span class="label">Địa chỉ:</span><span class="dots">{dia_chi_kh}</span></div>
  <div class="row"><span class="label">MST:</span><span class="dots">{mst_kh}</span></div>
  <div class="row"><span class="label">Người mua hàng:</span><span class="dots">{inv.nguoi_mua_hang or ''}</span></div>
  <div class="row"><span class="label">Hình thức TT:</span><span class="dots">{hinh_thuc}</span></div>
  <div class="row"><span class="label">Hạn thanh toán:</span><span class="dots">{han_tt_str}</span></div>
</div>
<table class="hang-hoa">
  <thead>
    <tr>
      <th style="width:5%">STT</th>
      <th>Tên hàng hóa, dịch vụ</th>
      <th style="width:10%">ĐVT</th>
      <th class="right" style="width:15%">Đơn giá</th>
      <th class="right" style="width:18%">Thành tiền</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="center">1</td>
      <td>Thùng carton (theo hợp đồng / đơn hàng)</td>
      <td class="center">Thùng</td>
      <td class="right">—</td>
      <td class="right">{float(inv.tong_tien_hang):,.0f}</td>
    </tr>
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="4" class="right">Cộng tiền hàng:</td>
      <td class="right">{float(inv.tong_tien_hang):,.0f}</td>
    </tr>
    <tr class="total-row">
      <td colspan="4" class="right">Thuế VAT ({float(inv.ty_le_vat):.0f}%):</td>
      <td class="right">{float(inv.tien_vat):,.0f}</td>
    </tr>
    <tr class="total-row">
      <td colspan="4" class="right">TỔNG CỘNG:</td>
      <td class="right" style="font-size:11pt">{float(inv.tong_cong):,.0f}</td>
    </tr>
  </tfoot>
</table>
<div class="chu">Ghi chú: {inv.ghi_chu or ''}</div>
<table class="sig-table">
  <tr>
    <td><div class="sig-label">Người mua hàng</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{inv.nguoi_mua_hang or ''}</div></td>
    <td><div class="sig-label">Thủ kho</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Kế toán</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
    <td><div class="sig-label">Người lập phiếu</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
  </tr>
</table>
</body>
</html>"""
    return HTMLResponse(content=html)
