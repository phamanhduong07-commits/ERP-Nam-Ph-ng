from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator, model_validator


class SalesInvoiceCreate(BaseModel):
    customer_id: int
    delivery_id: int | None = None
    sales_order_id: int | None = None
    phap_nhan_id: int | None = None
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

    @field_validator("ty_le_vat")
    @classmethod
    def vat_hop_le(cls, v: Decimal) -> Decimal:
        if v not in (Decimal("0"), Decimal("5"), Decimal("8"), Decimal("10")):
            raise ValueError("Thuế VAT phải là 0%, 5%, 8% hoặc 10%")
        return v

    @model_validator(mode="after")
    def tinh_vat_va_tong(self) -> "SalesInvoiceCreate":
        if self.tien_vat is None:
            self.tien_vat = round(self.tong_tien_hang * self.ty_le_vat / 100, 0)
        if self.tong_cong is None:
            self.tong_cong = self.tong_tien_hang + self.tien_vat
        return self


class SalesInvoiceUpdate(BaseModel):
    """Dùng cho điều chỉnh TRƯỚC kết chuyển — các role EDIT_ROLES có thể gọi."""
    han_tt: date | None = None
    mau_so: str | None = None
    ky_hieu: str | None = None
    ten_don_vi: str | None = None
    dia_chi: str | None = None
    ma_so_thue: str | None = None
    nguoi_mua_hang: str | None = None
    hinh_thuc_tt: str | None = None
    # Cho phép điều chỉnh tài chính trước kết chuyển
    tong_tien_hang: Decimal | None = None
    ty_le_vat: Decimal | None = None
    ghi_chu: str | None = None
    ghi_chu_dieu_chinh: str | None = None   # bắt buộc khi thay đổi tài chính

    @field_validator("ty_le_vat")
    @classmethod
    def vat_hop_le(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v not in (Decimal("0"), Decimal("5"), Decimal("8"), Decimal("10")):
            raise ValueError("Thuế VAT phải là 0%, 5%, 8% hoặc 10%")
        return v


class AdjustmentRequest(BaseModel):
    """Yêu cầu điều chỉnh SAU kết chuyển — gửi lên KE_TOAN_TRUONG/GIAM_DOC duyệt."""
    tong_tien_hang: Decimal
    ty_le_vat: Decimal = Decimal("10")
    ghi_chu_dieu_chinh: str   # lý do điều chỉnh, bắt buộc

    @field_validator("tong_tien_hang")
    @classmethod
    def tien_hang_duong(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Tổng tiền hàng không được âm")
        return v

    @field_validator("ty_le_vat")
    @classmethod
    def vat_hop_le(cls, v: Decimal) -> Decimal:
        if v not in (Decimal("0"), Decimal("5"), Decimal("8"), Decimal("10")):
            raise ValueError("Thuế VAT phải là 0%, 5%, 8% hoặc 10%")
        return v


class AdjustmentApprove(BaseModel):
    """Duyệt hoặc từ chối yêu cầu điều chỉnh — chỉ KE_TOAN_TRUONG/GIAM_DOC."""
    approved: bool
    ghi_chu: str | None = None   # lý do từ chối nếu approved=False


class CashReceiptShort(BaseModel):
    id: int
    so_phieu: str
    ngay_phieu: date
    so_tien: Decimal
    hinh_thuc_tt: str
    trang_thai: str

    model_config = {"from_attributes": True}


class InvoiceAdjustmentLogResponse(BaseModel):
    id: int
    invoice_id: int
    adjusted_by_id: int
    adjusted_by_name: str | None = None
    adjusted_at: datetime
    loai: str
    ghi_chu: str
    trang_thai: str
    approved_by_id: int | None
    approved_by_name: str | None = None
    approved_at: datetime | None
    du_lieu_truoc: str | None   # JSON string
    du_lieu_sau: str | None     # JSON string

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
    phap_nhan_id: int | None
    phap_nhan_ten: str | None

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
    anh_phieu_giao: str | None
    ghi_chu: str | None
    receipts: list[CashReceiptShort] = []
    adjustment_logs: list[InvoiceAdjustmentLogResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
