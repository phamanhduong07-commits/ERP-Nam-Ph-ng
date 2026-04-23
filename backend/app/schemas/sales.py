from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator
from app.schemas.master import CustomerShort, ProductShort


class SalesOrderItemCreate(BaseModel):
    product_id: int
    ten_hang: str = ""
    so_luong: Decimal
    don_gia: Decimal
    dvt: str = "Thùng"
    ngay_giao_hang: date | None = None
    ghi_chu_san_pham: str | None = None
    yeu_cau_in: str | None = None

    @field_validator("so_luong")
    @classmethod
    def so_luong_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số lượng phải lớn hơn 0")
        return v


class SalesOrderItemUpdate(BaseModel):
    so_luong: Decimal | None = None
    don_gia: Decimal | None = None
    ngay_giao_hang: date | None = None
    ghi_chu_san_pham: str | None = None
    yeu_cau_in: str | None = None


class SalesOrderItemResponse(BaseModel):
    id: int
    product_id: int | None = None
    ten_hang: str = ""
    product: ProductShort | None = None
    so_luong: Decimal
    dvt: str
    don_gia: Decimal
    thanh_tien: Decimal
    ngay_giao_hang: date | None
    ghi_chu_san_pham: str | None
    yeu_cau_in: str | None
    so_luong_da_xuat: Decimal
    trang_thai_dong: str

    class Config:
        from_attributes = True


class SalesOrderCreate(BaseModel):
    customer_id: int
    ngay_don: date
    ngay_giao_hang: date | None = None
    dia_chi_giao: str | None = None
    ghi_chu: str | None = None
    items: list[SalesOrderItemCreate]

    @field_validator("items")
    @classmethod
    def phai_co_san_pham(cls, v: list) -> list:
        if not v:
            raise ValueError("Đơn hàng phải có ít nhất 1 sản phẩm")
        return v


class SalesOrderUpdate(BaseModel):
    ngay_giao_hang: date | None = None
    dia_chi_giao: str | None = None
    ghi_chu: str | None = None


class SalesOrderResponse(BaseModel):
    id: int
    so_don: str
    ngay_don: date
    customer_id: int
    customer: CustomerShort | None = None
    trang_thai: str
    ngay_giao_hang: date | None
    dia_chi_giao: str | None
    ghi_chu: str | None
    tong_tien: Decimal
    items: list[SalesOrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesOrderListItem(BaseModel):
    id: int
    so_don: str
    ngay_don: date
    customer_id: int
    ten_khach_hang: str | None = None
    trang_thai: str
    ngay_giao_hang: date | None
    tong_tien: Decimal
    so_dong: int = 0

    class Config:
        from_attributes = True


class PagedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
