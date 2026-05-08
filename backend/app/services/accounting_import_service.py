from decimal import Decimal
from typing import Any
from sqlalchemy.orm import Session
from app.models.accounting import FixedAsset, WorkshopPayroll
from app.models.theo_doi import PhanXuong
from app.models.accounting import PhapNhan
from app.services.excel_import_service import (
    ImportField, parse_text, parse_decimal, parse_int, parse_date, Resolver
)

# ─── TÀI SẢN CỐ ĐỊNH ──────────────────────────────────────────────────────────

FIXED_ASSET_FIELDS = [
    ImportField("ma_ts", "Mã tài sản", required=True, aliases=("Ma TS", "Mã TS")),
    ImportField("ten_ts", "Tên tài sản", required=True, aliases=("Ten TS", "Tên TS")),
    ImportField("ngay_mua", "Ngày mua", parser=parse_date, aliases=("Ngay mua", "Ngày Mua")),
    ImportField("nguyen_gia", "Nguyên giá", parser=parse_decimal, default=Decimal("0"), aliases=("Nguyen gia", "Giá trị")),
    ImportField("so_thang_khau_hao", "Số tháng KH", parser=parse_int, default=0, aliases=("Thoi gian KH", "Số tháng khấu hao")),
    ImportField("da_khau_hao_thang", "Đã KH (tháng)", parser=parse_int, default=0, aliases=("Da khau hao", "Số tháng đã KH")),
    ImportField("gia_tri_da_khau_hao", "Giá trị đã KH", parser=parse_decimal, default=Decimal("0")),
    ImportField("phan_xuong_ten", "Tên xưởng", aliases=("Phan xuong", "Xưởng")),
    ImportField("phap_nhan_ten", "Tên pháp nhân", aliases=("Phap nhan", "Pháp nhân")),
    ImportField("ghi_chu", "Ghi chú"),
]

def fixed_asset_resolver(db: Session, values: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    errors = []
    
    # Resolve Phan Xuong
    px_name = values.pop("phan_xuong_ten", None)
    if px_name:
        px = db.query(PhanXuong).filter(PhanXuong.ten_xuong.ilike(px_name.strip())).first()
        if px:
            values["phan_xuong_id"] = px.id
        else:
            errors.append(f"Không tìm thấy xưởng: {px_name}")

    # Resolve Phap Nhan
    pn_name = values.pop("phap_nhan_ten", None)
    if pn_name:
        pn = db.query(PhapNhan).filter(PhapNhan.ten_phap_nhan.ilike(pn_name.strip())).first()
        if pn:
            values["phap_nhan_id"] = pn.id
        else:
            errors.append(f"Không tìm thấy pháp nhân: {pn_name}")
            
    return values, errors

# ─── BẢNG LƯƠNG XƯỞNG ─────────────────────────────────────────────────────────

WORKSHOP_PAYROLL_FIELDS = [
    ImportField("thang", "Tháng (MM/YYYY)", parser=parse_date, required=True, aliases=("Ky luong", "Tháng")),
    ImportField("phan_xuong_ten", "Tên xưởng", required=True, aliases=("Phan xuong", "Xưởng")),
    ImportField("phap_nhan_ten", "Tên pháp nhân", aliases=("Phap nhan", "Pháp nhân")),
    ImportField("tong_luong", "Tổng lương", parser=parse_decimal, default=Decimal("0")),
    ImportField("tong_thuong", "Thưởng", parser=parse_decimal, default=Decimal("0")),
    ImportField("tong_bao_hiem", "Bảo hiểm", parser=parse_decimal, default=Decimal("0")),
    ImportField("ghi_chu", "Ghi chú"),
]

def workshop_payroll_resolver(db: Session, values: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    errors = []
    
    # Resolve Phan Xuong
    px_name = values.pop("phan_xuong_ten", None)
    if px_name:
        px = db.query(PhanXuong).filter(PhanXuong.ten_xuong.ilike(px_name.strip())).first()
        if px:
            values["phan_xuong_id"] = px.id
        else:
            errors.append(f"Không tìm thấy xưởng: {px_name}")

    # Resolve Phap Nhan
    pn_name = values.pop("phap_nhan_ten", None)
    if pn_name:
        pn = db.query(PhapNhan).filter(PhapNhan.ten_phap_nhan.ilike(pn_name.strip())).first()
        if pn:
            values["phap_nhan_id"] = pn.id
        else:
            errors.append(f"Không tìm thấy pháp nhân: {pn_name}")
            
    # Set default values for status
    values["trang_thai"] = "cho_duyet"
    
    return values, errors
