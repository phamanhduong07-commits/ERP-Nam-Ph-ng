from datetime import date, datetime
from pydantic import BaseModel, field_validator


class QCDefectCreate(BaseModel):
    loai_loi: str
    mo_ta: str | None = None
    so_luong_loi: int = 0
    hinh_anh_path: str | None = None


class QCDefectResponse(BaseModel):
    id: int
    loai_loi: str
    mo_ta: str | None
    so_luong_loi: int
    hinh_anh_path: str | None

    class Config:
        from_attributes = True


class QCSheetCreate(BaseModel):
    loai: str  # nhan_hang | san_xuat | xuat_hang
    ref_type: str | None = None
    ref_id: int | None = None
    ngay: date
    nguoi_kiem_tra: str | None = None
    ket_qua: str | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    defects: list[QCDefectCreate] = []

    @field_validator("loai")
    @classmethod
    def validate_loai(cls, v: str) -> str:
        valid = ("nhan_hang", "san_xuat", "xuat_hang")
        if v not in valid:
            raise ValueError(f"loai phải là một trong: {valid}")
        return v

    @field_validator("ket_qua")
    @classmethod
    def validate_ket_qua(cls, v: str | None) -> str | None:
        if v is not None:
            valid = ("dat", "khong_dat", "tam_chap_nhan")
            if v not in valid:
                raise ValueError(f"ket_qua phải là một trong: {valid}")
        return v


class QCSheetUpdate(BaseModel):
    nguoi_kiem_tra: str | None = None
    ket_qua: str | None = None
    ghi_chu: str | None = None
    defects: list[QCDefectCreate] | None = None

    @field_validator("ket_qua")
    @classmethod
    def validate_ket_qua(cls, v: str | None) -> str | None:
        if v is not None:
            valid = ("dat", "khong_dat", "tam_chap_nhan")
            if v not in valid:
                raise ValueError(f"ket_qua phải là một trong: {valid}")
        return v


class QCSheetResponse(BaseModel):
    id: int
    so_phieu: str
    loai: str
    ref_type: str | None
    ref_id: int | None
    ngay: date
    nguoi_kiem_tra: str | None
    ket_qua: str | None
    ghi_chu: str | None
    phap_nhan_id: int | None
    phan_xuong_id: int | None
    created_by: int | None
    created_at: datetime
    defects: list[QCDefectResponse] = []

    class Config:
        from_attributes = True


class QCStatsResponse(BaseModel):
    tong: int
    dat: int
    khong_dat: int
    tam_chap_nhan: int
    chua_co_ket_qua: int
    ty_le_dat_pct: float
