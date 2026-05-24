"""MISA meInvoice API client — Tích hợp hóa đơn điện tử"""
import logging
from datetime import date, datetime
from typing import Any

import requests

from app.config import settings

logger = logging.getLogger(__name__)

_token_cache: dict[str, Any] = {"token": None, "expires_at": None}


def _get_token() -> str:
    """Lấy access token, tự refresh khi hết hạn."""
    now = datetime.utcnow()
    if _token_cache["token"] and _token_cache["expires_at"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]

    resp = requests.post(
        f"{settings.MISA_API_URL}/api/account/login",
        json={
            "Username": settings.MISA_USERNAME,
            "Password": settings.MISA_PASSWORD,
            "CompanyCode": settings.MISA_COMPANY_CODE,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data.get("Data", {}).get("access_token") or data.get("access_token")
    if not token:
        raise ValueError(f"MISA login failed: {data}")

    from datetime import timedelta
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + timedelta(minutes=55)
    return token


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_get_token()}",
        "Content-Type": "application/json",
    }


def create_invoice(invoice_data: dict) -> dict:
    """Tạo hóa đơn nháp trên MISA. Trả về {misa_id, ...}."""
    resp = requests.post(
        f"{settings.MISA_API_URL}/api/invoice",
        json=invoice_data,
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def publish_invoice(misa_id: str) -> dict:
    """Ký số và phát hành hóa đơn. Trả về {so_hoa_don, ma_cqt, pdf_url, xml_url, ...}."""
    resp = requests.post(
        f"{settings.MISA_API_URL}/api/invoice/{misa_id}/publish",
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def cancel_invoice(misa_id: str, ly_do: str) -> dict:
    """Hủy hóa đơn đã phát hành."""
    resp = requests.post(
        f"{settings.MISA_API_URL}/api/invoice/{misa_id}/cancel",
        json={"LyDo": ly_do},
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_invoice_status(misa_id: str) -> dict:
    """Kiểm tra trạng thái hóa đơn từ MISA."""
    resp = requests.get(
        f"{settings.MISA_API_URL}/api/invoice/{misa_id}",
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def build_misa_payload(hdt: Any) -> dict:
    """Chuyển đổi HoaDonDienTu model → MISA API payload."""
    items = hdt.items or []
    return {
        "TemplateCode": settings.MISA_TEMPLATE_CODE,
        "Serial": settings.MISA_SERIAL,
        "InvoiceDate": hdt.ngay_lap.isoformat() if hdt.ngay_lap else date.today().isoformat(),
        "InvoiceType": hdt.loai_hd,
        "BuyerName": hdt.ten_khach_hang,
        "BuyerTaxCode": hdt.ma_so_thue_kh or "",
        "BuyerAddress": hdt.dia_chi_kh or "",
        "AmountWithoutVat": float(hdt.tong_tien_hang),
        "VatAmount": float(hdt.tien_thue_gtgt),
        "TotalAmount": float(hdt.tong_cong),
        "Items": [
            {
                "ItemName": it.get("ten_hang", ""),
                "ItemCode": it.get("ma_hang", ""),
                "Unit": it.get("don_vi", ""),
                "Quantity": it.get("so_luong", 0),
                "UnitPrice": it.get("don_gia", 0),
                "Amount": it.get("thanh_tien", 0),
                "VatRate": it.get("thue_suat", "10%"),
            }
            for it in items
        ],
    }
