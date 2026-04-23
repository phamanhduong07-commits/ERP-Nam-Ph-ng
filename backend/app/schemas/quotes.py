from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator
from app.schemas.master import CustomerShort


class QuoteItemCreate(BaseModel):
    stt: int = 1
    product_id: int | None = None
    loai: str | None = None
    ma_amis: str | None = None
    ten_hang: str
    dvt: str = "Thùng"
    so_luong: Decimal
    so_mau: int = 0

    # Loại giấy — mỗi lớp: mã ký hiệu đồng cấp + định lượng (g/m²)
    so_lop: int = 3
    to_hop_song: str | None = None
    mat: str | None = None
    mat_dl: Decimal | None = None
    song_1: str | None = None
    song_1_dl: Decimal | None = None
    mat_1: str | None = None
    mat_1_dl: Decimal | None = None
    song_2: str | None = None
    song_2_dl: Decimal | None = None
    mat_2: str | None = None
    mat_2_dl: Decimal | None = None
    song_3: str | None = None
    song_3_dl: Decimal | None = None
    mat_3: str | None = None
    mat_3_dl: Decimal | None = None
    lay_gia_moi_nl: bool = False
    don_gia_m2: Decimal | None = None

    # Kích thước
    loai_thung: str | None = None
    dai: Decimal | None = None
    rong: Decimal | None = None
    cao: Decimal | None = None
    kho_tt: Decimal | None = None
    dai_tt: Decimal | None = None
    dien_tich: Decimal | None = None
    khong_ct: bool = False

    # In ấn
    loai_in: str = "khong_in"
    do_kho: bool = False
    ghim: bool = False
    chap_xa: bool = False
    do_phu: bool = False
    dan: bool = False
    boi: bool = False
    be_lo: bool = False
    c_tham: str | None = None
    can_man: str | None = None
    so_c_be: str | None = None
    may_in: str | None = None
    loai_lan: str | None = None
    ban_ve_kt: str | None = None

    gia_ban: Decimal = Decimal("0")
    ghi_chu: str | None = None

    @field_validator("so_luong")
    @classmethod
    def so_luong_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số lượng phải lớn hơn 0")
        return v


class QuoteItemResponse(BaseModel):
    id: int
    stt: int
    product_id: int | None
    loai: str | None
    ma_amis: str | None
    ten_hang: str
    dvt: str
    so_luong: Decimal
    so_mau: int
    so_lop: int
    to_hop_song: str | None
    mat: str | None
    mat_dl: Decimal | None
    song_1: str | None
    song_1_dl: Decimal | None
    mat_1: str | None
    mat_1_dl: Decimal | None
    song_2: str | None
    song_2_dl: Decimal | None
    mat_2: str | None
    mat_2_dl: Decimal | None
    song_3: str | None
    song_3_dl: Decimal | None
    mat_3: str | None
    mat_3_dl: Decimal | None
    lay_gia_moi_nl: bool
    don_gia_m2: Decimal | None
    loai_thung: str | None
    dai: Decimal | None
    rong: Decimal | None
    cao: Decimal | None
    kho_tt: Decimal | None
    dai_tt: Decimal | None
    dien_tich: Decimal | None
    khong_ct: bool
    loai_in: str
    do_kho: bool
    ghim: bool
    chap_xa: bool
    do_phu: bool
    dan: bool
    boi: bool
    be_lo: bool
    c_tham: str | None
    can_man: str | None
    so_c_be: str | None
    may_in: str | None
    loai_lan: str | None
    ban_ve_kt: str | None
    gia_ban: Decimal
    ghi_chu: str | None

    class Config:
        from_attributes = True


class QuoteCreate(BaseModel):
    customer_id: int
    ngay_bao_gia: date
    nv_phu_trach_id: int | None = None
    ngay_het_han: date | None = None
    so_bg_copy: str | None = None

    chi_phi_bang_in: Decimal = Decimal("0")
    chi_phi_khuon: Decimal = Decimal("0")
    chi_phi_van_chuyen: Decimal = Decimal("0")
    tong_tien_hang: Decimal = Decimal("0")
    ty_le_vat: Decimal = Decimal("8")
    tien_vat: Decimal = Decimal("0")
    chi_phi_hang_hoa_dv: Decimal = Decimal("0")
    tong_cong: Decimal = Decimal("0")
    chi_phi_khac_1_ten: str | None = None
    chi_phi_khac_1: Decimal = Decimal("0")
    chi_phi_khac_2_ten: str | None = None
    chi_phi_khac_2: Decimal = Decimal("0")
    chiet_khau: Decimal = Decimal("0")
    gia_ban: Decimal = Decimal("0")
    gia_xuat_phoi_vsp: Decimal = Decimal("0")

    ghi_chu: str | None = None
    dieu_khoan: str | None = None
    items: list[QuoteItemCreate]

    @field_validator("items")
    @classmethod
    def phai_co_mat_hang(cls, v: list) -> list:
        if not v:
            raise ValueError("Báo giá phải có ít nhất 1 mặt hàng")
        return v


class QuoteUpdate(BaseModel):
    ngay_het_han: date | None = None
    nv_phu_trach_id: int | None = None
    chi_phi_bang_in: Decimal | None = None
    chi_phi_khuon: Decimal | None = None
    chi_phi_van_chuyen: Decimal | None = None
    tong_tien_hang: Decimal | None = None
    ty_le_vat: Decimal | None = None
    tien_vat: Decimal | None = None
    chi_phi_hang_hoa_dv: Decimal | None = None
    tong_cong: Decimal | None = None
    chi_phi_khac_1_ten: str | None = None
    chi_phi_khac_1: Decimal | None = None
    chi_phi_khac_2_ten: str | None = None
    chi_phi_khac_2: Decimal | None = None
    chiet_khau: Decimal | None = None
    gia_ban: Decimal | None = None
    gia_xuat_phoi_vsp: Decimal | None = None
    ghi_chu: str | None = None
    dieu_khoan: str | None = None
    items: list[QuoteItemCreate] | None = None


class QuoteResponse(BaseModel):
    id: int
    so_bao_gia: str
    so_bg_copy: str | None
    ngay_bao_gia: date
    customer_id: int
    customer: CustomerShort | None = None
    nv_phu_trach_id: int | None
    nguoi_duyet_id: int | None
    ngay_het_han: date | None
    chi_phi_bang_in: Decimal
    chi_phi_khuon: Decimal
    chi_phi_van_chuyen: Decimal
    tong_tien_hang: Decimal
    ty_le_vat: Decimal
    tien_vat: Decimal
    chi_phi_hang_hoa_dv: Decimal
    tong_cong: Decimal
    chi_phi_khac_1_ten: str | None
    chi_phi_khac_1: Decimal
    chi_phi_khac_2_ten: str | None
    chi_phi_khac_2: Decimal
    chiet_khau: Decimal
    gia_ban: Decimal
    gia_xuat_phoi_vsp: Decimal
    ghi_chu: str | None
    dieu_khoan: str | None
    trang_thai: str
    items: list[QuoteItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuoteListItem(BaseModel):
    id: int
    so_bao_gia: str
    ngay_bao_gia: date
    customer_id: int
    ten_khach_hang: str | None = None
    trang_thai: str
    ngay_het_han: date | None
    tong_cong: Decimal
    so_dong: int = 0

    class Config:
        from_attributes = True
