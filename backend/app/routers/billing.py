from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.billing import SalesInvoice
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


@router.get("/invoices/{invoice_id}/print", response_class=HTMLResponse)
def print_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    inv = db.get(SalesInvoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")

    accent = "#E65100"
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
.header {{ display: flex; justify-content: space-between; align-items: flex-start; }}
.company-name {{ font-size: 13pt; font-weight: bold; color: {accent}; }}
.company-info {{ font-size: 9pt; line-height: 1.6; color: #333; margin-top: 2px; }}
.mau {{ font-size: 9pt; text-align: right; color: #555; }}
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
  <div>
    <div class="company-name">CÔNG TY TNHH NAM PHƯƠNG BAO BÌ</div>
    <div class="company-info">
      Địa chỉ: 123 Đường Nguyễn Văn Linh, Q.7, TP.HCM<br>
      MST: 0312345678 &nbsp;|&nbsp; ĐT: (028) 3456 7890 &nbsp;|&nbsp; Email: info@namphuong.vn
    </div>
  </div>
  <div class="mau">
    {"Mẫu số: " + inv.mau_so + "<br>Ký hiệu: " + inv.ky_hieu if inv.mau_so else "Hóa đơn nội bộ"}
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
