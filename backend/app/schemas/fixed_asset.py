from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator


VALID_TRANG_THAI = ("dang_su_dung", "da_kh_het", "thanh_ly")


class FixedAssetCreate(BaseModel):
    ma_ts: str
    ten_ts: str
    ngay_mua: date
    nguyen_gia: Decimal
    so_thang_khau_hao: int
    phan_xuong_id: int | None = None
    phap_nhan_id: int | None = None
    tk_nguyen_gia: str = "211"
    tk_khau_hao: str = "214"
    tk_chi_phi: str = "154"
    bo_qua_hach_toan: bool = False

    @field_validator("nguyen_gia")
    @classmethod
    def validate_nguyen_gia(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("nguyen_gia phải > 0")
        return v

    @field_validator("so_thang_khau_hao")
    @classmethod
    def validate_thoi_gian(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("so_thang_khau_hao phải > 0")
        return v


class FixedAssetUpdate(BaseModel):
    ten_ts: str | None = None
    trang_thai: str | None = None
    phan_xuong_id: int | None = None
    tk_nguyen_gia: str | None = None
    tk_khau_hao: str | None = None
    tk_chi_phi: str | None = None
    bo_qua_hach_toan: bool | None = None

    @field_validator("trang_thai")
    @classmethod
    def validate_trang_thai(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TRANG_THAI:
            raise ValueError(f"trang_thai phải là một trong: {VALID_TRANG_THAI}")
        return v


class FixedAssetResponse(BaseModel):
    id: int
    ma_ts: str
    ten_ts: str
    ngay_mua: date
    nguyen_gia: Decimal
    so_thang_khau_hao: int
    da_khau_hao_thang: int
    gia_tri_da_khau_hao: Decimal
    trang_thai: str
    phan_xuong_id: int | None
    phap_nhan_id: int | None
    tk_nguyen_gia: str
    tk_khau_hao: str
    tk_chi_phi: str
    bo_qua_hach_toan: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DepreciationEntryResponse(BaseModel):
    id: int
    asset_id: int
    ky: str
    so_tien_kh: Decimal
    gia_tri_da_kh_sau: Decimal
    journal_entry_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class RunDepreciationRequest(BaseModel):
    ky: str  # YYYY-MM

    @field_validator("ky")
    @classmethod
    def validate_ky(cls, v: str) -> str:
        parts = v.split("-")
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            raise ValueError("ky phải có định dạng YYYY-MM")
        if int(parts[1]) < 1 or int(parts[1]) > 12:
            raise ValueError("tháng phải từ 01–12")
        return v


class RunDepreciationResponse(BaseModel):
    ky: str
    so_tscd_da_kh: int
    tong_so_tien_kh: Decimal
