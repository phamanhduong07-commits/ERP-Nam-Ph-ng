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
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div><div class="doc-footer" style="margin-top:8px;font-style:italic">Điều khoản thanh toán: {{dieu_khoan_tt}}</div><div class="doc-footer">{{ghi_chu}}</div>',
        "variables_meta": {
            "document_number": "Số PO",
            "document_date": "Ngày PO",
            "supplier_name": "Nhà cung cấp",
            "body_html": "Bảng hàng hóa",
            "tong_tien": "Tổng tiền",
            "dieu_khoan_tt": "Điều khoản thanh toán",
            "ghi_chu": "Ghi chú"
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
