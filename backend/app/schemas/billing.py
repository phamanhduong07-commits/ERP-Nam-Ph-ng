from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional


class SalesInvoiceCreate(BaseModel):
    customer_id: int
    delivery_id: int | None = None
    sales_order_id: int | None = None
    ngay_hoa_don: date
    han_tt: date | None = None
    mau_so: str | None = None
    ky_hieu: str | None = None
    # Snapshot thông tin KH (tự động điền nếu để trống)
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    ma_so_thue: str | None = None
    nguoi_mua_hang: str | None = None
    hinh_thuc_tt: str = "CK"
    # Tài chính
    tong_tien_hang: Decimal
    ty_le_vat: Decimal = Decimal("10")
    tien_vat: Decimal | None = None     # nếu None → tự tính = tong_tien_hang * ty_le_vat / 100
    tong_cong: Decimal | None = None    # nếu None → tự tính = tong_tien_hang + tien_vat
    ghi_chu: str | None = None

    @field_validator("tong_tien_hang")
    @classmethod
    def tien_hang_duong(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Tổng tiền hàng không được âm")
        return v

    @model_validator(mode="after")
    def tinh_vat_va_tong(self) -> "SalesInvoiceCreate":
        if self.tien_vat is None:
            self.tien_vat = round(self.tong_tien_hang * self.ty_le_vat / 100, 0)
        if self.tong_cong is None:
            self.tong_cong = self.tong_tien_hang + self.tien_vat
        return self


class SalesInvoiceUpdate(BaseModel):
    han_tt: date | None = None
    mau_so: str | None = None
    ky_hieu: str | None = None
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    ma_so_thue: str | None = None
    nguoi_mua_hang: str | None = None
    hinh_thuc_tt: str | None = None
    ghi_chu: str | None = None


class CashReceiptShort(BaseModel):
    id: int
    so_phieu: str
    ngay_phieu: date
    so_tien: Decimal
    hinh_thuc_tt: str
    trang_thai: str

    model_config = {"from_attributes": True}


class SalesInvoiceListItem(BaseModel):
    id: int
    so_hoa_don: str | None
    ngay_hoa_don: date
    han_tt: date | None
    customer_id: int
    ten_don_vi: str | None
    tong_cong: Decimal
    da_thanh_toan: Decimal
    con_lai: Decimal
    trang_thai: str
    delivery_id: int | None
    sales_order_id: int | None

    model_config = {"from_attributes": True}


class SalesInvoiceResponse(SalesInvoiceListItem):
    mau_so: str | None
    ky_hieu: str | None
    ma_so_thue: str | None
    dia_chi: str | None
    nguoi_mua_hang: str | None
    hinh_thuc_tt: str
    tong_tien_hang: Decimal
    ty_le_vat: Decimal
    tien_vat: Decimal
    ghi_chu: str | None
    receipts: list[CashReceiptShort] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
