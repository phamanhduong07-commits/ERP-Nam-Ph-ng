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
    thue_suat: Decimal = Decimal("8")
    tong_tien_hang: Decimal
    tien_thue: Decimal | None = None      # nếu None → tự tính
    tong_thanh_toan: Decimal | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

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
    phap_nhan_id: int | None
    phan_xuong_id: int | None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Phiếu thu
# ──────────────────────────────────────────────

class CashReceiptCreate(BaseModel):
    customer_id: int
    sales_invoice_id: int | None = None
    ngay_phieu: date
    hinh_thuc_tt: str = "chuyen_khoan"
    so_tai_khoan: str | None = None
    so_tham_chieu: str | None = None
    dien_giai: str | None = None
    so_tien: Decimal
    tk_no: str = "112"
    tk_co: str = "131"
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    @field_validator("so_tien")
    @classmethod
    def tien_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số tiền phải lớn hơn 0")
        return v

    @model_validator(mode="after")
    def tk_no_theo_httt(self) -> "CashReceiptCreate":
        if self.hinh_thuc_tt in {"tien_mat", "TM"}:
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
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Phiếu chi
# ──────────────────────────────────────────────

class CashPaymentCreate(BaseModel):
    supplier_id: int
    purchase_invoice_id: int | None = None
    ngay_phieu: date
    hinh_thuc_tt: str = "chuyen_khoan"
    so_tai_khoan: str | None = None
    so_tham_chieu: str | None = None
    dien_giai: str | None = None
    so_tien: Decimal
    tk_no: str = "331"
    tk_co: str = "112"
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    @field_validator("so_tien")
    @classmethod
    def tien_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số tiền phải lớn hơn 0")
        return v

    @model_validator(mode="after")
    def tk_co_theo_httt(self) -> "CashPaymentCreate":
        if self.hinh_thuc_tt in {"tien_mat", "TM"}:
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
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

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


# ──────────────────────────────────────────────
# Sổ quỹ tiền mặt / Sổ ngân hàng
# ──────────────────────────────────────────────

class CashBookEntry(BaseModel):
    ngay: date
    so_chung_tu: str
    loai: str                  # thu | chi
    doi_tuong: str | None      # tên KH / NCC
    dien_giai: str | None
    thu: Decimal
    chi: Decimal
    so_du: Decimal


class CashBookResponse(BaseModel):
    so_du_dau: Decimal
    tong_thu: Decimal
    tong_chi: Decimal
    so_du_cuoi: Decimal
    entries: list[CashBookEntry]


# ──────────────────────────────────────────────
# Tài khoản ngân hàng (danh mục)
# ──────────────────────────────────────────────

class BankAccountCreate(BaseModel):
    ma_tk: str
    ten_ngan_hang: str
    so_tai_khoan: str
    chu_tai_khoan: str | None = None
    chi_nhanh: str | None = None
    swift_code: str | None = None
    so_du_dau: Decimal = Decimal("0")
    ghi_chu: str | None = None


class BankAccountUpdate(BaseModel):
    ten_ngan_hang: str | None = None
    so_tai_khoan: str | None = None
    chu_tai_khoan: str | None = None
    chi_nhanh: str | None = None
    swift_code: str | None = None
    so_du_dau: Decimal | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None


class BankAccountResponse(BaseModel):
    id: int
    ma_tk: str
    ten_ngan_hang: str
    so_tai_khoan: str
    chu_tai_khoan: str | None
    chi_nhanh: str | None
    swift_code: str | None
    so_du_dau: Decimal
    ghi_chu: str | None
    trang_thai: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# CCDC — Công cụ dụng cụ
# ──────────────────────────────────────────────

class NhomCCDCCreate(BaseModel):
    ma_nhom: str
    ten_nhom: str
    ghi_chu: str | None = None


class NhomCCDCResponse(BaseModel):
    id: int
    ma_nhom: str
    ten_nhom: str
    ghi_chu: str | None
    trang_thai: bool

    model_config = {"from_attributes": True}


class CCDCCreate(BaseModel):
    ma_ccdc: str
    ten_ccdc: str
    nhom_id: int | None = None
    don_vi_tinh: str | None = None
    so_luong: Decimal = Decimal("1")
    nguyen_gia: Decimal = Decimal("0")
    gia_tri_con_lai: Decimal | None = None   # None → tự set = nguyen_gia
    ngay_mua: date | None = None
    thoi_gian_phan_bo: int = 0
    bo_phan_su_dung: str | None = None
    trang_thai: str = "dang_su_dung"
    ghi_chu: str | None = None


class CCDCUpdate(BaseModel):
    ten_ccdc: str | None = None
    nhom_id: int | None = None
    don_vi_tinh: str | None = None
    so_luong: Decimal | None = None
    nguyen_gia: Decimal | None = None
    gia_tri_con_lai: Decimal | None = None
    ngay_mua: date | None = None
    thoi_gian_phan_bo: int | None = None
    bo_phan_su_dung: str | None = None
    trang_thai: str | None = None
    ghi_chu: str | None = None


class CCDCResponse(BaseModel):
    id: int
    ma_ccdc: str
    ten_ccdc: str
    nhom_id: int | None
    ten_nhom: str | None = None
    don_vi_tinh: str | None
    so_luong: Decimal
    nguyen_gia: Decimal
    gia_tri_con_lai: Decimal
    ngay_mua: date | None
    thoi_gian_phan_bo: int
    so_thang_da_phan_bo: int
    bo_phan_su_dung: str | None
    trang_thai: str
    ghi_chu: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PhieuXuatCCDCItemCreate(BaseModel):
    ccdc_id: int
    so_luong: Decimal
    ghi_chu: str | None = None


class PhieuXuatCCDCCreate(BaseModel):
    ngay_xuat: date
    nguoi_nhan: str | None = None
    bo_phan: str | None = None
    ly_do: str | None = None
    items: list[PhieuXuatCCDCItemCreate]


class PhieuXuatCCDCItemResponse(BaseModel):
    id: int
    ccdc_id: int
    ten_ccdc: str | None = None
    so_luong: Decimal
    ghi_chu: str | None

    model_config = {"from_attributes": True}


class PhieuXuatCCDCResponse(BaseModel):
    id: int
    so_phieu: str
    ngay_xuat: date
    nguoi_nhan: str | None
    bo_phan: str | None
    ly_do: str | None
    trang_thai: str
    items: list[PhieuXuatCCDCItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Phiếu hoàn tiền khách hàng
# ──────────────────────────────────────────────

class CustomerRefundVoucherUpdate(BaseModel):
    hinh_thuc: str | None = None        # "bu_tru" | "hoan_tien"
    tk_hoan_tien: str | None = None     # "111" | "112"
    dien_giai: str | None = None


class CustomerRefundVoucherResponse(BaseModel):
    id: int
    so_phieu: str
    ngay: date
    customer_id: int
    ten_khach_hang: str | None = None
    sales_return_id: int
    so_phieu_tra: str | None = None
    sales_invoice_id: int | None
    so_tien: Decimal
    hinh_thuc: str | None
    tk_hoan_tien: str | None
    dien_giai: str | None
    trang_thai: str
    nguoi_duyet_id: int | None
    ngay_duyet: datetime | None
    created_by: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Bảng lương xưởng
# ──────────────────────────────────────────────

class WorkshopPayrollCreate(BaseModel):
    thang: date
    phan_xuong_id: int
    phap_nhan_id: int | None = None
    tong_luong: Decimal
    tong_thuong: Decimal = Decimal("0")
    tong_bao_hiem: Decimal = Decimal("0")
    ghi_chu: str | None = None

class WorkshopPayrollResponse(BaseModel):
    id: int
    so_phieu: str
    thang: date
    phan_xuong_id: int
    phap_nhan_id: int | None
    tong_luong: Decimal
    tong_thuong: Decimal
    tong_bao_hiem: Decimal
    ghi_chu: str | None
    trang_thai: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Phân bổ chi phí
# ──────────────────────────────────────────────

class AllocationItem(BaseModel):
    phan_xuong_id: int
    ty_le: Decimal # 0.4 = 40%

class OverheadAllocationRequest(BaseModel):
    tu_ngay: date
    den_ngay: date
    so_tk: str
    phap_nhan_id: int
    allocations: list[AllocationItem]


# ──────────────────────────────────────────────
# Tài sản cố định
# ──────────────────────────────────────────────

class FixedAssetCreate(BaseModel):
    ma_ts: str
    ten_ts: str
    ngay_mua: date
    nguyen_gia: Decimal
    so_thang_khau_hao: int
    phan_xuong_id: int | None = None
    phap_nhan_id: int | None = None
    tk_chi_phi: str = "154"

class FixedAssetResponse(BaseModel):
    id: int
    ma_ts: str
    ten_ts: str
    ngay_mua: date
    nguyen_gia: Decimal
    so_thang_khau_hao: int
    da_khau_hao_thang: int
    gia_tri_da_khau_hao: Decimal
    phan_xuong_id: int | None
    phap_nhan_id: int | None
    trang_thai: str

    model_config = {"from_attributes": True}
