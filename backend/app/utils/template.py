"""
Shared template substitution utilities.

Mọi backend print route dùng PrintTemplate model đều phải:
1. Gọi apply_template() thay vì vòng lặp content.replace() thủ công
2. apply_template() tự xóa {{...}} còn lại sau khi substitute
   → không bao giờ để literal {{var}} xuất hiện trên phiếu in
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any


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
    result = re.sub(r"\{\{[^}]*\}\}", "", result)
    return result


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
