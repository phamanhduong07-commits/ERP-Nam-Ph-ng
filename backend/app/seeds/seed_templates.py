from app.database import SessionLocal
from app.models.system import PrintTemplate, ExcelTemplate

# Lấy HTML mặc định từ code hiện tại (giả định logic)
DEFAULT_HEADER = """
<div class="doc-head" style="border-bottom: 2px solid var(--primary); padding-bottom: 10px; margin-bottom: 15px;">
    <div class="doc-brand" style="flex: 0 0 100px;">
        {{logo_img}}
    </div>
    <div class="doc-title-block" style="flex: 1; padding-left: 15px;">
        <div class="company-name" style="font-size: 14px; color: var(--primary);">{{company_name}}</div>
        <div class="co-details" style="font-size: 10px; line-height: 1.4;">{{company_details}}</div>
        <div class="document-type" style="margin-top: 10px; font-size: 18px; color: var(--accent);">{{subtitle}}</div>
    </div>
    <div class="doc-meta" style="flex: 0 0 150px; text-align: right; font-size: 10px;">
        <div>Số: <strong>{{document_number}}</strong></div>
        <div>Ngày: {{document_date}}</div>
    </div>
</div>
"""

TEMPLATES = [
    {
        "ma_mau": "SALES_ORDER",
        "ten_mau": "Đơn Bán Hàng",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">Tổng tiền hàng: {{tong_tien_hang}}</div>',
        "variables_meta": {
            "document_number": "Số đơn hàng",
            "document_date": "Ngày đơn",
            "customer_name": "Tên khách hàng",
            "delivery_address": "Địa chỉ giao",
            "body_html": "Bảng sản phẩm",
            "tong_tien_hang": "Tổng tiền"
        }
    },
    {
        "ma_mau": "SALES_INVOICE",
        "ten_mau": "Hóa Đơn Bán Hàng",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">Thanh toán: {{total_thanh_tien}}</div>',
        "variables_meta": {
            "document_number": "Số hóa đơn",
            "document_date": "Ngày hóa đơn",
            "customer_name": "Tên khách hàng",
            "delivery_address": "Địa chỉ",
            "body_html": "Bảng chi tiết hàng hóa",
            "total_thanh_tien": "Tổng tiền"
        }
    },
    {
        "ma_mau": "CASH_RECEIPT",
        "ten_mau": "Phiếu Thu",
        "html_content": """
<style>
  @page { size: A5 portrait; margin: 10mm; }
  .cash-receipt { font-family: Arial, sans-serif; color: #222; font-size: 12px; line-height: 1.45; }
  .cr-head { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2px solid #2e7d32; padding-bottom: 8px; margin-bottom: 12px; }
  .cr-logo { width: 76px; }
  .cr-logo img { max-width: 76px; max-height: 62px; object-fit: contain; }
  .cr-company { flex: 1; }
  .cr-company-name { font-weight: 700; color: #2e7d32; text-transform: uppercase; font-size: 14px; }
  .cr-company-details { font-size: 10px; margin-top: 3px; }
  .cr-title { text-align: center; margin: 14px 0 10px; }
  .cr-title h1 { margin: 0; color: #1565c0; font-size: 22px; letter-spacing: 0; }
  .cr-title div { margin-top: 4px; }
  .cr-row { display: grid; grid-template-columns: 130px 1fr; gap: 8px; padding: 4px 0; border-bottom: 1px dotted #bbb; }
  .cr-label { color: #555; }
  .cr-value { font-weight: 600; }
  .cr-amount { font-size: 16px; color: #2e7d32; }
  .cr-sign { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 24px; text-align: center; }
  .cr-sign strong { display: block; margin-bottom: 4px; }
  .cr-sign-space { height: 58px; }
</style>
<div class="cash-receipt">
  <div class="cr-head">
    <div class="cr-logo">{{logo_img}}</div>
    <div class="cr-company">
      <div class="cr-company-name">{{company_name}}</div>
      <div class="cr-company-details">{{company_details}}</div>
    </div>
  </div>
  <div class="cr-title">
    <h1>PHIẾU THU</h1>
    <div>Số: <strong>{{document_number}}</strong> &nbsp;&nbsp; Ngày: {{document_date}}</div>
  </div>
  <div class="cr-row"><div class="cr-label">Người nộp tiền</div><div class="cr-value">{{nguoi_nop}}</div></div>
  <div class="cr-row"><div class="cr-label">Khách hàng</div><div class="cr-value">{{khach_hang}}</div></div>
  <div class="cr-row"><div class="cr-label">Lý do thu</div><div class="cr-value">{{ly_do_thu}}</div></div>
  <div class="cr-row"><div class="cr-label">Số tiền</div><div class="cr-value cr-amount">{{so_tien}}</div></div>
  <div class="cr-row"><div class="cr-label">Bằng chữ</div><div class="cr-value">{{so_tien_bang_chu}}</div></div>
  <div class="cr-sign">
    <div><strong>Giám đốc</strong><em>(Ký, họ tên)</em><div class="cr-sign-space"></div></div>
    <div><strong>Kế toán trưởng</strong><em>(Ký, họ tên)</em><div class="cr-sign-space"></div></div>
    <div><strong>Thủ quỹ</strong><em>(Ký, họ tên)</em><div class="cr-sign-space"></div></div>
    <div><strong>Người nộp tiền</strong><em>(Ký, họ tên)</em><div class="cr-sign-space"></div></div>
  </div>
</div>
""",
        "variables_meta": {
            "document_number": "Số phiếu thu",
            "document_date": "Ngày phiếu",
            "nguoi_nop": "Người nộp tiền",
            "khach_hang": "Khách hàng",
            "ly_do_thu": "Lý do thu",
            "so_tien": "Số tiền",
            "so_tien_bang_chu": "Số tiền bằng chữ"
        }
    },
    {
        "ma_mau": "CASH_PAYMENT",
        "ten_mau": "Phiếu Chi",
        "html_content": """
<style>
  @page { size: A5 portrait; margin: 10mm; }
  .cash-payment { font-family: Arial, sans-serif; color: #222; font-size: 12px; line-height: 1.45; }
  .cp-head { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2px solid #1b168e; padding-bottom: 8px; margin-bottom: 12px; }
  .cp-logo { width: 76px; }
  .cp-logo img { max-width: 76px; max-height: 62px; object-fit: contain; }
  .cp-company { flex: 1; }
  .cp-company-name { font-weight: 700; color: #1b168e; text-transform: uppercase; font-size: 14px; }
  .cp-company-details { font-size: 10px; margin-top: 3px; }
  .cp-title { text-align: center; margin: 14px 0 10px; }
  .cp-title h1 { margin: 0; color: #d32f2f; font-size: 22px; letter-spacing: 0; }
  .cp-title div { margin-top: 4px; }
  .cp-row { display: grid; grid-template-columns: 130px 1fr; gap: 8px; padding: 4px 0; border-bottom: 1px dotted #bbb; }
  .cp-label { color: #555; }
  .cp-value { font-weight: 600; }
  .cp-amount { font-size: 16px; color: #d32f2f; }
  .cp-sign { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 24px; text-align: center; }
  .cp-sign strong { display: block; margin-bottom: 4px; }
  .cp-sign-space { height: 58px; }
</style>
<div class="cash-payment">
  <div class="cp-head">
    <div class="cp-logo">{{logo_img}}</div>
    <div class="cp-company">
      <div class="cp-company-name">{{company_name}}</div>
      <div class="cp-company-details">{{company_details}}</div>
    </div>
  </div>
  <div class="cp-title">
    <h1>PHIẾU CHI</h1>
    <div>Số: <strong>{{document_number}}</strong> &nbsp;&nbsp; Ngày: {{document_date}}</div>
  </div>
  <div class="cp-row"><div class="cp-label">Người nhận tiền</div><div class="cp-value">{{nguoi_nhan}}</div></div>
  <div class="cp-row"><div class="cp-label">Nhà cung cấp</div><div class="cp-value">{{nha_cung_cap}}</div></div>
  <div class="cp-row"><div class="cp-label">Số tiền</div><div class="cp-value cp-amount">{{so_tien}}</div></div>
  <div class="cp-row"><div class="cp-label">Bằng chữ</div><div class="cp-value">{{so_tien_bang_chu}}</div></div>
  <div class="cp-sign">
    <div><strong>Giám đốc</strong><em>(Ký, họ tên)</em><div class="cp-sign-space"></div></div>
    <div><strong>Kế toán trưởng</strong><em>(Ký, họ tên)</em><div class="cp-sign-space"></div></div>
    <div><strong>Thủ quỹ</strong><em>(Ký, họ tên)</em><div class="cp-sign-space"></div></div>
    <div><strong>Người nhận tiền</strong><em>(Ký, họ tên)</em><div class="cp-sign-space"></div></div>
  </div>
</div>
""",
        "variables_meta": {
            "document_number": "Số phiếu chi",
            "document_date": "Ngày phiếu",
            "nguoi_nhan": "Người nhận tiền",
            "nha_cung_cap": "Nhà cung cấp",
            "so_tien": "Số tiền",
            "so_tien_bang_chu": "Số tiền bằng chữ"
        }
    },
    {
        "ma_mau": "SALES_QUOTE",
        "ten_mau": "Báo Giá",
        "html_content": """
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #222; }
  .sq-head { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2px solid #E65100; padding-bottom: 10px; margin-bottom: 14px; }
  .sq-logo img { max-width: 90px; max-height: 70px; object-fit: contain; }
  .sq-company { flex: 1; padding-left: 12px; }
  .sq-company-name { font-weight: 700; color: #E65100; font-size: 13pt; text-transform: uppercase; }
  .sq-company-details { font-size: 9pt; margin-top: 4px; line-height: 1.5; }
  .sq-title { text-align: center; margin: 12px 0 10px; }
  .sq-title h1 { font-size: 18pt; font-weight: 700; letter-spacing: 2px; margin: 0; }
  .sq-title .sq-docno { font-size: 9pt; color: #666; margin-top: 4px; }
  .sq-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 10px; font-size: 10pt; }
  .sq-info-row { display: flex; gap: 4px; padding: 3px 0; border-bottom: 1px dotted #bbb; }
  .sq-info-label { min-width: 100px; font-weight: 700; flex-shrink: 0; color: #555; }
  .sq-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
  .sq-table th { background: #E65100; color: #fff; padding: 5px 6px; border: 1px solid #ccc; text-align: center; }
  .sq-table td { border: 1px solid #ddd; padding: 4px 6px; }
  .sq-summary { float: right; margin-top: 10px; font-size: 10pt; }
  .sq-summary table { border-collapse: collapse; }
  .sq-summary td { padding: 3px 8px; }
  .sq-s-label { text-align: right; color: #555; min-width: 140px; }
  .sq-s-value { text-align: right; min-width: 120px; font-weight: 600; border-bottom: 1px solid #eee; }
  .sq-total-row td { font-weight: 700; font-size: 12pt; color: #E65100; border-top: 2px solid #E65100; }
  .sq-terms { clear: both; margin-top: 14px; font-size: 9.5pt; color: #444; border-top: 1px dotted #ccc; padding-top: 8px; }
  .sq-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 28px; text-align: center; font-size: 10pt; }
  .sq-sign-label { font-weight: 700; }
  .sq-sign-sub { font-style: italic; font-size: 8.5pt; color: #666; }
  .sq-sign-space { height: 48px; }
</style>
<div class="sq-head">
  <div class="sq-logo">{{logo_img}}</div>
  <div class="sq-company">
    <div class="sq-company-name">{{company_name}}</div>
    <div class="sq-company-details">{{company_details}}</div>
  </div>
</div>
<div class="sq-title">
  <h1>BÁO GIÁ</h1>
  <div class="sq-docno">Số: <strong>{{document_number}}</strong> &nbsp;|&nbsp; Ngày: {{document_date}}</div>
</div>
<div class="sq-info">
  <div class="sq-info-row"><div class="sq-info-label">Kính gửi:</div><div><strong>{{customer_name}}</strong></div></div>
  <div class="sq-info-row"><div class="sq-info-label">Hiệu lực đến:</div><div>{{delivery_address}}</div></div>
</div>
<table class="sq-table">
  <thead>
    <tr>
      <th style="width:30px">STT</th>
      <th style="width:90px">Mã hàng</th>
      <th>Tên sản phẩm</th>
      <th style="width:100px">Quy cách</th>
      <th style="width:40px">Lớp</th>
      <th style="width:80px">Sóng</th>
      <th style="width:100px">Mã ký hiệu</th>
      <th style="width:70px">Số lượng</th>
      <th style="width:40px">ĐVT</th>
      <th style="width:90px">Đơn giá (đ)</th>
      <th style="width:100px">Thành tiền (đ)</th>
      <th style="width:80px">Ghi chú</th>
    </tr>
  </thead>
  <tbody>{{body_html}}</tbody>
</table>
<div class="sq-summary">
  <table>
    <tr><td class="sq-s-label">Tiền hàng:</td><td class="sq-s-value">{{tong_tien_hang}} đ</td></tr>
    <tr style="display:{{chi_phi_bang_in_vis}}"><td class="sq-s-label">CP Bảng in:</td><td class="sq-s-value">{{chi_phi_bang_in}} đ</td></tr>
    <tr style="display:{{chi_phi_khuon_vis}}"><td class="sq-s-label">CP Khuôn:</td><td class="sq-s-value">{{chi_phi_khuon}} đ</td></tr>
    <tr style="display:{{chi_phi_van_chuyen_vis}}"><td class="sq-s-label">CP Vận chuyển:</td><td class="sq-s-value">{{chi_phi_van_chuyen}} đ</td></tr>
    <tr style="display:{{chi_phi_khac_1_vis}}"><td class="sq-s-label">{{chi_phi_khac_1_ten}}:</td><td class="sq-s-value">{{chi_phi_khac_1}} đ</td></tr>
    <tr style="display:{{chi_phi_khac_2_vis}}"><td class="sq-s-label">{{chi_phi_khac_2_ten}}:</td><td class="sq-s-value">{{chi_phi_khac_2}} đ</td></tr>
    <tr><td class="sq-s-label">Thuế VAT ({{ty_le_vat}}%):</td><td class="sq-s-value">{{tien_vat}} đ</td></tr>
    <tr class="sq-total-row"><td class="sq-s-label">TỔNG CỘNG:</td><td class="sq-s-value">{{tong_cong}} đ</td></tr>
  </table>
</div>
<div class="sq-terms">{{dieu_khoan}}</div>
<div class="sq-sign">
  <div></div>
  <div>
    <div class="sq-sign-label">Đại diện công ty</div>
    <div class="sq-sign-sub">(Ký, họ tên)</div>
    <div class="sq-sign-space"></div>
    <div>{{nguoi_lap}}</div>
  </div>
</div>
""",
        "variables_meta": {
            "company_name": "Tên công ty",
            "body_html": "Nội dung bảng báo giá",
            "columns": [
                {"key": "stt", "label": "STT"},
                {"key": "ma_amis", "label": "Mã hàng"},
                {"key": "ten_hang", "label": "Tên sản phẩm"},
                {"key": "kich_thuoc", "label": "Quy cách"},
                {"key": "so_lop", "label": "Lớp"},
                {"key": "to_hop_song", "label": "Sóng"},
                {"key": "ma_ky_hieu", "label": "Mã ký hiệu"},
                {"key": "so_luong", "label": "Số lượng"},
                {"key": "dvt", "label": "ĐVT"},
                {"key": "gia_ban", "label": "Đơn giá"},
                {"key": "thanh_tien", "label": "Thành tiền"},
                {"key": "ghi_chu", "label": "Ghi chú"}
            ]
        }
    },
    {
        "ma_mau": "GOODS_RECEIPT",
        "ten_mau": "Phiếu Nhập Kho",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">{{tong_tien_chu}}</div>',
        "variables_meta": {
            "document_number": "Số phiếu",
            "document_date": "Ngày nhập",
            "supplier_name": "Nhà cung cấp",
            "warehouse_name": "Kho nhập",
            "body_html": "Bảng hàng hóa",
            "tong_tien_chu": "Tổng tiền bằng chữ/số"
        }
    },
    {
        "ma_mau": "MATERIAL_ISSUE",
        "ten_mau": "Phiếu Xuất Nguyên Vật Liệu",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>',
        "variables_meta": {
            "document_number": "Số phiếu",
            "document_date": "Ngày xuất",
            "warehouse_name": "Kho xuất",
            "so_lenh": "Số lệnh sản xuất",
            "body_html": "Bảng danh sách NVL"
        }
    },
    {
        "ma_mau": "PURCHASE_ORDER",
        "ten_mau": "Đơn Mua Hàng",
        "html_content": """
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #222; }
  .po-wrap { max-width: 210mm; margin: 0 auto; }

  /* Header */
  .po-head { display: flex; align-items: flex-start; gap: 14px; padding-bottom: 8px; border-bottom: 2px solid #1B5E20; margin-bottom: 12px; }
  .po-logo img { max-width: 90px; max-height: 70px; object-fit: contain; }
  .po-company { flex: 1; padding-left: 12px; }
  .po-company-name { font-weight: 700; color: #1B5E20; font-size: 13pt; text-transform: uppercase; }
  .po-company-details { font-size: 9pt; margin-top: 4px; line-height: 1.5; color: #444; }
  .po-mau { text-align: right; font-size: 8pt; color: #666; min-width: 130px; }

  /* Title */
  .po-title { text-align: center; margin: 10px 0 12px; }
  .po-title h2 { margin: 0; font-size: 17pt; font-weight: 700; letter-spacing: 2px; }
  .po-title .po-docno { font-size: 9.5pt; color: #444; margin-top: 5px; }

  /* Info block */
  .po-info { margin-bottom: 10px; }
  .po-info .row { display: flex; align-items: baseline; margin: 4px 0; font-size: 10.5pt; line-height: 1.7; }
  .po-info .label { min-width: 135px; font-weight: 700; flex-shrink: 0; }
  .po-info .dots { flex: 1; border-bottom: 1px dotted #888; min-height: 1em; padding-bottom: 1px; }
  .po-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }

  /* Table (bảng hàng được inject qua body_html — chỉ cần wrapper) */
  .po-table-wrap { margin-top: 4px; }

  /* Ghi chú + điều khoản */
  .po-note { font-size: 9.5pt; color: #444; margin-top: 8px; line-height: 1.7; border-top: 1px dotted #ccc; padding-top: 6px; }

  /* Chữ ký */
  .po-sign { width: 100%; border-collapse: collapse; margin-top: 28px; }
  .po-sign td { border: none; text-align: center; vertical-align: top; width: 33.33%; padding: 0 4px; }
  .po-sign .sig-label { font-weight: 700; font-size: 10.5pt; }
  .po-sign .sig-sub { font-style: italic; font-size: 8.5pt; color: #666; margin-top: 2px; }
  .po-sign .sig-space { height: 40px; }
</style>
<div class="po-wrap">

  <div class="po-head">
    <div class="po-logo">{{logo_img}}</div>
    <div class="po-company">
      <div class="po-company-name">{{company_name}}</div>
      <div class="po-company-details">{{company_details}}</div>
    </div>
    <div class="po-mau">&nbsp;</div>
  </div>

  <div class="po-title">
    <h2>ĐƠN MUA HÀNG</h2>
    <div class="po-docno">
      Số: <strong>{{document_number}}</strong>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      Ngày: {{document_date}}
    </div>
  </div>

  <div class="po-info">
    <div class="row">
      <div class="label">Nhà cung cấp:</div>
      <div class="dots"><strong>{{supplier_name}}</strong></div>
    </div>
    <div class="po-info-grid">
      <div class="row">
        <div class="label">Điều khoản TT:</div>
        <div class="dots">{{dieu_khoan_tt}}</div>
      </div>
      <div class="row">
        <div class="label">Ghi chú:</div>
        <div class="dots">{{ghi_chu}}</div>
      </div>
    </div>
  </div>

  <div class="po-table-wrap">
    {{body_html}}
  </div>

  <table class="po-sign">
    <tr>
      <td>
        <div class="sig-label">Giám đốc</div>
        <div class="sig-sub">(Ký, họ tên, đóng dấu)</div>
        <div class="sig-space"></div>
      </td>
      <td>
        <div class="sig-label">Kế toán trưởng</div>
        <div class="sig-sub">(Ký, họ tên)</div>
        <div class="sig-space"></div>
      </td>
      <td>
        <div class="sig-label">Người lập phiếu</div>
        <div class="sig-sub">(Ký, họ tên)</div>
        <div class="sig-space"></div>
      </td>
    </tr>
  </table>

</div>
""",
        "variables_meta": {
            "document_number": "Số PO",
            "document_date": "Ngày PO",
            "supplier_name": "Nhà cung cấp",
            "body_html": "Bảng hàng hóa (STT | Tên | ĐVT | Khổ | Cuộn | SL | Đơn giá | Thành tiền)",
            "tong_tien": "Tổng tiền (số nguyên)",
            "dieu_khoan_tt": "Điều khoản thanh toán",
            "ghi_chu": "Ghi chú",
            "company_name": "Tên công ty",
            "company_details": "Địa chỉ/SĐT/MST công ty",
            "logo_img": "Logo HTML img tag"
        }
    },
    {
        "ma_mau": "WAREHOUSE_TRANSFER",
        "ten_mau": "Phiếu Chuyển Kho",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">{{footer_html}}</div>',
        "variables_meta": {
            "document_number": "Số phiếu",
            "document_date": "Ngày chuyển",
            "customer_name": "Kho xuất (nguồn)",
            "delivery_address": "Kho nhận (đích)",
            "body_html": "Bảng hàng hóa chuyển",
            "footer_html": "Ghi chú"
        }
    },
    {
        "ma_mau": "PRODUCTION_PHOI_RECEIPT",
        "ten_mau": "Phiếu Nhập Phôi Sóng",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>',
        "variables_meta": {
            "document_number": "Số phiếu",
            "document_date": "Ngày",
            "so_lenh": "Số lệnh SX",
            "ca": "Ca sản xuất",
            "gio_bat_dau": "Giờ BD",
            "gio_ket_thuc": "Giờ KT",
            "duration": "Thời gian thực hiện",
            "body_html": "Bảng chi tiết phôi"
        }
    },
    {
        "ma_mau": "PRODUCTION_ORDER",
        "ten_mau": "Lệnh Sản Xuất (Detail)",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">{{ghi_chu}}</div>',
        "variables_meta": {
            "document_number": "Số lệnh",
            "document_date": "Ngày lệnh",
            "so_don": "Số đơn hàng",
            "ngay_hoan_thanh_kh": "Ngày HT kế hoạch",
            "body_html": "Bảng chi tiết sản phẩm",
            "ghi_chu": "Ghi chú lệnh"
        }
    },
    {
        "ma_mau": "PRODUCTION_TAG",
        "ten_mau": "Tem Nhận Dạng Sản Phẩm",
        "html_content": "<!-- TEM nhận dạng --><div class='tag-container'>{{body_html}}</div>",
        "variables_meta": {
            "so_lenh": "Số lệnh",
            "body_html": "Nội dung tem (table)"
        }
    },
    {
        "ma_mau": "STOCK_ADJUSTMENT",
        "ten_mau": "Biên bản kiểm kê tồn kho",
        "css_content": ".table { width: 100%; border-collapse: collapse; } .table th, .table td { border: 1px solid #ddd; padding: 8px; }",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">Lý do: {{ly_do}}<br/>Ghi chú: {{ghi_chu}}</div>',
        "variables_meta": {
            "document_number": "Số phiếu",
            "document_date": "Ngày",
            "warehouse_name": "Kho kiểm kê",
            "ly_do": "Lý do",
            "ghi_chu": "Ghi chú",
            "body_html": "Nội dung bảng"
        }
    },
    {
        "ma_mau": "STOCK_CARD",
        "ten_mau": "Thẻ kho / Lịch sử XNT",
        "css_content": ".table { width: 100%; border-collapse: collapse; font-size: 11px; } .table th, .table td { border: 1px solid #ddd; padding: 4px; }",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">{{footer_html}}</div>',
        "variables_meta": {
            "document_date": "Khoảng thời gian",
            "document_number": "Số lượng giao dịch",
            "body_html": "Nội dung bảng",
            "footer_html": "Thống kê tổng"
        }
    },
    {
        "ma_mau": "INVOICE_ADJUSTMENT",
        "ten_mau": "Phiếu Yêu Cầu Điều Chỉnh Hóa Đơn",
        "html_content": """
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #111; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .company-name { font-size: 13pt; font-weight: bold; color: {{accent}}; text-transform: uppercase; }
  .company-info { font-size: 9pt; line-height: 1.6; color: #333; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid {{accent}}; margin: 8px 0; }
  .title { text-align: center; margin: 10px 0 12px; }
  .title h2 { font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .title .so { font-size: 10pt; color: #333; margin-top: 4px; }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10pt;
                  font-weight: bold; color: #fff; background: {{tt_color}}; }
  .info-block { font-size: 10.5pt; line-height: 1.9; margin: 8px 0; }
  .row { display: flex; margin: 2px 0; }
  .row .label { min-width: 160px; font-weight: bold; flex-shrink: 0; }
  .row .dots { flex: 1; border-bottom: 1px dotted #888; padding-left: 4px; }
  table.so-sanh { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10.5pt; }
  table.so-sanh th { background: {{accent}}; color: #fff; padding: 6px 8px; border: 1px solid #ccc; text-align: center; }
  table.so-sanh td { border: 1px solid #ccc; padding: 6px 8px; }
  table.so-sanh tr.changed td { background: #fffbe6; font-weight: bold; }
  .right { text-align: right; }
  .ly-do { border: 1px solid #ccc; border-radius: 4px; padding: 8px 12px; font-size: 10.5pt;
            background: #fafafa; margin: 8px 0; min-height: 40px; }
  .sig-table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  .sig-table td { border: none; text-align: center; vertical-align: top; padding: 2px; }
  .sig-label { font-weight: bold; font-size: 10pt; }
  .sig-sub { font-style: italic; font-size: 9pt; color: #555; }
  .sig-name { margin-top: 40px; font-weight: bold; }
</style>
<div class="header">
  <div>
    <div class="company-name">{{company_name}}</div>
    <div class="company-info">{{company_details}}</div>
  </div>
  <div style="text-align:right;font-size:9pt;color:#555;">
    Phiếu điều chỉnh số: <strong>{{document_number}}</strong><br>
    {{document_date}}
  </div>
</div>
<hr class="divider">
<div class="title">
  <h2>Phiếu yêu cầu điều chỉnh hóa đơn</h2>
  <div class="so">
    Hóa đơn: <strong>{{so_hd}}</strong> &nbsp;|&nbsp;
    Loại: <strong>{{loai}}</strong> &nbsp;|&nbsp;
    Trạng thái: <span class="status-badge">{{trang_thai}}</span>
  </div>
</div>
<div class="info-block">
  <div class="row"><span class="label">Khách hàng:</span><span class="dots">{{ten_kh}}</span></div>
  <div class="row"><span class="label">Người yêu cầu:</span><span class="dots">{{adjusted_by}} — {{adjusted_at}}</span></div>
  <div class="row"><span class="label">Người phê duyệt:</span><span class="dots">{{approved_by}} {{approved_at}}</span></div>
</div>
<p style="font-weight:bold;margin:12px 0 4px;">Nội dung thay đổi:</p>
{{body_html}}
<p style="font-weight:bold;margin:8px 0 4px;">Lý do điều chỉnh:</p>
<div class="ly-do">{{ly_do}}</div>
<table class="sig-table" style="margin-top:32px;">
  <tr>
    <td style="width:33%"><div class="sig-label">Người yêu cầu</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{{sig_adjusted_by}}</div></td>
    <td style="width:33%"><div class="sig-label">Kế toán trưởng</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name">{{sig_approved_by}}</div></td>
    <td style="width:34%"><div class="sig-label">Giám đốc</div><div class="sig-sub">(Ký, họ tên)</div><div class="sig-name"></div></td>
  </tr>
</table>
""",
        "variables_meta": {
            "document_number": "Số phiếu điều chỉnh (ĐC-XXXX)",
            "document_date": "Ngày yêu cầu",
            "company_name": "Tên công ty",
            "company_details": "Bộ phận",
            "accent": "Màu accent (#E65100 hoặc #0277BD)",
            "tt_color": "Màu badge trạng thái",
            "ten_kh": "Tên khách hàng",
            "so_hd": "Số hóa đơn",
            "loai": "Loại điều chỉnh",
            "trang_thai": "Trạng thái",
            "adjusted_by": "Người yêu cầu",
            "adjusted_at": "Ngày yêu cầu",
            "approved_by": "Người duyệt",
            "approved_at": "Ngày duyệt",
            "body_html": "Bảng so sánh trước/sau",
            "ly_do": "Lý do điều chỉnh",
            "sig_adjusted_by": "Tên người yêu cầu (chữ ký)",
            "sig_approved_by": "Tên người duyệt (chữ ký)"
        }
    },
    {
        "ma_mau": "PAPER_ROLL_LABEL",
        "ten_mau": "Tem Cuộn Giấy (80×100mm, Barcode)",
        "html_content": """
<style>
  @media print { @page { size: 80mm 100mm; margin: 0; } }
  body { font-family: Arial, sans-serif; margin: 0; padding: 8px; background: #f5f5f5; }
  .label {
    width: 76mm; min-height: 94mm; border: 1px solid #333;
    padding: 4mm 3mm; margin: 4mm auto; background: #fff;
    page-break-after: always; box-sizing: border-box;
  }
  .company { font-size: 9pt; font-weight: bold; text-align: center; margin-bottom: 3mm; }
  .field { margin: 1mm 0; }
  .row-2col { display: flex; gap: 4mm; }
  .row-2col > * { flex: 1; }
  .lbl { font-size: 8pt; color: #555; }
  .val { font-size: 10pt; font-weight: bold; }
  .big { font-size: 22pt; font-weight: 900; line-height: 1.1; }
  .small .lbl { font-size: 7.5pt; }
  .small .val { font-size: 8.5pt; }
  .barcode-wrap { text-align: center; margin-top: 3mm; }
  .barcode-wrap svg { max-width: 100%; }
</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
{{labels_html}}
<script>JsBarcode(".barcode").init();</script>
""",
        "variables_meta": {
            "labels_html": "HTML của tất cả tem (do router tạo, mỗi tem là 1 .label div với barcode SVG)",
        }
    }
]

EXCEL_TEMPLATES = [
    {
        "ma_mau": "SALES_QUOTE",
        "ten_mau": "Xuất Excel Báo giá",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "so_bao_gia", "label": "Số BG", "width": 16},
            {"key": "ngay_bao_gia", "label": "Ngày BG", "width": 12},
            {"key": "ngay_het_han", "label": "Ngày hết hạn", "width": 14},
            {"key": "phap_nhan", "label": "Pháp nhân", "width": 22},
            {"key": "customer_name", "label": "Khách hàng", "width": 28},
            {"key": "ma_amis", "label": "Mã hàng", "width": 14},
            {"key": "ten_hang", "label": "Tên hàng", "width": 34},
            {"key": "kich_thuoc", "label": "Quy cách", "width": 16},
            {"key": "so_lop", "label": "Lớp", "width": 8},
            {"key": "to_hop_song", "label": "Sóng", "width": 10},
            {"key": "ma_ky_hieu", "label": "Mã ký hiệu", "width": 20},
            {"key": "so_luong", "label": "Số lượng", "width": 12},
            {"key": "dvt", "label": "ĐVT", "width": 8},
            {"key": "gia_ban", "label": "Đơn giá", "width": 14},
            {"key": "thanh_tien", "label": "Thành tiền", "width": 16},
            {"key": "trang_thai", "label": "Trạng thái", "width": 14},
            {"key": "ghi_chu", "label": "Ghi chú", "width": 24}
        ]
    },
    {
        "ma_mau": "SALES_ORDER",
        "ten_mau": "Xuất Excel Đơn bán hàng",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "so_don_hang", "label": "Số ĐH", "width": 15},
            {"key": "ngay_don_hang", "label": "Ngày ĐH", "width": 12},
            {"key": "ten_khach_hang", "label": "Khách hàng", "width": 30},
            {"key": "ten_hang", "label": "Tên hàng", "width": 40},
            {"key": "dvt", "label": "ĐVT", "width": 8},
            {"key": "so_luong", "label": "Số lượng", "width": 12},
            {"key": "gia_ban", "label": "Đơn giá", "width": 15},
            {"key": "thanh_tien", "label": "Thành tiền", "width": 18}
        ]
    },
    {
        "ma_mau": "SALES_ORDER_DETAIL",
        "ten_mau": "Xuất Excel Chi tiết Đơn hàng",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "ma_amis", "label": "Mã SP", "width": 14},
            {"key": "ten_hang", "label": "Tên hàng", "width": 30},
            {"key": "kich_thuoc", "label": "Kích thước", "width": 18},
            {"key": "so_lop", "label": "Lớp", "width": 6},
            {"key": "so_luong", "label": "Số lượng", "width": 10},
            {"key": "dvt", "label": "ĐVT", "width": 8},
            {"key": "don_gia", "label": "Đơn giá", "width": 12},
            {"key": "thanh_tien", "label": "Thành tiền", "width": 14},
            {"key": "ngay_giao", "label": "Ngày giao", "width": 12},
            {"key": "ghi_chu", "label": "Ghi chú", "width": 20}
        ]
    },
    {
        "ma_mau": "WAREHOUSE_OUT",
        "ten_mau": "Xuất Excel Phiếu xuất kho",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "so_phieu", "label": "Số phiếu", "width": 15},
            {"key": "ngay_xuat", "label": "Ngày xuất", "width": 12},
            {"key": "ten_hang", "label": "Tên hàng hóa", "width": 40},
            {"key": "so_luong", "label": "SL yêu cầu", "width": 12},
            {"key": "so_luong_thuc", "label": "SL thực xuất", "width": 12},
            {"key": "ghi_chu", "label": "Ghi chú", "width": 20}
        ]
    },
    {
        "ma_mau": "INVENTORY",
        "ten_mau": "Xuất Excel Tồn kho",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "ten_hang", "label": "Tên hàng", "width": 35},
            {"key": "ten_kho", "label": "Kho", "width": 18},
            {"key": "ton_luong", "label": "Tồn kho", "width": 12},
            {"key": "don_vi", "label": "ĐVT", "width": 8},
            {"key": "ton_toi_thieu", "label": "Tồn tối thiểu", "width": 14},
            {"key": "don_gia_binh_quan", "label": "Đơn giá BQ", "width": 14},
            {"key": "gia_tri_ton", "label": "Giá trị tồn", "width": 16}
        ]
    },
    {
        "ma_mau": "PRODUCTION_ORDER",
        "ten_mau": "Xuất Excel Lệnh sản xuất",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "so_lenh", "label": "Số lệnh", "width": 18},
            {"key": "ngay_lenh", "label": "Ngày lệnh", "width": 12},
            {"key": "so_don", "label": "Đơn hàng", "width": 16},
            {"key": "ten_khach_hang", "label": "Khách hàng", "width": 20},
            {"key": "ten_hang", "label": "Mã/Tên hàng", "width": 28},
            {"key": "ngay_hoan_thanh_ke_hoach", "label": "Hoàn thành DK", "width": 18},
            {"key": "so_dong", "label": "Số dòng", "width": 8},
            {"key": "tong_sl_ke_hoach", "label": "SL kế hoạch", "width": 14},
            {"key": "trang_thai_lbl", "label": "Trạng thái", "width": 14}
        ]
    },
    {
        "ma_mau": "GOODS_RECEIPT",
        "ten_mau": "Xuất Excel Nhập kho",
        "column_config": [
            {"key": "so_phieu", "label": "Số phiếu", "width": 18},
            {"key": "ngay_nhap", "label": "Ngày nhập", "width": 12},
            {"key": "ten_kho", "label": "Kho", "width": 18},
            {"key": "ten_ncc", "label": "Nhà CC", "width": 22},
            {"key": "loai_nhap", "label": "Loại nhập", "width": 14},
            {"key": "so_xe", "label": "Số xe", "width": 12},
            {"key": "tong_gia_tri", "label": "Tổng giá trị", "width": 16},
            {"key": "trang_thai_lbl", "label": "Trạng thái", "width": 12}
        ]
    },
    {
        "ma_mau": "MATERIAL_ISSUE",
        "ten_mau": "Xuất Excel Xuất NVL",
        "column_config": [
            {"key": "so_phieu", "label": "Số phiếu", "width": 18},
            {"key": "ngay_xuat", "label": "Ngày xuất", "width": 12},
            {"key": "ten_kho", "label": "Kho", "width": 18},
            {"key": "so_lenh", "label": "Lệnh SX", "width": 16},
            {"key": "trang_thai_lbl", "label": "Trạng thái", "width": 12}
        ]
    },
    {
        "ma_mau": "WAREHOUSE_TRANSFER",
        "ten_mau": "Xuất Excel Chuyển kho",
        "column_config": [
            {"key": "so_phieu", "label": "Số phiếu", "width": 18},
            {"key": "ngay", "label": "Ngày", "width": 12},
            {"key": "ten_kho_xuat", "label": "Kho xuất", "width": 20},
            {"key": "ten_kho_nhap", "label": "Kho nhận", "width": 20},
            {"key": "trang_thai_lbl", "label": "Trạng thái", "width": 12},
            {"key": "ghi_chu", "label": "Ghi chú", "width": 25}
        ]
    },
    {
        "ma_mau": "PRODUCTION_ORDER_DETAIL",
        "ten_mau": "Xuất Excel Chi tiết Lệnh SX",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "ma_amis", "label": "Mã SP", "width": 14},
            {"key": "ten_hang", "label": "Tên sản phẩm", "width": 30},
            {"key": "loai_thung", "label": "Loại thùng", "width": 12},
            {"key": "kich_thuoc", "label": "Kích thước", "width": 20},
            {"key": "so_lop", "label": "Lớp", "width": 6},
            {"key": "to_hop_song", "label": "Tổ hợp sóng", "width": 10},
            {"key": "so_luong_ke_hoach", "label": "SL kế hoạch", "width": 12},
            {"key": "dvt", "label": "ĐVT", "width": 8},
            {"key": "so_luong_hoan_thanh", "label": "SL hoàn thành", "width": 12},
            {"key": "ngay_giao", "label": "Ngày giao", "width": 12},
            {"key": "ghi_chu", "label": "Ghi chú", "width": 20}
        ]
    },
    {
        "ma_mau": "STOCK_ADJUSTMENT",
        "ten_mau": "Xuất Excel Kiểm kê",
        "column_config": [
            {"key": "so_phieu", "label": "Số phiếu", "width": 18},
            {"key": "ngay", "label": "Ngày", "width": 12},
            {"key": "ten_kho", "label": "Kho", "width": 18},
            {"key": "ten_hang", "label": "Tên hàng", "width": 28},
            {"key": "don_vi", "label": "ĐVT", "width": 8},
            {"key": "so_luong_so_sach", "label": "Sổ sách", "width": 12},
            {"key": "so_luong_thuc_te", "label": "Thực tế", "width": 12},
            {"key": "chenhlech", "label": "Chênh lệch", "width": 12},
            {"key": "ly_do", "label": "Lý do", "width": 20}
        ]
    },
    {
        "ma_mau": "STOCK_CARD",
        "ten_mau": "Xuất Excel Thẻ kho",
        "column_config": [
            {"key": "ngay", "label": "Ngày", "width": 12},
            {"key": "ma_hang", "label": "Mã hàng", "width": 14},
            {"key": "ten_hang", "label": "Tên hàng", "width": 28},
            {"key": "ten_kho", "label": "Kho", "width": 14},
            {"key": "loai_gd_lbl", "label": "Loại GD", "width": 18},
            {"key": "sl_nhap", "label": "SL nhập", "width": 12},
            {"key": "sl_xuat", "label": "SL xuất", "width": 12},
            {"key": "ton_sau", "label": "Tồn kho", "width": 12},
            {"key": "don_gia", "label": "Đơn giá", "width": 14},
            {"key": "gia_tri", "label": "Giá trị", "width": 16},
            {"key": "ghi_chu", "label": "Ghi chú", "width": 20}
        ]
    },
    {
        "ma_mau": "SALES_QUOTE_LIST",
        "ten_mau": "Danh sách Báo giá",
        "column_config": [
            {"key": "stt", "label": "STT", "width": 5},
            {"key": "so_bao_gia", "label": "Số báo giá", "width": 18},
            {"key": "ngay_bao_gia", "label": "Ngày BG", "width": 12},
            {"key": "ten_khach_hang", "label": "Khách hàng", "width": 25},
            {"key": "trang_thai", "label": "Trạng thái", "width": 12},
            {"key": "ngay_het_han", "label": "Ngày hết hạn", "width": 12},
            {"key": "tong_cong", "label": "Tổng cộng", "width": 16},
            {"key": "so_dong", "label": "Số dòng", "width": 8},
            {"key": "nguoi_lap", "label": "Người lập", "width": 18}
        ],
        "style_config": {
            "accent_color": "#E65100",
            "show_company_header": True,
            "freeze_header": True
        }
    },
    {
        "ma_mau": "TRIAL_BALANCE",
        "ten_mau": "Bảng Cân Đối Số Phát Sinh",
        "column_config": [
            {"key": "so_tk", "label": "Số TK", "width": 10},
            {"key": "ten_tk", "label": "Tên TK", "width": 35},
            {"key": "du_dau_no", "label": "Dư đầu kỳ Nợ", "width": 16},
            {"key": "du_dau_co", "label": "Dư đầu kỳ Có", "width": 16},
            {"key": "phat_sinh_no", "label": "Phát sinh Nợ", "width": 16},
            {"key": "phat_sinh_co", "label": "Phát sinh Có", "width": 16},
            {"key": "du_cuoi_no", "label": "Dư cuối kỳ Nợ", "width": 16},
            {"key": "du_cuoi_co", "label": "Dư cuối kỳ Có", "width": 16}
        ],
        "style_config": {
            "accent_color": "#1565C0"
        }
    },
    {
        "ma_mau": "PRODUCTION_COSTING",
        "ten_mau": "Giá Thành Sản Xuất",
        "column_config": [
            {"key": "so_lenh", "label": "Số lệnh", "width": 14},
            {"key": "ten_hang", "label": "Tên hàng", "width": 25},
            {"key": "dvt", "label": "ĐVT", "width": 7},
            {"key": "so_luong", "label": "Số lượng", "width": 10},
            {"key": "cp_nvl", "label": "CP NVL", "width": 15},
            {"key": "cp_nhan_cong", "label": "CP Nhân công", "width": 15},
            {"key": "cp_chung", "label": "CP Chung", "width": 15},
            {"key": "tong_chi_phi", "label": "Tổng chi phí", "width": 15},
            {"key": "gia_thanh_don_vi", "label": "Giá thành đơn vị", "width": 18},
            {"key": "standard_cost", "label": "Giá chuẩn", "width": 14}
        ],
        "style_config": {
            "accent_color": "#1B5E20"
        }
    },
    {
        "ma_mau": "INVENTORY_MOVEMENT",
        "ten_mau": "Báo Cáo Xuất Nhập Tồn",
        "column_config": [
            {"key": "ten_kho", "label": "Kho", "width": 15},
            {"key": "ten_hang", "label": "Hàng hóa", "width": 25},
            {"key": "don_vi", "label": "ĐVT", "width": 7},
            {"key": "ton_dau_ky", "label": "Tồn đầu kỳ", "width": 12},
            {"key": "nhap_trong_ky", "label": "Nhập trong kỳ", "width": 12},
            {"key": "xuat_trong_ky", "label": "Xuất trong kỳ", "width": 12},
            {"key": "ton_cuoi_ky", "label": "Tồn cuối kỳ", "width": 12},
            {"key": "gia_tri_ton", "label": "Giá trị tồn", "width": 15}
        ],
        "style_config": {
            "accent_color": "#E65100"
        }
    },
    {
        "ma_mau": "PRODUCTION_PERFORMANCE",
        "ten_mau": "Báo Cáo Năng Suất Sản Xuất",
        "column_config": [
            {"key": "so_lenh", "label": "Số lệnh", "width": 14},
            {"key": "ngay_lenh", "label": "Ngày lệnh", "width": 12},
            {"key": "trang_thai", "label": "Trạng thái", "width": 12},
            {"key": "ten_khach_hang", "label": "Khách hàng", "width": 22},
            {"key": "ten_phan_xuong", "label": "Phân xưởng", "width": 18},
            {"key": "tong_ke_hoach", "label": "KH (Thùng)", "width": 12},
            {"key": "tong_hoan_thanh", "label": "Thực tế", "width": 12},
            {"key": "ty_le_hoan_thanh", "label": "Tỉ lệ (%)", "width": 10},
            {"key": "ngay_ke_hoach_xong", "label": "Ngày KH xong", "width": 14},
            {"key": "ngay_thuc_te_xong", "label": "Ngày TT xong", "width": 14},
            {"key": "tre_han", "label": "Trễ (ngày)", "width": 10}
        ],
        "style_config": {
            "accent_color": "#1B5E20"
        }
    },
    {
        "ma_mau": "ORDER_PROGRESS",
        "ten_mau": "Báo Cáo Tiến Độ Đơn Hàng",
        "column_config": [
            {"key": "so_don", "label": "Số đơn", "width": 14},
            {"key": "ngay_don", "label": "Ngày đặt", "width": 12},
            {"key": "ngay_giao_du_kien", "label": "Ngày giao DK", "width": 14},
            {"key": "trang_thai", "label": "Trạng thái", "width": 12},
            {"key": "ten_khach_hang", "label": "Khách hàng", "width": 22},
            {"key": "so_luong_dat", "label": "SL đặt", "width": 12},
            {"key": "so_luong_da_giao", "label": "SL đã giao", "width": 12},
            {"key": "so_luong_con_lai", "label": "Còn lại", "width": 12},
            {"key": "ty_le_giao", "label": "Tỉ lệ (%)", "width": 10},
            {"key": "tong_tien", "label": "Tổng tiền", "width": 15}
        ],
        "style_config": {
            "accent_color": "#E65100"
        }
    },
    {
        "ma_mau": "PRODUCTION_COST",
        "ten_mau": "Chi Phí và Lợi Nhuận LSX",
        "column_config": [
            {"key": "so_lenh", "label": "Số lệnh", "width": 12},
            {"key": "ngay_lenh", "label": "Ngày lệnh", "width": 10},
            {"key": "trang_thai", "label": "Trạng thái", "width": 10},
            {"key": "ten_hang", "label": "Tên hàng", "width": 20},
            {"key": "ten_khach", "label": "Khách hàng", "width": 18},
            {"key": "so_don", "label": "Số đơn", "width": 12},
            {"key": "ten_phap_nhan", "label": "Pháp nhân", "width": 14},
            {"key": "ten_xuong", "label": "Phân xưởng", "width": 14},
            {"key": "so_luong_ke_hoach", "label": "SL kế hoạch", "width": 12},
            {"key": "so_luong_hoan_thanh", "label": "SL hoàn thành", "width": 12},
            {"key": "dien_tich", "label": "Diện tích (m²)", "width": 10},
            {"key": "doanh_thu", "label": "Doanh thu", "width": 14},
            {"key": "chi_phi_nvl", "label": "CP NVL", "width": 13},
            {"key": "chi_phi_nhan_cong", "label": "CP Nhân công", "width": 14},
            {"key": "chi_phi_sxc", "label": "CP SXC", "width": 13},
            {"key": "tong_chi_phi", "label": "Tổng CP", "width": 13},
            {"key": "da_phan_bo", "label": "Đã phân bổ", "width": 10},
            {"key": "loi_nhuan", "label": "Lợi nhuận", "width": 14},
            {"key": "ty_le_loi_nhuan", "label": "Tỉ lệ LN (%)", "width": 12}
        ],
        "style_config": {
            "accent_color": "#1565C0"
        }
    },
    {
        "ma_mau": "PAYROLL",
        "ten_mau": "Bảng Lương",
        "column_config": [
            {"key": "ma_nv", "label": "Mã NV", "width": 8},
            {"key": "ho_ten", "label": "Họ tên", "width": 22},
            {"key": "chuc_vu", "label": "Chức vụ", "width": 14},
            {"key": "luong_co_ban", "label": "Lương CB", "width": 14},
            {"key": "luong_san_pham", "label": "Lương SP", "width": 14},
            {"key": "luong_chuyen", "label": "Lương chuyến", "width": 14},
            {"key": "luong_theo_ngay_cong", "label": "Lương ngày công", "width": 14},
            {"key": "phu_cap", "label": "Phụ cấp", "width": 12},
            {"key": "ot_total", "label": "Tổng OT", "width": 12},
            {"key": "thuong", "label": "Thưởng", "width": 12},
            {"key": "tong_thu_nhap", "label": "Tổng thu nhập", "width": 14},
            {"key": "bao_hiem", "label": "Bảo hiểm", "width": 12},
            {"key": "tam_ung", "label": "Tạm ứng", "width": 12},
            {"key": "thuc_linh", "label": "Thực lĩnh", "width": 14},
            {"key": "trang_thai", "label": "Trạng thái", "width": 10}
        ],
        "footer_config": {
            "show_total": True,
            "sum_columns": [
                "luong_co_ban", "luong_san_pham", "luong_chuyen",
                "luong_theo_ngay_cong", "phu_cap", "ot_total", "thuong",
                "tong_thu_nhap", "bao_hiem", "tam_ung", "thuc_linh"
            ]
        },
        "style_config": {
            "accent_color": "#1565C0"
        }
    },
    {
        "ma_mau": "REVENUE_BY_PERIOD",
        "ten_mau": "Doanh Thu Theo Kỳ",
        "column_config": [
            {"key": "ky", "label": "Kỳ", "width": 20},
            {"key": "doanh_thu", "label": "Doanh thu (đ)", "width": 18}
        ],
        "style_config": {
            "accent_color": "#E65100"
        }
    },
    {
        "ma_mau": "REVENUE_TOP_CUSTOMERS",
        "ten_mau": "Top Khách Hàng Doanh Thu",
        "column_config": [
            {"key": "stt", "label": "#", "width": 5},
            {"key": "ten_khach_hang", "label": "Khách hàng", "width": 30},
            {"key": "so_don", "label": "Số đơn", "width": 10},
            {"key": "doanh_thu", "label": "Doanh thu (đ)", "width": 18}
        ],
        "style_config": {
            "accent_color": "#E65100"
        }
    },
    {
        "ma_mau": "DEBT_SUMMARY_AR",
        "ten_mau": "Công Nợ Phải Thu (AR)",
        "column_config": [
            {"key": "ten_doi_tuong", "label": "Đối tượng", "width": 28},
            {"key": "so_hoa_don", "label": "Số HĐ", "width": 10},
            {"key": "tong_phat_sinh", "label": "Tổng phát sinh", "width": 16},
            {"key": "da_thanh_toan", "label": "Đã thanh toán", "width": 16},
            {"key": "con_lai", "label": "Còn lại", "width": 16},
            {"key": "trong_han", "label": "Trong hạn", "width": 16},
            {"key": "qua_han", "label": "Quá hạn", "width": 16}
        ],
        "style_config": {
            "accent_color": "#1565C0"
        }
    },
    {
        "ma_mau": "DEBT_SUMMARY_AP",
        "ten_mau": "Công Nợ Phải Trả (AP)",
        "column_config": [
            {"key": "ten_doi_tuong", "label": "Đối tượng", "width": 28},
            {"key": "so_hoa_don", "label": "Số HĐ", "width": 10},
            {"key": "tong_phat_sinh", "label": "Tổng phát sinh", "width": 16},
            {"key": "da_thanh_toan", "label": "Đã thanh toán", "width": 16},
            {"key": "con_lai", "label": "Còn lại", "width": 16},
            {"key": "trong_han", "label": "Trong hạn", "width": 16},
            {"key": "qua_han", "label": "Quá hạn", "width": 16}
        ],
        "style_config": {
            "accent_color": "#B71C1C"
        }
    },
    {
        "ma_mau": "WORKSHOP_PNL",
        "ten_mau": "Báo Cáo Lãi/Lỗ Phân Xưởng",
        "column_config": [
            {"key": "chi_tieu", "label": "Chỉ tiêu", "width": 30},
            {"key": "gia_tri", "label": "Giá trị (VNĐ)", "width": 20}
        ],
        "style_config": {
            "accent_color": "#1B5E20",
            "show_company_header": True,
            "freeze_header": True
        }
    }
]


def seed():
    db = SessionLocal()
    try:
        for t in TEMPLATES:
            exists = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == t["ma_mau"]).first()
            if not exists:
                tpl = PrintTemplate(**t)
                db.add(tpl)
            else:
                # Update existing
                for key, val in t.items():
                    setattr(exists, key, val)

        for t in EXCEL_TEMPLATES:
            exists = db.query(ExcelTemplate).filter(ExcelTemplate.ma_mau == t["ma_mau"]).first()
            if not exists:
                tpl = ExcelTemplate(**t)
                db.add(tpl)
            else:
                # Update existing
                for key, val in t.items():
                    setattr(exists, key, val)

        db.commit()
        print("Seed templates thành công!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
