from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class CustomerBase(BaseModel):
    ma_kh: str
    ten_viet_tat: str
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dia_chi_giao_hang: str | None = None
    dien_thoai: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    nguoi_lien_he: str | None = None
    so_dien_thoai_lh: str | None = None
    no_tran: Decimal = Decimal("0")
    so_ngay_no: int = 0
    xep_loai: str | None = None
    la_khach_vip: bool = False
    ghi_chu: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    ten_viet_tat: str | None = None
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dia_chi_giao_hang: str | None = None
    dien_thoai: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    nguoi_lien_he: str | None = None
    so_dien_thoai_lh: str | None = None
    no_tran: Decimal | None = None
    so_ngay_no: int | None = None
    xep_loai: str | None = None
    la_khach_vip: bool | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None


class CustomerResponse(CustomerBase):
    id: int
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerShort(BaseModel):
    id: int
    ma_kh: str
    ten_viet_tat: str
    ten_don_vi: str | None
    dien_thoai: str | None

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    ma_amis: str
    ma_hang: str | None = None
    ten_hang: str
    dai: Decimal | None = None
    rong: Decimal | None = None
    cao: Decimal | None = None
    so_lop: int = 3
    so_mau: int = 0
    ghim: bool = False
    dan: bool = False
    dvt: str = "Thùng"
    phan_xuong: str | None = None
    loai: str | None = None
    ma_kh_id: int | None = None
    gia_ban: Decimal = Decimal("0")
    ghi_chu: str | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    ten_hang: str | None = None
    dai: Decimal | None = None
    rong: Decimal | None = None
    cao: Decimal | None = None
    so_lop: int | None = None
    so_mau: int | None = None
    ghim: bool | None = None
    dan: bool | None = None
    gia_ban: Decimal | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None


class ProductResponse(ProductBase):
    id: int
    trang_thai: bool
    created_at: datetime
    ten_khach_hang: str | None = None

    class Config:
        from_attributes = True


class ProductShort(BaseModel):
    id: int
    ma_amis: str
    ma_hang: str | None
    ten_hang: str
    dai: Decimal | None
    rong: Decimal | None
    cao: Decimal | None
    so_lop: int
    dvt: str
    gia_ban: Decimal

    class Config:
        from_attributes = True
