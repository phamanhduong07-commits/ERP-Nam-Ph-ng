from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator


class MachineCreate(BaseModel):
    ma_may: str
    ten_may: str
    hang_sx: str | None = None
    nam_sx: int | None = None
    phan_xuong_id: int | None = None
    trang_thai: str = "dang_dung"
    ghi_chu: str | None = None

    @field_validator("trang_thai")
    @classmethod
    def validate_trang_thai(cls, v: str) -> str:
        valid = ("dang_dung", "ngung", "sua_chua")
        if v not in valid:
            raise ValueError(f"trang_thai phải là một trong: {valid}")
        return v


class MachineUpdate(BaseModel):
    ten_may: str | None = None
    hang_sx: str | None = None
    nam_sx: int | None = None
    phan_xuong_id: int | None = None
    trang_thai: str | None = None
    ghi_chu: str | None = None


class MachineResponse(BaseModel):
    id: int
    ma_may: str
    ten_may: str
    hang_sx: str | None
    nam_sx: int | None
    phan_xuong_id: int | None
    trang_thai: str
    ghi_chu: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    machine_id: int
    loai_bao_tri: str
    chu_ky_ngay: int
    ngay_bao_tri_gan_nhat: date | None = None
    ghi_chu: str | None = None


class ScheduleResponse(BaseModel):
    id: int
    machine_id: int
    loai_bao_tri: str
    chu_ky_ngay: int
    ngay_bao_tri_gan_nhat: date | None
    ngay_bao_tri_tiep_theo: date | None
    trang_thai: str
    ghi_chu: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class LogCreate(BaseModel):
    machine_id: int
    schedule_id: int | None = None
    loai: str  # dinh_ky | su_co
    ngay_bat_dau: date
    ngay_ket_thuc: date | None = None
    downtime_phut: int = 0
    mo_ta_su_co: str | None = None
    bien_phap_xu_ly: str | None = None
    chi_phi_vat_tu: Decimal = Decimal("0")
    chi_phi_nhan_cong: Decimal = Decimal("0")

    @field_validator("loai")
    @classmethod
    def validate_loai(cls, v: str) -> str:
        valid = ("dinh_ky", "su_co")
        if v not in valid:
            raise ValueError(f"loai phải là: {valid}")
        return v


class LogResponse(BaseModel):
    id: int
    machine_id: int
    schedule_id: int | None
    loai: str
    ngay_bat_dau: date
    ngay_ket_thuc: date | None
    downtime_phut: int
    mo_ta_su_co: str | None
    bien_phap_xu_ly: str | None
    chi_phi_vat_tu: Decimal
    chi_phi_nhan_cong: Decimal
    tong_chi_phi: Decimal
    created_by: int | None
    created_at: datetime

    class Config:
        from_attributes = True
