from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator
from app.schemas.master import CustomerShort, ProductShort


class SalesOrderItemCreate(BaseModel):
    product_id: int
    ten_hang: str = ""
    so_luong: Decimal
    don_gia: Decimal
    ty_le_giam_gia: Decimal = Decimal(0)  # % giảm giá
    so_tien_giam_gia: Decimal = Decimal(0)  # Số tiền giảm giá
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
    ty_le_giam_gia: Decimal | None = None
    so_tien_giam_gia: Decimal | None = None
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
    ty_le_giam_gia: Decimal
    so_tien_giam_gia: Decimal
    thanh_tien: Decimal
    ngay_giao_hang: date | None
    ghi_chu_san_pham: str | None
    yeu_cau_in: str | None
    so_luong_da_xuat: Decimal
    trang_thai_dong: str
    # Thông số kỹ thuật
    loai_thung: str | None = None
    dai:  Decimal | None = None
    rong: Decimal | None = None
    cao:  Decimal | None = None
    so_lop:      int | None = None
    to_hop_song: str | None = None
    mat:     str | None = None
    mat_dl:  Decimal | None = None
    song_1:    str | None = None
    song_1_dl: Decimal | None = None
    mat_1:     str | None = None
    mat_1_dl:  Decimal | None = None
    song_2:    str | None = None
    song_2_dl: Decimal | None = None
    mat_2:     str | None = None
    mat_2_dl:  Decimal | None = None
    song_3:    str | None = None
    song_3_dl: Decimal | None = None
    mat_3:     str | None = None
    mat_3_dl:  Decimal | None = None
    loai_in: str | None = None
    so_mau:  int | None = None
    # Link sang lệnh SX (nếu đã lập lệnh)
    production_order_item_id: int | None = None

    class Config:
        from_attributes = True


class SalesOrderCreate(BaseModel):
    customer_id: int
    ngay_don: date
    phap_nhan_id: int | None = None
    phap_nhan_sx_id: int | None = None
    phan_xuong_id: int | None = None
    nv_kinh_doanh_id: int | None = None
    ngay_giao_hang: date | None = None
    dia_chi_giao: str | None = None
    ghi_chu: str | None = None
    ty_le_giam_gia: Decimal = Decimal(0)  # % giảm giá đơn hàng
    so_tien_giam_gia: Decimal = Decimal(0)  # Số tiền giảm giá đơn hàng
    items: list[SalesOrderItemCreate]

    @field_validator("items")
    @classmethod
    def phai_co_san_pham(cls, v: list) -> list:
        if not v:
            raise ValueError("Đơn hàng phải có ít nhất 1 sản phẩm")
        return v


class SalesOrderUpdate(BaseModel):
    phap_nhan_id: int | None = None
    phap_nhan_sx_id: int | None = None
    ngay_giao_hang: date | None = None
    dia_chi_giao: str | None = None
    ghi_chu: str | None = None
    ty_le_giam_gia: Decimal | None = None
    so_tien_giam_gia: Decimal | None = None


class SalesOrderResponse(BaseModel):
    id: int
    so_don: str
    ngay_don: date
    customer_id: int
    customer: CustomerShort | None = None
    phap_nhan_id: int | None = None
    ten_phap_nhan: str | None = None
    phap_nhan_sx_id: int | None = None
    ten_phap_nhan_sx: str | None = None
    phan_xuong_id: int | None = None
    ten_phan_xuong: str | None = None
    trang_thai: str
    ngay_giao_hang: date | None
    dia_chi_giao: str | None
    ghi_chu: str | None
    tong_tien: Decimal
    ty_le_giam_gia: Decimal
    so_tien_giam_gia: Decimal
    tong_tien_sau_giam: Decimal
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
    created_at: datetime

    class Config:
        from_attributes = True


class PagedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


# ─────────────────────────────────────────────
# Sales Returns
# ─────────────────────────────────────────────

class SalesReturnItemCreate(BaseModel):
    delivery_order_item_id: int | None = None
    sales_order_item_id: int
    so_luong_tra: Decimal
    don_gia_tra: Decimal | None = None
    ly_do_tra: str | None = None
    tinh_trang_hang: str = "tot"  # tot | hong | loi
    ghi_chu: str | None = None

    @field_validator("so_luong_tra")
    @classmethod
    def so_luong_tra_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số lượng trả phải lớn hơn 0")
        return v


class SalesReturnItemUpdate(BaseModel):
    so_luong_tra: Decimal | None = None
    don_gia_tra: Decimal | None = None
    ly_do_tra: str | None = None
    tinh_trang_hang: str | None = None
    ghi_chu: str | None = None


class SalesReturnItemResponse(BaseModel):
    id: int
    delivery_order_item_id: int | None = None
    sales_order_item_id: int
    sales_order_item: SalesOrderItemResponse | None = None
    so_luong_tra: Decimal
    don_gia_tra: Decimal
    thanh_tien_tra: Decimal
    ly_do_tra: str | None
    tinh_trang_hang: str
    ghi_chu: str | None

    class Config:
        from_attributes = True


class SalesReturnCreate(BaseModel):
    sales_order_id: int
    delivery_order_id: int | None = None  # Phiếu xuất kho cụ thể
    customer_id: int
    ngay_tra: date
    ly_do_tra: str
    ghi_chu: str | None = None
    items: list[SalesReturnItemCreate]

    @field_validator("items")
    @classmethod
    def phai_co_item_tra(cls, v: list) -> list:
        if not v:
            raise ValueError("Phiếu trả phải có ít nhất 1 item")
        return v


class SalesReturnUpdate(BaseModel):
    ngay_tra: date | None = None
    ly_do_tra: str | None = None
    ghi_chu: str | None = None
    items: list[SalesReturnItemCreate] | None = None


class SalesReturnResponse(BaseModel):
    id: int
    so_phieu_tra: str
    ngay_tra: date
    sales_order_id: int
    sales_order: SalesOrderResponse | None = None
    customer_id: int
    customer: CustomerShort | None = None
    ly_do_tra: str
    trang_thai: str
    tong_tien_tra: Decimal
    ghi_chu: str | None
    items: list[SalesReturnItemResponse] = []
    created_by: int | None
    ten_nguoi_tao: str | None = None
    approved_by: int | None
    ten_nguoi_duyet: str | None = None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesReturnListItem(BaseModel):
    id: int
    so_phieu_tra: str
    ngay_tra: date
    sales_order_id: int
    so_don_ban: str | None = None
    customer_id: int
    ten_khach_hang: str | None = None
    ly_do_tra: str
    trang_thai: str
    tong_so_luong_tra: Decimal = Decimal("0")
    tong_tien_tra: Decimal
    created_at: datetime

    class Config:
        from_attributes = True
