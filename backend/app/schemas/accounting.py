from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator, model_validator


# ──────────────────────────────────────────────
# Hóa đơn mua hàng
# ──────────────────────────────────────────────

class PurchaseInvoiceCreate(BaseModel):
    supplier_id: int
    po_id: int | None = None
    gr_id: int | None = None
    so_hoa_don: str | None = None
    mau_so: str | None = None
    ky_hieu: str | None = None
    ngay_lap: date
    ngay_hoa_don: date | None = None
    han_tt: date | None = None
    ten_don_vi: str | None = None
    ma_so_thue: str | None = None
    thue_suat: Decimal = Decimal("10")
    tong_tien_hang: Decimal
    tien_thue: Decimal | None = None      # nếu None → tự tính
    tong_thanh_toan: Decimal | None = None
    ghi_chu: str | None = None

    @field_validator("tong_tien_hang")
    @classmethod
    def tien_hang_duong(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Tổng tiền hàng không được âm")
        return v

    @model_validator(mode="after")
    def tinh_thue_va_tong(self) -> "PurchaseInvoiceCreate":
        if self.tien_thue is None:
            self.tien_thue = round(self.tong_tien_hang * self.thue_suat / 100, 0)
        if self.tong_thanh_toan is None:
            self.tong_thanh_toan = self.tong_tien_hang + self.tien_thue
        return self


class CashPaymentShort(BaseModel):
    id: int
    so_phieu: str
    ngay_phieu: date
    so_tien: Decimal
    hinh_thuc_tt: str
    trang_thai: str

    model_config = {"from_attributes": True}


class PurchaseInvoiceListItem(BaseModel):
    id: int
    so_hoa_don: str | None
    ngay_lap: date
    han_tt: date | None
    supplier_id: int
    ten_don_vi: str | None
    tong_thanh_toan: Decimal
    da_thanh_toan: Decimal
    con_lai: Decimal
    trang_thai: str
    po_id: int | None
    gr_id: int | None

    model_config = {"from_attributes": True}


class PurchaseInvoiceResponse(PurchaseInvoiceListItem):
    mau_so: str | None
    ky_hieu: str | None
    ngay_hoa_don: date | None
    ma_so_thue: str | None
    thue_suat: Decimal
    tong_tien_hang: Decimal
    tien_thue: Decimal
    ghi_chu: str | None
    payments: list[CashPaymentShort] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Phiếu thu
# ──────────────────────────────────────────────

class CashReceiptCreate(BaseModel):
    customer_id: int
    sales_invoice_id: int | None = None
    ngay_phieu: date
    hinh_thuc_tt: str = "CK"
    so_tai_khoan: str | None = None
    so_tham_chieu: str | None = None
    dien_giai: str | None = None
    so_tien: Decimal
    tk_no: str = "112"
    tk_co: str = "131"

    @field_validator("so_tien")
    @classmethod
    def tien_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số tiền phải lớn hơn 0")
        return v

    @model_validator(mode="after")
    def tk_no_theo_httt(self) -> "CashReceiptCreate":
        if self.hinh_thuc_tt == "TM":
            self.tk_no = "111"
        return self


class CashReceiptResponse(BaseModel):
    id: int
    so_phieu: str
    ngay_phieu: date
    customer_id: int
    sales_invoice_id: int | None
    hinh_thuc_tt: str
    so_tai_khoan: str | None
    so_tham_chieu: str | None
    dien_giai: str | None
    so_tien: Decimal
    tk_no: str
    tk_co: str
    trang_thai: str
    nguoi_duyet_id: int | None
    ngay_duyet: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Phiếu chi
# ──────────────────────────────────────────────

class CashPaymentCreate(BaseModel):
    supplier_id: int
    purchase_invoice_id: int | None = None
    ngay_phieu: date
    hinh_thuc_tt: str = "CK"
    so_tai_khoan: str | None = None
    so_tham_chieu: str | None = None
    dien_giai: str | None = None
    so_tien: Decimal
    tk_no: str = "331"
    tk_co: str = "112"

    @field_validator("so_tien")
    @classmethod
    def tien_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số tiền phải lớn hơn 0")
        return v

    @model_validator(mode="after")
    def tk_co_theo_httt(self) -> "CashPaymentCreate":
        if self.hinh_thuc_tt == "TM":
            self.tk_co = "111"
        return self


class CashPaymentResponse(BaseModel):
    id: int
    so_phieu: str
    ngay_phieu: date
    supplier_id: int
    purchase_invoice_id: int | None
    hinh_thuc_tt: str
    so_tai_khoan: str | None
    so_tham_chieu: str | None
    dien_giai: str | None
    so_tien: Decimal
    tk_no: str
    tk_co: str
    trang_thai: str
    nguoi_duyet_id: int | None
    ngay_duyet: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Báo cáo công nợ
# ──────────────────────────────────────────────

class ARLedgerRow(BaseModel):
    """Một dòng trong sổ công nợ phải thu"""
    invoice_id: int
    so_hoa_don: str | None
    ngay_hoa_don: date
    han_tt: date | None
    customer_id: int
    ten_don_vi: str | None
    tong_cong: Decimal
    da_thanh_toan: Decimal
    con_lai: Decimal
    so_ngay_qua_han: int          # số ngày quá hạn (0 nếu chưa quá)
    trang_thai: str

    model_config = {"from_attributes": True}


class ARAgingRow(BaseModel):
    """Một dòng tuổi nợ theo khách hàng"""
    customer_id: int
    ten_don_vi: str | None
    tong_con_lai: Decimal
    trong_han: Decimal      # 0-30 ngày
    qua_han_30: Decimal     # 31-60 ngày
    qua_han_60: Decimal     # 61-90 ngày
    qua_han_90: Decimal     # >90 ngày


class APLedgerRow(BaseModel):
    """Một dòng trong sổ công nợ phải trả"""
    invoice_id: int
    so_hoa_don: str | None
    ngay_lap: date
    han_tt: date | None
    supplier_id: int
    ten_don_vi: str | None
    tong_thanh_toan: Decimal
    da_thanh_toan: Decimal
    con_lai: Decimal
    so_ngay_qua_han: int
    trang_thai: str

    model_config = {"from_attributes": True}


class APAgingRow(BaseModel):
    """Một dòng tuổi nợ theo nhà cung cấp"""
    supplier_id: int
    ten_don_vi: str | None
    tong_con_lai: Decimal
    trong_han: Decimal
    qua_han_30: Decimal
    qua_han_60: Decimal
    qua_han_90: Decimal


class BalanceByPeriod(BaseModel):
    """Số dư công nợ theo kỳ (AMIS-style)"""
    so_du_dau_ky: Decimal
    phat_sinh_tang: Decimal    # phát sinh tăng nợ (HĐ mới)
    phat_sinh_giam: Decimal    # phát sinh giảm nợ (đã thu/chi)
    so_du_cuoi_ky: Decimal


class OpeningBalanceCreate(BaseModel):
    ky_mo_so: date
    doi_tuong: str             # khach_hang | nha_cung_cap
    customer_id: int | None = None
    supplier_id: int | None = None
    so_du_dau_ky: Decimal
    ghi_chu: str | None = None
