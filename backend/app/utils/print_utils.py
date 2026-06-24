"""
print_utils.py — Helper dùng chung cho tất cả router in PDF.

Giải quyết vấn đề: backend hardcode cột trong body_html thay vì
đọc selectedColumns từ template, dẫn đến cột in không khớp thiết kế.
"""
from __future__ import annotations
import html
import json
from typing import Any

# Column keys cần align right (số tiền, số lượng)
_RIGHT_ALIGN_KEYS = {
    "so_luong", "gia_ban", "don_gia", "thanh_tien",
    "don_gia_noi_bo", "so_cuon", "trong_luong_kg", "tong_tien",
    "total_m2", "chi_phi", "luong",
}
_CENTER_ALIGN_KEYS = {
    "stt", "dvt", "so_lop", "to_hop_song", "ma_ky_hieu",
    "loai", "trang_thai", "ngay",
}


def parse_easy_config(variables_meta: dict | None) -> dict:
    """Lấy easy_config từ variables_meta, trả về {} nếu lỗi."""
    if not variables_meta:
        return {}
    raw = variables_meta.get("easy_config", "{}")
    try:
        return json.loads(raw) if isinstance(raw, str) else (raw or {})
    except Exception:
        return {}


def get_selected_columns(
    variables_meta: dict | None,
    default_cols: list[dict],
) -> list[dict]:
    """
    Đọc selectedColumns từ template.variables_meta.easy_config.
    Fallback sang default_cols nếu chưa cấu hình.
    """
    ec = parse_easy_config(variables_meta)
    cols = ec.get("selectedColumns")
    if cols and isinstance(cols, list) and len(cols) > 0:
        return cols
    return default_cols


def _col_align(key: str) -> str:
    if key in _RIGHT_ALIGN_KEYS:
        return "right"
    if key in _CENTER_ALIGN_KEYS:
        return "center"
    return "left"


# Alias map: nếu user lưu template với key cũ, vẫn tìm được giá trị
_KEY_ALIASES: dict[str, list[str]] = {
    "gia_ban": ["don_gia"],
    "don_gia": ["gia_ban"],
    "kich_thuoc": ["quy_cach"],
    "quy_cach": ["kich_thuoc"],
    "ma_amis": ["ma_sp", "ma_hang"],
    "ma_sp": ["ma_amis", "ma_hang"],
    "ma_hang": ["ma_amis", "ma_sp"],
}


def _get_val(row: dict, key: str) -> str:
    """Lấy giá trị từ row, thử aliases nếu key chính không có."""
    v = row.get(key)
    if v is not None and v != "":
        return str(v)
    for alt in _KEY_ALIASES.get(key, []):
        v = row.get(alt)
        if v is not None and v != "":
            return str(v)
    return ""


def build_html_table(
    columns: list[dict],
    rows: list[dict],
    *,
    th_style: str = "background:#E65100;color:#fff;padding:5px 6px;border:1px solid #ccc;",
    td_style: str = "border:1px solid #ddd;padding:4px 6px;",
    accent: str = "#E65100",
) -> str:
    """
    Tạo HTML table từ danh sách cột và dữ liệu.

    columns: list[{key, label}]
    rows:    list[dict] — mỗi row là dict với các key tương ứng với column.key
    """
    if not columns:
        return ""

    # Header
    ths = "".join(
        f'<th style="{th_style}text-align:{_col_align(c["key"])}">'
        f'{html.escape(c.get("label", c["key"]))}</th>'
        for c in columns
    )
    header = f"<thead><tr>{ths}</tr></thead>"

    # Body
    body_rows = []
    for row in rows:
        tds = "".join(
            f'<td style="{td_style}text-align:{_col_align(c["key"])}">'
            f'{html.escape(_get_val(row, c["key"]))}</td>'
            for c in columns
        )
        body_rows.append(f"<tr>{tds}</tr>")
    body = f"<tbody>{''.join(body_rows)}</tbody>"

    return (
        f'<table style="width:100%;border-collapse:collapse;font-size:10.5pt;margin-top:8px">'
        f"{header}{body}</table>"
    )
