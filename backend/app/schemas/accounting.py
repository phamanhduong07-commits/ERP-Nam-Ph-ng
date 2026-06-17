from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator


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
    co_vat: bool = True
    thue_suat: Decimal = Decimal("8")
    tong_tien_hang: Decimal
    tien_thue: Decimal | None = None      # nếu None → tự tính
    tong_thanh_toan: Decimal | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    @field_validator("thue_suat")
    @classmethod
    def thue_suat_hop_le(cls, v: Decimal) -> Decimal:
        if Decimal(str(v)) not in {Decimal("0"), Decimal("5"), Decimal("8"), Decimal("10")}:
            raise ValueError("VAT chi duoc chon 0%, 5%, 8% hoac 10%")
        return v

    @field_validator("tong_tien_hang")
    @classmethod
    def tien_hang_duong(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Tổng tiền hàng không được âm")
        return v

    @model_validator(mode="after")
    def tinh_thue_va_tong(self) -> "PurchaseInvoiceCreate":
        if not self.co_vat:
            self.thue_suat = Decimal("0")
            self.tien_thue = Decimal("0")
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
    trang_thai: Literal[
        "nhap", "da_tt_mot_phan", "da_tt_du", "qua_han", "huy"
    ] = "nhap"
    po_id: int | None
    gr_id: int | None

    model_config = {"from_attributes": True}


class PurchaseInvoiceResponse(PurchaseInvoiceListItem):
    mau_so: str | None
    ky_hieu: str | None
    ngay_hoa_don: date | None
    ma_so_thue: str | None
    co_vat: bool
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
    hinh_thuc_tt: Literal[
        "tien_mat", "chuyen_khoan", "TM", "CK", "bu_tru_cong_no", "khac"
    ] = "chuyen_khoan"
    so_tai_khoan: str | None = Field(None, max_length=500)
    so_tham_chieu: str | None = Field(None, max_length=500)
    dien_giai: str | None = Field(None, max_length=500)
    so_tien: Decimal
    tk_no: str = "112"
    tk_co: str = "131"
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    @field_validator("dien_giai", "so_tham_chieu", mode="before")
    @classmethod
    def strip_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

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
    ten_don_vi: str | None = None
    sales_invoice_id: int | None
    hinh_thuc_tt: str
    so_tai_khoan: str | None
    so_tham_chieu: str | None
    dien_giai: str | None
    so_tien: Decimal
    tk_no: str
    tk_co: str
    trang_thai: Literal["cho_duyet", "da_duyet", "huy"] = "cho_duyet"
    nguoi_duyet_id: int | None
    ngay_duyet: datetime | None
    created_at: datetime
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    ten_phap_nhan: str | None = None
    ten_phan_xuong: str | None = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Phiếu chi
# ──────────────────────────────────────────────

class CashPaymentCreate(BaseModel):
    supplier_id: int | None = None
    purchase_invoice_id: int | None = None
    ngay_phieu: date
    hinh_thuc_tt: Literal[
        "tien_mat", "chuyen_khoan", "TM", "CK", "bu_tru_cong_no", "khac"
    ] = "chuyen_khoan"
    so_tai_khoan: str | None = Field(None, max_length=500)
    so_tham_chieu: str | None = Field(None, max_length=500)
    dien_giai: str | None = Field(None, max_length=500)
    so_tien: Decimal
    tk_no: str = "331"
    tk_co: str = "112"
    loai_chi: str | None = None  # nop_thue | nop_bh | tra_luong | null=ttt_ncc
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    @field_validator("dien_giai", "so_tham_chieu", mode="before")
    @classmethod
    def strip_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

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
    supplier_id: int | None = None
    ten_don_vi: str | None = None
    purchase_invoice_id: int | None
    hinh_thuc_tt: str
    so_tai_khoan: str | None
    so_tham_chieu: str | None
    dien_giai: str | None
    so_tien: Decimal
    tk_no: str
    tk_co: str
    trang_thai: Literal["cho_chot", "da_chot", "da_duyet", "huy"] = "cho_chot"
    nguoi_duyet_id: int | None
    ngay_duyet: datetime | None
    created_at: datetime
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    ten_phap_nhan: str | None = None
    ten_phan_xuong: str | None = None

    model_config = {"from_attributes": True}


class TaxObligationItem(BaseModel):
    loai_thue: str            # gtgt_dau_ra | tndn | tncn | khac
    ten_khoan: str
    tk_no: str                # 3331 | 3334 | 3335 | 3338
    so_phai_nop: Decimal      # tính từ hệ thống
    so_nop_lan_nay: Decimal = Decimal("0")


class TaxPaymentItem(BaseModel):
    loai_thue: str
    ten_khoan: str
    tk_no: str
    tk_co: str = "112"
    so_tien: Decimal
    dien_giai: str | None = None


class TaxPaymentCreate(BaseModel):
    ngay_phieu: date
    hinh_thuc_tt: Literal["tien_mat", "chuyen_khoan", "TM", "CK"] = "chuyen_khoan"
    so_tai_khoan: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    items: list[TaxPaymentItem]


class TaxPaymentBatchResponse(BaseModel):
    tong_so: int
    thanh_cong: int
    that_bai: int
    tong_tien: Decimal
    phieu_chi_ids: list[int]


# ──────────────────────────────────────────────
# Nộp bảo hiểm
# ──────────────────────────────────────────────

class InsuranceObligationItem(BaseModel):
    loai_bh: str            # bhxh | bhyt | bhtn | cong_doan_phi
    ten_khoan: str
    tk_no: str              # 3383 | 3384 | 3385 | 3382
    so_phai_nop: Decimal
    so_nop_lan_nay: Decimal = Decimal("0")


class InsurancePaymentItem(BaseModel):
    loai_bh: str
    ten_khoan: str
    tk_no: str
    tk_co: str = "112"
    so_tien: Decimal
    dien_giai: str | None = None


class InsurancePaymentCreate(BaseModel):
    ngay_phieu: date
    thang: int
    nam: int
    hinh_thuc_tt: Literal["tien_mat", "chuyen_khoan", "TM", "CK"] = "chuyen_khoan"
    so_tai_khoan: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    items: list[InsurancePaymentItem]


class InsuranceBatchResponse(BaseModel):
    tong_so: int
    thanh_cong: int
    that_bai: int
    tong_tien: Decimal
    phieu_chi_ids: list[int]


# ──────────────────────────────────────────────
# Trả lương
# ──────────────────────────────────────────────

class SalaryObligationItem(BaseModel):
    payroll_run_id: int
    employee_id: int
    ma_nv: str
    ho_ten: str
    don_vi: str | None          # tên bộ phận
    so_tai_khoan: str | None
    ten_ngan_hang: str | None
    so_phai_tra: Decimal        # thuc_linh
    so_tra: Decimal             # mặc định = so_phai_tra


class SalaryPaymentItem(BaseModel):
    payroll_run_id: int
    employee_id: int
    ho_ten: str
    so_tien: Decimal
    tk_no: str = "334"
    tk_co: str = "112"
    dien_giai: str | None = None


class SalaryPaymentCreate(BaseModel):
    ngay_phieu: date
    thang: int
    nam: int
    hinh_thuc_tt: Literal["tien_mat", "chuyen_khoan", "TM", "CK"] = "chuyen_khoan"
    so_tai_khoan: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    items: list[SalaryPaymentItem]


class SalaryBatchResponse(BaseModel):
    tong_so: int
    thanh_cong: int
    that_bai: int
    tong_tien: Decimal
    phieu_chi_ids: list[int]


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
    phap_nhan_id: int | None = None

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
    phap_nhan_id: int | None = None

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
    doi_tuong: Literal["khach_hang", "nha_cung_cap", "quy_tien_mat"]
    customer_id: int | None = None
    supplier_id: int | None = None
    so_du_dau_ky: Decimal
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None

    @model_validator(mode="after")
    def validate_doi_tuong_consistency(self) -> "OpeningBalanceCreate":
        if self.doi_tuong == "khach_hang" and not self.customer_id:
            raise ValueError("Phải cung cấp customer_id khi doi_tuong là 'khach_hang'")
        if self.doi_tuong == "nha_cung_cap" and not self.supplier_id:
            raise ValueError("Phải cung cấp supplier_id khi doi_tuong là 'nha_cung_cap'")
        return self


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
    phap_nhan_id: int | None = None
    chu_tai_khoan: str | None = None
    chi_nhanh: str | None = None
    swift_code: str | None = None
    so_du_dau: Decimal = Decimal("0")
    ghi_chu: str | None = None


class BankAccountUpdate(BaseModel):
    ten_ngan_hang: str | None = None
    so_tai_khoan: str | None = None
    phap_nhan_id: int | None = None
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
    phap_nhan_id: int | None = None
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

    @field_validator("tong_luong", "tong_thuong", "tong_bao_hiem", mode="before")
    @classmethod
    def amounts_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("Giá trị không được âm")
        return v


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
    ty_le: Decimal  # 0.4 = 40%


class OverheadAllocationRequest(BaseModel):
    tu_ngay: date
    den_ngay: date
    so_tk: str
    phap_nhan_id: int
    allocations: list[AllocationItem]


class OverheadAllocationResponse(BaseModel):
    status: str
    total_allocated: Decimal | None = None
    journal_id: int | None = None
    so_but_toan: str | None = None
    message: str | None = None

    model_config = {"from_attributes": True}


class ClosingResult(BaseModel):
    status: str
    entry_id: int | None = None
    so_but_toan: str | None = None
    period_lock_id: int | None = None
    period_lock_status: str | None = None
    doanh_thu: float | None = None
    chi_phi: float | None = None
    lai_lo: float | None = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Bút toán thủ công (journal entry)
# ──────────────────────────────────────────────

class ProductionCostPeriodCreate(BaseModel):
    ma_ky: str | None = None
    ten_ky: str | None = None
    tu_ngay: date
    den_ngay: date
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    tieu_thuc_pb: str = "san_luong"
    ghi_chu: str | None = None

    @model_validator(mode="after")
    def check_period(self) -> "ProductionCostPeriodCreate":
        if self.den_ngay < self.tu_ngay:
            raise ValueError("den_ngay phai lon hon hoac bang tu_ngay")
        if self.tieu_thuc_pb not in {"san_luong"}:
            raise ValueError("Hien chi ho tro tieu thuc phan bo san_luong")
        return self


class ManualJournalLineIn(BaseModel):
    so_tk: str
    so_tien_no: Decimal = Decimal("0")
    so_tien_co: Decimal = Decimal("0")
    dien_giai: str | None = None
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    @model_validator(mode="after")
    def check_one_side(self) -> "ManualJournalLineIn":
        if self.so_tien_no < 0 or self.so_tien_co < 0:
            raise ValueError("Số tiền không được âm")
        if self.so_tien_no == 0 and self.so_tien_co == 0:
            raise ValueError("Mỗi dòng phải có ít nhất một bên Nợ hoặc Có")
        return self


class ManualJournalEntryCreate(BaseModel):
    ngay_but_toan: date
    dien_giai: str
    lines: list[ManualJournalLineIn]
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None

    @model_validator(mode="after")
    def check_balanced(self) -> "ManualJournalEntryCreate":
        if not self.lines:
            raise ValueError("Bút toán phải có ít nhất một dòng chi tiết")
        tong_no = sum(line.so_tien_no for line in self.lines)
        tong_co = sum(line.so_tien_co for line in self.lines)
        if tong_no != tong_co:
            raise ValueError(
                f"Bút toán không cân: Tổng Nợ={tong_no}, Tổng Có={tong_co}"
            )
        return self


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

    @field_validator("nguyen_gia")
    @classmethod
    def nguyen_gia_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Nguyên giá phải lớn hơn 0")
        return v

    @field_validator("so_thang_khau_hao")
    @classmethod
    def so_thang_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Số tháng khấu hao phải lớn hơn 0")
        return v


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


# ──────────────────────────────────────────────
# Lịch trả nợ
# ──────────────────────────────────────────────

class LichTraNoResponse(BaseModel):
    id: int
    loai_khe_uoc: str
    khe_uoc_id: int
    ky_so: int
    ngay_den_han: date
    so_tien_goc: Decimal
    so_tien_lai: Decimal
    tong_cong: Decimal
    trang_thai: str
    ngay_tra_thuc: date | None = None
    so_tien_tra_thuc: Decimal | None = None

    model_config = {"from_attributes": True}


class TraNoRequest(BaseModel):
    ky_so: int
    ngay_tra_thuc: date
    so_tien_tra_thuc: Decimal


class CapNhatLaiSuatRequest(BaseModel):
    lai_suat: Decimal = Field(..., gt=0, lt=100)


class TraTruocHanRequest(BaseModel):
    ngay_tra_thuc: date
    loai_tien: str = "VND"
    hinh_thuc: str = "chuyen_khoan"
    tra_goc: Decimal = Decimal("0")
    tra_lai: Decimal = Decimal("0")
    phi_khac: Decimal = Decimal("0")


class TatToanRequest(BaseModel):
    ngay_tat_toan: date
    loai_tien: str = "VND"
    tien_phat_tra_truoc: Decimal = Decimal("0")


# ──────────────────────────────────────────────
# Khế ước đi vay
# ──────────────────────────────────────────────

class KheUocVayCreate(BaseModel):
    ngay_ky: date
    ngay_hieu_luc: date
    ngay_ket_thuc: date
    to_chuc_cho_vay: str = Field(..., max_length=200)
    so_tien_vay: Decimal = Field(..., gt=0)
    lai_suat: Decimal = Field(..., gt=0)
    ky_tinh_lai: Literal["thang", "quy", "nam"] = "thang"
    phuong_thuc_tra: Literal["goc_deu", "gop_deu", "cuoi_ky"] = "gop_deu"
    tai_khoan_nhan: str | None = Field(None, max_length=20)
    tai_san_the_chap: str | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None
    # Thông tin giải ngân
    hop_dong_tin_dung: str | None = Field(None, max_length=50)
    tk_no_goc: str | None = Field(None, max_length=20)
    tk_lai_vay: str | None = Field(None, max_length=20)
    loai_tien: str = Field("VND", max_length=10)
    phuong_thuc_giai_ngan: str | None = Field(None, max_length=50)
    ten_ngan_hang_thu_huong: str | None = Field(None, max_length=200)
    # Lãi suất
    loai_lai_suat: str = Field("du_no_goc", max_length=20)
    co_so_tinh_lai: str = Field("365", max_length=5)
    phuong_thuc_dieu_chinh: str = Field("co_dinh", max_length=20)
    lai_suat_qua_han: Decimal = Field(Decimal("0"), ge=0)
    # Hình thức trả nợ
    ngay_tra_lai_dau_tien: date | None = None
    phuong_thuc_tra_no: str | None = Field(None, max_length=20)
    tai_khoan_chuyen_vao: str | None = Field(None, max_length=20)
    ten_ngan_hang_tra: str | None = Field(None, max_length=200)

    @model_validator(mode="after")
    def check_dates(self) -> "KheUocVayCreate":
        if self.ngay_ket_thuc <= self.ngay_hieu_luc:
            raise ValueError("ngay_ket_thuc phải sau ngay_hieu_luc")
        return self


class KheUocVayUpdate(BaseModel):
    to_chuc_cho_vay: str | None = Field(None, max_length=200)
    tai_san_the_chap: str | None = None
    ghi_chu: str | None = None
    tai_khoan_nhan: str | None = Field(None, max_length=20)
    lai_suat: Decimal | None = Field(None, gt=0, lt=100)
    ky_tinh_lai: Literal["thang", "quy", "nam"] | None = None
    phuong_thuc_tra: Literal["goc_deu", "gop_deu", "cuoi_ky"] | None = None
    # Thông tin giải ngân
    hop_dong_tin_dung: str | None = Field(None, max_length=50)
    tk_no_goc: str | None = Field(None, max_length=20)
    tk_lai_vay: str | None = Field(None, max_length=20)
    loai_tien: str | None = Field(None, max_length=10)
    phuong_thuc_giai_ngan: str | None = Field(None, max_length=50)
    ten_ngan_hang_thu_huong: str | None = Field(None, max_length=200)
    # Lãi suất
    loai_lai_suat: str | None = Field(None, max_length=20)
    co_so_tinh_lai: str | None = Field(None, max_length=5)
    phuong_thuc_dieu_chinh: str | None = Field(None, max_length=20)
    lai_suat_qua_han: Decimal | None = Field(None, ge=0)
    # Hình thức trả nợ
    ngay_tra_lai_dau_tien: date | None = None
    phuong_thuc_tra_no: str | None = Field(None, max_length=20)
    tai_khoan_chuyen_vao: str | None = Field(None, max_length=20)
    ten_ngan_hang_tra: str | None = Field(None, max_length=200)


class KheUocVayResponse(BaseModel):
    id: int
    so_khe_uoc: str
    ngay_ky: date
    ngay_hieu_luc: date
    ngay_ket_thuc: date
    to_chuc_cho_vay: str
    so_tien_vay: Decimal
    lai_suat: Decimal
    ky_tinh_lai: str
    phuong_thuc_tra: str
    tai_khoan_nhan: str | None
    tai_san_the_chap: str | None
    ghi_chu: str | None
    trang_thai: str
    phap_nhan_id: int | None
    created_at: datetime
    # Thông tin giải ngân
    hop_dong_tin_dung: str | None
    tk_no_goc: str | None
    tk_lai_vay: str | None
    loai_tien: str
    phuong_thuc_giai_ngan: str | None
    ten_ngan_hang_thu_huong: str | None
    # Lãi suất
    loai_lai_suat: str
    co_so_tinh_lai: str
    phuong_thuc_dieu_chinh: str
    lai_suat_qua_han: Decimal
    # Hình thức trả nợ
    ngay_tra_lai_dau_tien: date | None
    phuong_thuc_tra_no: str | None
    tai_khoan_chuyen_vao: str | None
    ten_ngan_hang_tra: str | None
    lich_tra: list[LichTraNoResponse] = []

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Khế ước cho vay
# ──────────────────────────────────────────────

class KheUocChoVayCreate(BaseModel):
    ngay_ky: date
    ngay_hieu_luc: date
    ngay_ket_thuc: date
    to_chuc_di_vay: str = Field(..., max_length=200)
    customer_id: int | None = None
    so_tien_cho_vay: Decimal = Field(..., gt=0)
    lai_suat: Decimal = Field(..., gt=0)
    ky_tinh_lai: Literal["thang", "quy", "nam"] = "thang"
    phuong_thuc_tra: Literal["goc_deu", "gop_deu", "cuoi_ky"] = "gop_deu"
    tai_san_the_chap: str | None = None
    ghi_chu: str | None = None
    phap_nhan_id: int | None = None

    @model_validator(mode="after")
    def check_dates(self) -> "KheUocChoVayCreate":
        if self.ngay_ket_thuc <= self.ngay_hieu_luc:
            raise ValueError("ngay_ket_thuc phải sau ngay_hieu_luc")
        return self


class KheUocChoVayUpdate(BaseModel):
    to_chuc_di_vay: str | None = Field(None, max_length=200)
    tai_san_the_chap: str | None = None
    ghi_chu: str | None = None


class KheUocChoVayResponse(BaseModel):
    id: int
    so_khe_uoc: str
    ngay_ky: date
    ngay_hieu_luc: date
    ngay_ket_thuc: date
    to_chuc_di_vay: str
    customer_id: int | None
    so_tien_cho_vay: Decimal
    lai_suat: Decimal
    ky_tinh_lai: str
    phuong_thuc_tra: str
    tai_san_the_chap: str | None
    ghi_chu: str | None
    trang_thai: str
    phap_nhan_id: int | None
    created_at: datetime
    lich_tra: list[LichTraNoResponse] = []

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Dự báo dòng tiền
# ──────────────────────────────────────────────

class ForecastDayItem(BaseModel):
    ngay: date
    thu: Decimal = Decimal("0")
    chi: Decimal = Decimal("0")
    tra_no: Decimal = Decimal("0")
    thu_no: Decimal = Decimal("0")
    net: Decimal = Decimal("0")
    luy_ke: Decimal = Decimal("0")


class CashFlowForecastResponse(BaseModel):
    days: int
    phap_nhan_id: int | None
    items: list[ForecastDayItem]
    tong_thu: Decimal
    tong_chi: Decimal
    tong_tra_no: Decimal
    tong_thu_no: Decimal


# ──────────────────────────────────────────────
# Chuyển tiền nội bộ (Internal Transfer)
# ──────────────────────────────────────────────

class InternalTransferCreate(BaseModel):
    ngay_phieu: date
    tu_phap_nhan_id: int | None = None
    den_phap_nhan_id: int | None = None
    tu_tai_khoan: str | None = Field(None, max_length=200)
    den_tai_khoan: str | None = Field(None, max_length=200)
    so_tien: Decimal
    hinh_thuc_tt: Literal[
        "tien_mat", "chuyen_khoan", "TM", "CK", "khac"
    ] = "chuyen_khoan"
    so_tham_chieu: str | None = Field(None, max_length=200)
    dien_giai: str | None = Field(None, max_length=500)
    tk_no: str = "112"
    tk_co: str = "112"

    @field_validator("so_tien")
    @classmethod
    def tien_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số tiền phải lớn hơn 0")
        return v

    @model_validator(mode="after")
    def validate_phap_nhan(self) -> "InternalTransferCreate":
        if self.tu_phap_nhan_id and self.den_phap_nhan_id:
            if self.tu_phap_nhan_id == self.den_phap_nhan_id:
                raise ValueError("Pháp nhân nguồn và đích không được trùng nhau")
        return self


class InternalTransferResponse(BaseModel):
    id: int
    so_phieu: str
    ngay_phieu: date
    tu_phap_nhan_id: int | None
    den_phap_nhan_id: int | None
    tu_phap_nhan_ten: str | None = None
    den_phap_nhan_ten: str | None = None
    tu_tai_khoan: str | None
    den_tai_khoan: str | None
    so_tien: Decimal
    hinh_thuc_tt: str
    so_tham_chieu: str | None
    dien_giai: str | None
    trang_thai: str
    tk_no: str
    tk_co: str
    nguoi_duyet_id: int | None
    ngay_duyet: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Batch receipt (Thu tiền nhiều khách hàng)
# ──────────────────────────────────────────────

class BatchReceiptItem(BaseModel):
    customer_id: int
    sales_invoice_id: int | None = None
    so_tien: Decimal
    hinh_thuc_tt: Literal[
        "tien_mat", "chuyen_khoan", "TM", "CK", "bu_tru_cong_no", "khac"
    ] = "chuyen_khoan"
    dien_giai: str | None = None
    so_tham_chieu: str | None = None

    @field_validator("so_tien")
    @classmethod
    def tien_duong(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Số tiền phải lớn hơn 0")
        return v


class BatchReceiptCreate(BaseModel):
    ngay_phieu: date
    phap_nhan_id: int | None = None
    phan_xuong_id: int | None = None
    so_tai_khoan: str | None = None
    items: list[BatchReceiptItem]

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("Danh sách cần ít nhất 1 phiếu thu")
        return v


class BatchReceiptResultItem(BaseModel):
    index: int
    customer_id: int
    so_phieu: str | None
    so_tien: Decimal
    success: bool
    error: str | None = None

    model_config = {"from_attributes": False}


class BatchReceiptResponse(BaseModel):
    tong_so: int
    thanh_cong: int
    that_bai: int
    items: list[BatchReceiptResultItem]
