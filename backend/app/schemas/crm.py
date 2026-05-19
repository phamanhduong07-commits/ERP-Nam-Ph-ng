from datetime import date, datetime
from pydantic import BaseModel, field_validator


VALID_LOAI = ("goi_dien", "gap_mat", "email", "bao_gia", "khieu_nai", "khac")
VALID_KET_QUA = ("tich_cuc", "trung_tinh", "tieu_cuc")


class InteractionCreate(BaseModel):
    customer_id: int
    loai: str
    ngay: date
    noi_dung: str | None = None
    ket_qua: str | None = None
    ngay_nhac_nho: date | None = None
    nguoi_phu_trach_id: int | None = None

    @field_validator("loai")
    @classmethod
    def validate_loai(cls, v: str) -> str:
        if v not in VALID_LOAI:
            raise ValueError(f"loai phải là một trong: {VALID_LOAI}")
        return v

    @field_validator("ket_qua")
    @classmethod
    def validate_ket_qua(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_KET_QUA:
            raise ValueError(f"ket_qua phải là một trong: {VALID_KET_QUA}")
        return v


class InteractionUpdate(BaseModel):
    loai: str | None = None
    ngay: date | None = None
    noi_dung: str | None = None
    ket_qua: str | None = None
    ngay_nhac_nho: date | None = None
    nguoi_phu_trach_id: int | None = None


class InteractionResponse(BaseModel):
    id: int
    customer_id: int
    loai: str
    ngay: date
    noi_dung: str | None
    ket_qua: str | None
    ngay_nhac_nho: date | None
    nguoi_phu_trach_id: int | None
    created_by: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class CreditAlertResponse(BaseModel):
    customer_id: int
    ten_viet_tat: str
    ten_don_vi: str | None
    credit_limit: float
    du_no_hien_tai: float
    vuot_han_muc: float
