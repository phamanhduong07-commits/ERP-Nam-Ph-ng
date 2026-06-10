"""
Shared template substitution utilities.

Mọi backend print route dùng PrintTemplate model đều phải:
1. Gọi apply_template() thay vì vòng lặp content.replace() thủ công
2. apply_template() tự xóa {{...}} còn lại sau khi substitute
   → không bao giờ để literal {{var}} xuất hiện trên phiếu in
"""
from __future__ import annotations

import logging
import re
from datetime import date
from typing import Any

logger = logging.getLogger(__name__)


def fmt_date(d: date | None) -> str:
    """Trả về 'DD tháng MM năm YYYY' — không có prefix 'Ngày' (template tự thêm nếu cần)."""
    if not d:
        return ""
    return f"{d.day:02d} tháng {d.month:02d} năm {d.year}"


def apply_template(html_content: str, replacements: dict[str, Any]) -> str:
    """
    Thay thế tất cả {{key}} trong html_content bằng giá trị tương ứng.
    Keys có thể là dạng bare 'key' hoặc wrapped '{{key}}'.
    Sau khi thay thế, xóa bất kỳ {{...}} nào còn lại — safety net chống literal vars.
    """
    result = html_content
    for key, value in replacements.items():
        placeholder = key if (key.startswith("{{") and key.endswith("}}")) else f"{{{{{key}}}}}"
        result = result.replace(placeholder, "" if value is None else str(value))
    remaining = re.findall(r"\{\{[^}]*\}\}", result)
    if remaining:
        logger.warning(
            "apply_template: %d unresolved variable(s) removed — %s. "
            "Add them to the replacements dict or fix the template.",
            len(remaining),
            remaining,
        )
    result = re.sub(r"\{\{[^}]*\}\}", "", result)
    return result


# ---------------------------------------------------------------------------
# Variable registry — mỗi loại tài liệu hỗ trợ biến nào
# Dùng cho: frontend hint panel, validation, docs
# ---------------------------------------------------------------------------
TEMPLATE_VARS: dict[str, list[dict[str, str]]] = {
    # key = template_type khớp với PrintTemplate.template_type trong DB
    "quote": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ (VD: BÁO GIÁ)"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số báo giá (BG-YYYYMMDD-XXX)"},
        {"var": "{{document_date}}", "desc": "Ngày lập (DD tháng MM năm YYYY)"},
        {"var": "{{customer_name}}", "desc": "Tên khách hàng"},
        {"var": "{{delivery_address}}", "desc": "Ngày hết hạn báo giá"},
        {"var": "{{items_html}}", "desc": "Bảng hàng hóa (HTML)"},
        {"var": "{{total_amount}}", "desc": "Tổng tiền (số)"},
        {"var": "{{total_text}}", "desc": "Tổng tiền (chữ)"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh (HTML)"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
        {"var": "{{company_address}}", "desc": "Địa chỉ công ty"},
        {"var": "{{company_phone}}", "desc": "SĐT công ty"},
        {"var": "{{company_tax_code}}", "desc": "MST công ty"},
        {"var": "{{sales_rep}}", "desc": "Nhân viên kinh doanh"},
    ],
    "purchase_requisition": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số phiếu (YMH-YYYYMMDD-XXX)"},
        {"var": "{{document_date}}", "desc": "Ngày lập"},
        {"var": "{{department}}", "desc": "Phòng ban yêu cầu"},
        {"var": "{{requester}}", "desc": "Người đề nghị"},
        {"var": "{{purpose}}", "desc": "Lý do / mục đích"},
        {"var": "{{items_html}}", "desc": "Bảng vật tư yêu cầu (HTML)"},
        {"var": "{{customer_name}}", "desc": "Đơn vị / bộ phận"},
        {"var": "{{delivery_address}}", "desc": "Địa điểm nhận"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
        {"var": "{{company_address}}", "desc": "Địa chỉ công ty"},
        {"var": "{{phan_xuong}}", "desc": "Tên phân xưởng"},
    ],
    "purchase_order": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số đơn mua hàng"},
        {"var": "{{document_date}}", "desc": "Ngày lập"},
        {"var": "{{customer_name}}", "desc": "Tên nhà cung cấp"},
        {"var": "{{delivery_address}}", "desc": "Địa chỉ giao hàng"},
        {"var": "{{items_html}}", "desc": "Bảng hàng hóa (HTML)"},
        {"var": "{{total_amount}}", "desc": "Tổng tiền"},
        {"var": "{{total_text}}", "desc": "Tổng tiền (chữ)"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
        {"var": "{{company_address}}", "desc": "Địa chỉ công ty"},
        {"var": "{{company_phone}}", "desc": "SĐT công ty"},
        {"var": "{{company_tax_code}}", "desc": "MST công ty"},
    ],
    "goods_receipt": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ (PHIẾU NHẬP KHO)"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số phiếu nhập"},
        {"var": "{{document_date}}", "desc": "Ngày nhập"},
        {"var": "{{customer_name}}", "desc": "Tên nhà cung cấp"},
        {"var": "{{delivery_address}}", "desc": "Diễn giải / lý do nhập"},
        {"var": "{{items_html}}", "desc": "Bảng hàng hóa nhập (HTML)"},
        {"var": "{{total_amount}}", "desc": "Tổng giá trị"},
        {"var": "{{total_text}}", "desc": "Tổng tiền (chữ)"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
    ],
    "material_issue": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ (PHIẾU XUẤT VẬT TƯ)"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số phiếu xuất"},
        {"var": "{{document_date}}", "desc": "Ngày xuất"},
        {"var": "{{customer_name}}", "desc": "Bộ phận nhận"},
        {"var": "{{delivery_address}}", "desc": "Kho xuất"},
        {"var": "{{items_html}}", "desc": "Bảng vật tư xuất (HTML)"},
        {"var": "{{total_amount}}", "desc": "Tổng giá trị"},
        {"var": "{{total_text}}", "desc": "Tổng tiền (chữ)"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
    ],
    "invoice": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ (HÓA ĐƠN BÁN HÀNG)"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số hóa đơn"},
        {"var": "{{document_date}}", "desc": "Ngày lập"},
        {"var": "{{customer_name}}", "desc": "Tên khách hàng"},
        {"var": "{{delivery_address}}", "desc": "Địa chỉ khách hàng"},
        {"var": "{{items_html}}", "desc": "Bảng hàng hóa (HTML)"},
        {"var": "{{total_amount}}", "desc": "Tổng tiền hàng"},
        {"var": "{{vat_amount}}", "desc": "Tiền VAT"},
        {"var": "{{grand_total}}", "desc": "Tổng cộng"},
        {"var": "{{total_text}}", "desc": "Tổng tiền (chữ)"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
        {"var": "{{company_address}}", "desc": "Địa chỉ công ty"},
        {"var": "{{company_tax_code}}", "desc": "MST công ty"},
    ],
    "purchase_invoice": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ (HÓA ĐƠN MUA VÀO)"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số hóa đơn"},
        {"var": "{{document_date}}", "desc": "Ngày lập"},
        {"var": "{{customer_name}}", "desc": "Tên nhà cung cấp"},
        {"var": "{{delivery_address}}", "desc": "Địa chỉ NCC"},
        {"var": "{{items_html}}", "desc": "Bảng hàng hóa (HTML)"},
        {"var": "{{total_amount}}", "desc": "Tổng tiền"},
        {"var": "{{total_text}}", "desc": "Tổng tiền (chữ)"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
    ],
    "cash_receipt": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ (PHIẾU THU)"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số phiếu thu"},
        {"var": "{{document_date}}", "desc": "Ngày lập"},
        {"var": "{{customer_name}}", "desc": "Tên người nộp"},
        {"var": "{{delivery_address}}", "desc": "Địa chỉ người nộp"},
        {"var": "{{total_amount}}", "desc": "Số tiền thu"},
        {"var": "{{total_text}}", "desc": "Số tiền bằng chữ"},
        {"var": "{{purpose}}", "desc": "Lý do thu"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
    ],
    "cash_payment": [
        {"var": "{{subtitle}}", "desc": "Tiêu đề phụ (PHIẾU CHI)"},
        {"var": "{{SUBTITLE}}", "desc": "Tiêu đề phụ (uppercase alias)"},
        {"var": "{{document_number}}", "desc": "Số phiếu chi"},
        {"var": "{{document_date}}", "desc": "Ngày lập"},
        {"var": "{{customer_name}}", "desc": "Tên người nhận"},
        {"var": "{{delivery_address}}", "desc": "Địa chỉ người nhận"},
        {"var": "{{total_amount}}", "desc": "Số tiền chi"},
        {"var": "{{total_text}}", "desc": "Số tiền bằng chữ"},
        {"var": "{{purpose}}", "desc": "Lý do chi"},
        {"var": "{{footer_html}}", "desc": "Footer tùy chỉnh"},
        {"var": "{{company_name}}", "desc": "Tên công ty"},
    ],
}


def standard_vars(
    *,
    subtitle: str = "",
    customer_name: str = "",
    delivery_address: str = "",
    footer_html: str = "",
) -> dict[str, str]:
    """
    Dict các biến generic mà PrintTemplatePage (buildHtmlFromConfig) sinh ra.
    Merge vào ĐẦU replacements dict — route-specific vars ở sau sẽ override nếu cần.

    Dùng:
        replacements = {
            **standard_vars(subtitle="BÁO GIÁ", customer_name=khach_hang),
            "{{document_number}}": so_bao_gia,
            ...
        }
    """
    return {
        "{{subtitle}}": subtitle,
        "{{SUBTITLE}}": subtitle,
        "{{customer_name}}": customer_name,
        "{{delivery_address}}": delivery_address,
        "{{footer_html}}": footer_html,
    }
