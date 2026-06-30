from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator

VALID_LOAI = ("ban_in", "khuon_be")
VALID_NGUOI_CHI_TRA = ("khach_hang", "cong_ty")
VALID_TRANG_THAI = ("cho_mua", "dang_mua", "dang_dung", "hong", "da_tra_khach", "mat")


class TaiSanInCreate(BaseModel):
    ma_tai_san: str | None = None  # nếu None sẽ auto-generate
    loai: str
    mo_ta: str | None = None
    customer_id: int
    nguoi_chi_tra: str = "khach_hang"
    gia_tri: Decimal = Decimal("0")
    supplier_id: int | None = None
    other_material_id: int | None = None
    purchase_order_id: int | None = None
    sales_order_thu_id: int | None = None
    da_thu_tien: bool = False
    san_luong_dinh_muc_hoan: Decimal | None = None
    da_hoan_tien: bool = False
    cash_payment_hoan_id: int | None = None
    ngay_tao: date
    trang_thai: str = "cho_mua"
    ghi_chu: str | None = None

    @field_validator("loai")
    @classmethod
    def validate_loai(cls, v: str) -> str:
        if v not in VALID_LOAI:
            raise ValueError(f"loai phải là: {VALID_LOAI}")
        return v

    @field_validator("nguoi_chi_tra")
    @classmethod
    def validate_nguoi_chi_tra(cls, v: str) -> str:
        if v not in VALID_NGUOI_CHI_TRA:
            raise ValueError(f"nguoi_chi_tra phải là: {VALID_NGUOI_CHI_TRA}")
        return v

    @field_validator("trang_thai")
    @classmethod
    def validate_trang_thai(cls, v: str) -> str:
        if v not in VALID_TRANG_THAI:
            raise ValueError(f"trang_thai phải là: {VALID_TRANG_THAI}")
        return v


class TaiSanInUpdate(BaseModel):
    mo_ta: str | None = None
    nguoi_chi_tra: str | None = None
    gia_tri: Decimal | None = None
    supplier_id: int | None = None
    other_material_id: int | None = None
    purchase_order_id: int | None = None
    sales_order_thu_id: int | None = None
    da_thu_tien: bool | None = None
    san_luong_dinh_muc_hoan: Decimal | None = None
    da_hoan_tien: bool | None = None
    cash_payment_hoan_id: int | None = None
    trang_thai: str | None = None
    ghi_chu: str | None = None

    @field_validator("nguoi_chi_tra")
    @classmethod
    def validate_nguoi_chi_tra(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_NGUOI_CHI_TRA:
            raise ValueError(f"nguoi_chi_tra phải là: {VALID_NGUOI_CHI_TRA}")
        return v

    @field_validator("trang_thai")
    @classmethod
    def validate_trang_thai(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TRANG_THAI:
            raise ValueError(f"trang_thai phải là: {VALID_TRANG_THAI}")
        return v


class SanPhamLinkCreate(BaseModel):
    san_pham_id: int
    ghi_chu: str | None = None


class SanPhamLinkResponse(BaseModel):
    id: int
    san_pham_id: int
    ghi_chu: str | None
    created_at: datetime
    # Thông tin sản phẩm
    ma_amis: str | None = None
    ma_hang: str | None = None
    ten_hang: str | None = None

    class Config:
        from_attributes = True


class TaiSanInResponse(BaseModel):
    id: int
    ma_tai_san: str
    loai: str
    mo_ta: str | None
    customer_id: int
    ten_khach: str | None = None
    nguoi_chi_tra: str
    gia_tri: Decimal
    supplier_id: int | None = None
    ten_ncc: str | None = None
    other_material_id: int | None = None
    ma_nvl: str | None = None
    ten_nvl: str | None = None
    purchase_order_id: int | None
    so_po: str | None = None
    sales_order_thu_id: int | None
    so_don_thu: str | None = None
    da_thu_tien: bool
    san_luong_dinh_muc_hoan: Decimal | None
    san_luong_thuc_te: Decimal | None = None  # computed
    da_hoan_tien: bool
    cash_payment_hoan_id: int | None
    ngay_tao: date
    trang_thai: str
    ghi_chu: str | None
    user_id: int | None
    created_at: datetime
    updated_at: datetime
    san_pham_links: list[SanPhamLinkResponse] = []

    class Config:
        from_attributes = True


class TaiSanInListResponse(BaseModel):
    id: int
    ma_tai_san: str
    loai: str
    mo_ta: str | None
    customer_id: int
    ten_khach: str | None = None
    nguoi_chi_tra: str
    gia_tri: Decimal
    supplier_id: int | None = None
    ten_ncc: str | None = None
    other_material_id: int | None = None
    ma_nvl: str | None = None
    trang_thai: str
    da_thu_tien: bool
    da_hoan_tien: bool
    san_luong_dinh_muc_hoan: Decimal | None
    san_luong_thuc_te: Decimal | None = None
    ngay_tao: date
    so_san_pham: int = 0

    class Config:
        from_attributes = True
