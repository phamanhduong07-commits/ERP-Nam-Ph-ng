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
    fax: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    nguoi_lien_he: str | None = None
    so_dien_thoai_lh: str | None = None
    no_tran: Decimal = Decimal("0")
    so_ngay_no: int = 0
    xep_loai: str | None = None
    la_khach_vip: bool = False
    ghi_chu: str | None = None
    email: str | None = None
    phap_nhan: str | None = None
    ke_toan_phu_trach: str | None = None
    dieu_khoan_tt: str | None = None
    sa_cskh: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    ten_viet_tat: str | None = None
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    dia_chi_giao_hang: str | None = None
    dien_thoai: str | None = None
    fax: str | None = None
    ma_so_thue: str | None = None
    nguoi_dai_dien: str | None = None
    nguoi_lien_he: str | None = None
    so_dien_thoai_lh: str | None = None
    no_tran: Decimal | None = None
    so_ngay_no: int | None = None
    xep_loai: str | None = None
    la_khach_vip: bool | None = None
    ghi_chu: str | None = None
    email: str | None = None
    phap_nhan: str | None = None
    ke_toan_phu_trach: str | None = None
    dieu_khoan_tt: str | None = None
    sa_cskh: str | None = None
    trang_thai: bool | None = None
    nv_ids: list[int] | None = None
    nv_phu_trach_id: int | None = None


class CustomerResponse(CustomerBase):
    id: int
    trang_thai: bool
    nv_ids: list[int] = []
    nv_phu_trach_id: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerShort(BaseModel):
    id: int
    ma_kh: str
    ten_viet_tat: str
    ten_don_vi: str | None
    dien_thoai: str | None
    nv_ids: list[int] = []

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
    loai_in: int = 0
    ghim: bool = False
    dan: bool = False
    chap_xa: int = 0
    loai_lan: str | None = None
    loai_thung: str | None = None
    chong_tham: int = 0
    boi: int = 0
    be_so_con: int = 0
    can_mang: int = 0
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
    dvt: str = "Thùng"
    phan_xuong: str | None = None
    loai: str | None = None
    ma_kh_id: int | None = None
    gia_ban: Decimal = Decimal("0")
    # Đặc tính sản xuất
    to_hop_song: str | None = None
    loai_be: str | None = None
    be_hai_manh: bool = False
    ho_nap: bool = False
    ho_day: bool = False
    co_be: bool = False
    be_lo: bool = False
    do_kho: bool = False
    do_phu: bool = False
    may_in: str | None = None
    ban_ve_kt: str | None = None
    nhom_san_pham: str | None = None
    # Tem offset
    co_tem_offset: bool = False
    tem_loai_giay: str | None = None
    tem_gsm: Decimal | None = None
    tem_dai_to: Decimal | None = None
    tem_rong_to: Decimal | None = None
    tem_sp_per_to: int = 1
    tem_waste_to: int = 0
    tem_so_mau: int = 0
    tem_co_can_mang: bool = False
    tem_co_khuon_be: bool = False
    tem_co_uv: bool = False
    tem_co_suppo: bool = False
    tem_co_luoi: bool = False
    tem_hai_manh: bool = False
    tem_khac_thiet_ke: bool = False
    ghi_chu: str | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    ma_hang: str | None = None
    ten_hang: str | None = None
    dvt: str | None = None
    dai: Decimal | None = None
    rong: Decimal | None = None
    cao: Decimal | None = None
    so_lop: int | None = None
    so_mau: int | None = None
    ghim: bool | None = None
    dan: bool | None = None
    loai_thung: str | None = None
    gia_ban: Decimal | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None
    loai_in: int | None = None
    chap_xa: int | None = None
    loai_lan: str | None = None
    chong_tham: int | None = None
    boi: int | None = None
    be_so_con: int | None = None
    can_mang: int | None = None
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
    phan_xuong: str | None = None
    loai: str | None = None
    ma_kh_id: int | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    khong_tinh_nxt: bool | None = None
    to_hop_song: str | None = None
    loai_be: str | None = None
    be_hai_manh: bool | None = None
    ho_nap: bool | None = None
    ho_day: bool | None = None
    co_be: bool | None = None
    be_lo: bool | None = None
    do_kho: bool | None = None
    do_phu: bool | None = None
    may_in: str | None = None
    ban_ve_kt: str | None = None
    nhom_san_pham: str | None = None
    co_tem_offset: bool | None = None
    tem_loai_giay: str | None = None
    tem_gsm: Decimal | None = None
    tem_dai_to: Decimal | None = None
    tem_rong_to: Decimal | None = None
    tem_sp_per_to: int | None = None
    tem_waste_to: int | None = None
    tem_so_mau: int | None = None
    tem_co_can_mang: bool | None = None
    tem_co_khuon_be: bool | None = None
    tem_co_uv: bool | None = None
    tem_co_suppo: bool | None = None
    tem_co_luoi: bool | None = None
    tem_hai_manh: bool | None = None
    tem_khac_thiet_ke: bool | None = None


class ProductResponse(ProductBase):
    id: int
    trang_thai: bool
    created_at: datetime
    ten_khach_hang: str | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    khong_tinh_nxt: bool = False

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
    sx_params_mac_dinh: dict | None = None

    class Config:
        from_attributes = True
