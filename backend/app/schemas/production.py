from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator
from app.schemas.master import ProductShort


class ProductionOrderItemCreate(BaseModel):
    product_id: int | None = None
    sales_order_item_id: int | None = None
    ten_hang: str
    so_luong_ke_hoach: Decimal
    dvt: str = "Thùng"
    ngay_giao_hang: date | None = None
    ghi_chu: str | None = None

    @field_validator("so_luong_ke_hoach")
    @classmethod
    def sl_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số lượng phải lớn hơn 0")
        return v


class ProductionOrderItemResponse(BaseModel):
    id: int
    product_id: int | None
    sales_order_item_id: int | None
    ten_hang: str
    product: ProductShort | None = None
    so_luong_ke_hoach: Decimal
    so_luong_hoan_thanh: Decimal
    dvt: str
    ngay_giao_hang: date | None
    ghi_chu: str | None
    # Thông số kỹ thuật
    loai_thung: str | None = None
    dai: Decimal | None = None
    rong: Decimal | None = None
    cao: Decimal | None = None
    so_lop: int | None = None
    to_hop_song: str | None = None
    mat: str | None = None;     mat_dl: Decimal | None = None
    song_1: str | None = None;  song_1_dl: Decimal | None = None
    mat_1: str | None = None;   mat_1_dl: Decimal | None = None
    song_2: str | None = None;  song_2_dl: Decimal | None = None
    mat_2: str | None = None;   mat_2_dl: Decimal | None = None
    song_3: str | None = None;  song_3_dl: Decimal | None = None
    mat_3: str | None = None;   mat_3_dl: Decimal | None = None
    loai_in: str | None = None
    so_mau: int | None = None
    loai_lan: str | None = None
    kho_tt: Decimal | None = None
    dai_tt: Decimal | None = None
    dien_tich: Decimal | None = None
    gia_ban_muc_tieu: Decimal | None = None

    class Config:
        from_attributes = True


class TaoLenhBody(BaseModel):
    """Body cho POST /tu-don-hang/{order_id}."""
    ngay_lenh: date | None = None
    ngay_hoan_thanh_ke_hoach: date | None = None
    ghi_chu: str | None = None


class ProductionOrderCreate(BaseModel):
    ngay_lenh: date
    sales_order_id: int | None = None
    ngay_bat_dau_ke_hoach: date | None = None
    ngay_hoan_thanh_ke_hoach: date | None = None
    ghi_chu: str | None = None
    items: list[ProductionOrderItemCreate]

    @field_validator("items")
    @classmethod
    def phai_co_items(cls, v: list) -> list:
        if not v:
            raise ValueError("Lệnh SX phải có ít nhất 1 sản phẩm")
        return v


class ProductionOrderUpdate(BaseModel):
    ngay_bat_dau_ke_hoach: date | None = None
    ngay_hoan_thanh_ke_hoach: date | None = None
    ngay_bat_dau_thuc_te: date | None = None
    ngay_hoan_thanh_thuc_te: date | None = None
    ghi_chu: str | None = None


class ProductionOrderResponse(BaseModel):
    id: int
    so_lenh: str
    ngay_lenh: date
    sales_order_id: int | None
    so_don: str | None = None
    ten_khach_hang: str | None = None
    ma_khach_hang: str | None = None
    trang_thai: str
    ngay_bat_dau_ke_hoach: date | None
    ngay_hoan_thanh_ke_hoach: date | None
    ngay_bat_dau_thuc_te: date | None
    ngay_hoan_thanh_thuc_te: date | None
    ghi_chu: str | None
    items: list[ProductionOrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductionOrderListItem(BaseModel):
    id: int
    so_lenh: str
    ngay_lenh: date
    sales_order_id: int | None
    so_don: str | None = None
    trang_thai: str
    ngay_hoan_thanh_ke_hoach: date | None
    so_dong: int = 0
    tong_sl_ke_hoach: Decimal = Decimal("0")

    class Config:
        from_attributes = True


class UpdateItemSxParams(BaseModel):
    """Thông số sản xuất: kết cấu + chiều khổ — KHÔNG ảnh hưởng giá bán."""
    kho_tt: Decimal | None = None
    dai_tt: Decimal | None = None
    to_hop_song: str | None = None
    mat: str | None = None;     mat_dl: Decimal | None = None
    song_1: str | None = None;  song_1_dl: Decimal | None = None
    mat_1: str | None = None;   mat_1_dl: Decimal | None = None
    song_2: str | None = None;  song_2_dl: Decimal | None = None
    mat_2: str | None = None;   mat_2_dl: Decimal | None = None
    song_3: str | None = None;  song_3_dl: Decimal | None = None
    mat_3: str | None = None;   mat_3_dl: Decimal | None = None


class UpdateItemProgress(BaseModel):
    so_luong_hoan_thanh: Decimal

    @field_validator("so_luong_hoan_thanh")
    @classmethod
    def sl_khong_am(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Số lượng không được âm")
        return v


class PagedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
