import math
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, model_validator


class ProductionPlanLineCreate(BaseModel):
    production_order_item_id: int
    thu_tu: int = 0
    ngay_chay: date | None = None
    kho1: Decimal | None = None       # khổ 1 con sản phẩm (cm)
    kho_giay: Decimal | None = None   # Ch Khổ người dùng chọn (cm)
    so_dao: int | None = None
    so_luong_ke_hoach: Decimal
    ghi_chu: str | None = None

    @model_validator(mode="after")
    def auto_calc(self) -> "ProductionPlanLineCreate":
        if self.kho1 and self.kho_giay and not self.so_dao:
            self.so_dao = math.floor(float(self.kho_giay) / float(self.kho1))
        return self


class ProductionPlanLineUpdate(BaseModel):
    thu_tu: int | None = None
    ngay_chay: date | None = None
    kho1: Decimal | None = None
    kho_giay: Decimal | None = None
    so_dao: int | None = None
    so_luong_ke_hoach: Decimal | None = None
    so_luong_hoan_thanh: Decimal | None = None
    trang_thai: str | None = None
    ghi_chu: str | None = None


class ProductionPlanLineResponse(BaseModel):
    id: int
    plan_id: int
    production_order_item_id: int
    thu_tu: int
    ngay_chay: date | None
    kho1: Decimal | None
    kho_giay: Decimal | None
    so_dao: int | None
    kho_tt: Decimal | None
    so_luong_ke_hoach: Decimal
    so_luong_hoan_thanh: Decimal
    trang_thai: str
    ghi_chu: str | None
    # Thông tin join
    so_lenh: str | None = None
    ma_kh: str | None = None
    ten_khach_hang: str | None = None
    ten_hang: str | None = None
    ngay_giao_hang: date | None = None
    loai_thung: str | None = None
    dai: Decimal | None = None
    rong: Decimal | None = None
    cao: Decimal | None = None
    so_lop: int | None = None
    to_hop_song: str | None = None

    class Config:
        from_attributes = True


class ProductionPlanCreate(BaseModel):
    ngay_ke_hoach: date
    ghi_chu: str | None = None
    lines: list[ProductionPlanLineCreate] = []


class ProductionPlanUpdate(BaseModel):
    ngay_ke_hoach: date | None = None
    ghi_chu: str | None = None


class ProductionPlanListItem(BaseModel):
    id: int
    so_ke_hoach: str
    ngay_ke_hoach: date
    trang_thai: str
    so_dong: int = 0
    tong_sl: Decimal = Decimal("0")
    created_at: datetime

    class Config:
        from_attributes = True


class ProductionPlanResponse(BaseModel):
    id: int
    so_ke_hoach: str
    ngay_ke_hoach: date
    ghi_chu: str | None
    trang_thai: str
    lines: list[ProductionPlanLineResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AvailableItemResponse(BaseModel):
    """Dòng LSX có thể thêm vào kế hoạch"""
    production_order_item_id: int
    so_lenh: str
    ma_kh: str | None
    ten_khach_hang: str | None
    ten_hang: str
    so_luong_ke_hoach: Decimal
    ngay_giao_hang: date | None
    loai_thung: str | None = None
    dai: Decimal | None = None
    rong: Decimal | None = None
    cao: Decimal | None = None
    so_lop: int | None = None
    to_hop_song: str | None = None
    kho1_tinh_toan: Decimal | None = None   # kho1 tính từ công thức


class PagedPlanResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


class PushToQueueRequest(BaseModel):
    production_order_item_id: int
    kho1: Decimal | None = None
    kho_giay: Decimal | None = None
    so_dao: int | None = None
    so_luong_ke_hoach: Decimal


class QueueLineResponse(BaseModel):
    """Dòng chờ sản xuất — flat view qua tất cả kế hoạch"""
    id: int
    plan_id: int
    so_ke_hoach: str
    production_order_item_id: int
    thu_tu: int
    ngay_chay: date | None
    kho1: Decimal | None
    kho_giay: Decimal | None
    so_dao: int | None
    kho_tt: Decimal | None
    so_luong_ke_hoach: Decimal
    so_luong_hoan_thanh: Decimal
    trang_thai: str
    ghi_chu: str | None
    so_lenh: str | None
    ma_kh: str | None
    ten_khach_hang: str | None
    ten_hang: str | None
    ngay_giao_hang: date | None
    loai_thung: str | None
    dai: Decimal | None
    rong: Decimal | None
    cao: Decimal | None
    so_lop: int | None
    to_hop_song: str | None
    loai_lan: str | None
    dai_tt: Decimal | None
    # Kết cấu giấy
    mat: str | None;     mat_dl: Decimal | None
    song_1: str | None;  song_1_dl: Decimal | None
    mat_1: str | None;   mat_1_dl: Decimal | None
    song_2: str | None;  song_2_dl: Decimal | None
    mat_2: str | None;   mat_2_dl: Decimal | None
    song_3: str | None;  song_3_dl: Decimal | None
    mat_3: str | None;   mat_3_dl: Decimal | None

    class Config:
        from_attributes = True
