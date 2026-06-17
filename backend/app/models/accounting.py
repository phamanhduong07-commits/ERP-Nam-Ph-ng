from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    Boolean, Computed, Date, DateTime, ForeignKey,
    Integer, JSON, Numeric, SmallInteger, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ChartOfAccounts(Base):
    """Hệ thống tài khoản kế toán (VAS)"""
    __tablename__ = "chart_of_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_tk: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_tk: Mapped[str] = mapped_column(String(255), nullable=False)
    loai_tk: Mapped[str] = mapped_column(String(20), nullable=False)
    cap: Mapped[int] = mapped_column(SmallInteger, default=1)
    so_tk_cha: Mapped[str | None] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"))
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)

    parent = relationship("ChartOfAccounts", remote_side="ChartOfAccounts.so_tk")


class JournalEntry(Base):
    """Bút toán kế toán"""
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_but_toan: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_but_toan: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    dien_giai: Mapped[str] = mapped_column(Text, nullable=False)
    loai_but_toan: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    tong_no: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_co: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chung_tu_loai: Mapped[str | None] = mapped_column(String(50), index=True)
    chung_tu_id: Mapped[int | None] = mapped_column(Integer)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")

    lines: Mapped[list["JournalEntryLine"]] = relationship(
        "JournalEntryLine", back_populates="entry", cascade="all, delete-orphan"
    )


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("journal_entries.id"), nullable=False, index=True)
    so_tk: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), nullable=False)
    dien_giai: Mapped[str | None] = mapped_column(Text)
    so_tien_no: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    so_tien_co: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)

    # Chi tiết theo phân xưởng và pháp nhân tại từng dòng
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)

    entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccounts", foreign_keys=[so_tk])


class PurchaseInvoice(Base):
    """Hóa đơn mua hàng (từ NCC)"""
    __tablename__ = "purchase_invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_hoa_don: Mapped[str | None] = mapped_column(String(50))        # số HĐ của NCC
    mau_so: Mapped[str | None] = mapped_column(String(50))
    ky_hieu: Mapped[str | None] = mapped_column(String(50))
    ngay_lap: Mapped[date] = mapped_column(Date, nullable=False, index=True)       # ngày nhận/nhập hệ thống
    ngay_hoa_don: Mapped[date | None] = mapped_column(Date)           # ngày ghi trên HĐ
    han_tt: Mapped[date | None] = mapped_column(Date)
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    po_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_orders.id"))
    gr_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("goods_receipts.id"))
    # Snapshot NCC
    ten_don_vi: Mapped[str | None] = mapped_column(String(500))
    ma_so_thue: Mapped[str | None] = mapped_column(String(50))
    # Tài chính
    thue_suat: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=10)
    tong_tien_hang: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    tien_thue: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    tong_thanh_toan: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    da_thanh_toan: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    con_lai: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        Computed("tong_thanh_toan - da_thanh_toan", persisted=True),
    )
    trang_thai: Mapped[str] = mapped_column(String(30), default="nhap", index=True)
    bo_qua_hach_toan: Mapped[bool] = mapped_column(Boolean, default=False)
    co_vat: Mapped[bool] = mapped_column(Boolean, default=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    # nhap | da_tt_mot_phan | da_tt_du | qua_han | huy
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    supplier = relationship("Supplier")
    po = relationship("PurchaseOrder")
    gr = relationship("GoodsReceipt")
    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")
    creator = relationship("User", foreign_keys=[created_by])
    payments: Mapped[list["CashPayment"]] = relationship(
        "CashPayment", back_populates="purchase_invoice"
    )


class CashReceipt(Base):
    """Phiếu thu tiền từ khách hàng"""
    __tablename__ = "cash_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # PT-YYYYMM-XXXX
    ngay_phieu: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    sales_invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_invoices.id"))
    hinh_thuc_tt: Mapped[str] = mapped_column(String(20), default="CK")
    so_tai_khoan: Mapped[str | None] = mapped_column(String(100))
    so_tham_chieu: Mapped[str | None] = mapped_column(String(100))
    dien_giai: Mapped[str | None] = mapped_column(Text)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    # Tài khoản kế toán VAS
    tk_no: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="112")
    tk_co: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="131")
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_duyet", index=True)
    # cho_duyet | da_duyet | huy
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer")
    invoice: Mapped["SalesInvoice | None"] = relationship("SalesInvoice", back_populates="receipts")
    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")
    creator = relationship("User", foreign_keys=[created_by])
    nguoi_duyet = relationship("User", foreign_keys=[nguoi_duyet_id])


class CashPayment(Base):
    """Phiếu chi thanh toán nhà cung cấp"""
    __tablename__ = "cash_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # PC-YYYYMM-XXXX
    ngay_phieu: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    supplier_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=True, index=True)
    purchase_invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_invoices.id"))
    hinh_thuc_tt: Mapped[str] = mapped_column(String(20), default="CK")
    so_tai_khoan: Mapped[str | None] = mapped_column(String(100))
    so_tham_chieu: Mapped[str | None] = mapped_column(String(100))
    dien_giai: Mapped[str | None] = mapped_column(Text)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    loai_chi: Mapped[str | None] = mapped_column(String(30))  # nop_thue | nop_bh | tra_luong | null=ttt_ncc
    # Tài khoản kế toán VAS
    tk_no: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="331")
    tk_co: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="112")
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_chot", index=True)
    # cho_chot | da_chot | da_duyet | huy
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier")
    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")
    purchase_invoice: Mapped["PurchaseInvoice | None"] = relationship(
        "PurchaseInvoice", back_populates="payments"
    )
    creator = relationship("User", foreign_keys=[created_by])
    nguoi_duyet = relationship("User", foreign_keys=[nguoi_duyet_id])


class DebtLedgerEntry(Base):
    """Bút toán công nợ — theo dõi phát sinh tăng/giảm nợ"""
    __tablename__ = "debt_ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    loai: Mapped[str] = mapped_column(String(10), nullable=False)
    # tang_no: phát sinh nợ (HĐ bán/mua) | giam_no: giảm nợ (phiếu thu/chi)
    doi_tuong: Mapped[str] = mapped_column(String(20), nullable=False)
    # khach_hang | nha_cung_cap
    customer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"), index=True)
    supplier_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"), index=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    chung_tu_loai: Mapped[str | None] = mapped_column(String(50))
    chung_tu_id: Mapped[int | None] = mapped_column(Integer)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer")
    supplier = relationship("Supplier")
    phap_nhan = relationship("PhapNhan", foreign_keys=[phap_nhan_id])


class CustomerRefundVoucher(Base):
    """Phiếu hoàn tiền khách hàng — phát sinh sau khi duyệt trả hàng bán"""
    __tablename__ = "customer_refund_vouchers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # HT-YYYYMM-XXXX
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    sales_return_id: Mapped[int] = mapped_column(Integer, ForeignKey("sales_returns.id"), unique=True, nullable=False)
    sales_invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_invoices.id"))
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    hinh_thuc: Mapped[str | None] = mapped_column(String(20))  # "bu_tru" | "hoan_tien"
    tk_hoan_tien: Mapped[str | None] = mapped_column(String(20))  # "111" | "112" — dùng khi hoan_tien
    dien_giai: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")  # nhap | da_duyet | huy
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer")
    sales_return = relationship("SalesReturn")
    phap_nhan = relationship("PhapNhan", foreign_keys=[phap_nhan_id])
    phan_xuong = relationship("PhanXuong", foreign_keys=[phan_xuong_id])
    nguoi_duyet = relationship("User", foreign_keys=[nguoi_duyet_id])
    creator = relationship("User", foreign_keys=[created_by])


class OpeningBalance(Base):
    """Số dư đầu kỳ — nhập từ AMIS khi chuyển đổi hệ thống"""
    __tablename__ = "opening_balances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ky_mo_so: Mapped[date] = mapped_column(Date, nullable=False)
    doi_tuong: Mapped[str] = mapped_column(String(20), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"))
    supplier_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"))
    so_du_dau_ky: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer")
    supplier = relationship("Supplier")
    phap_nhan = relationship("PhapNhan", foreign_keys=[phap_nhan_id])


class WorkshopPayroll(Base):
    """Bảng lương tổng hợp theo phân xưởng — dùng để hạch toán chi phí nhân công trực tiếp"""
    __tablename__ = "workshop_payroll"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # BL-YYYYMM-XX
    thang: Mapped[date] = mapped_column(Date, nullable=False)  # Ngày đầu tháng hoặc cuối tháng đại diện
    phan_xuong_id: Mapped[int] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=False, index=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)

    tong_luong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_thuong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_bao_hiem: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # CP BH công ty đóng

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")  # nhap | da_duyet | huy
    bo_qua_hach_toan: Mapped[bool] = mapped_column(Boolean, default=False)

    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    phan_xuong = relationship("PhanXuong")
    phap_nhan = relationship("PhapNhan")
    creator = relationship("User", foreign_keys=[created_by])
    nguoi_duyet_obj = relationship("User", foreign_keys=[nguoi_duyet_id])


class FixedAsset(Base):
    """Tài sản cố định — máy móc thiết bị xưởng"""
    __tablename__ = "fixed_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_ts: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten_ts: Mapped[str] = mapped_column(String(255), nullable=False)
    ngay_mua: Mapped[date] = mapped_column(Date, nullable=False)
    nguyen_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    so_thang_khau_hao: Mapped[int] = mapped_column(Integer, nullable=False)  # Tổng số tháng KH
    da_khau_hao_thang: Mapped[int] = mapped_column(Integer, default=0)  # Số tháng đã KH
    gia_tri_da_khau_hao: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)

    tk_nguyen_gia: Mapped[str] = mapped_column(String(20), default="211")
    tk_khau_hao: Mapped[str] = mapped_column(String(20), default="214")
    tk_chi_phi: Mapped[str] = mapped_column(String(20), default="154")

    trang_thai: Mapped[str] = mapped_column(String(20), default="dang_su_dung", index=True)  # dang_su_dung | da_kh_het | thanh_ly
    bo_qua_hach_toan: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    phan_xuong = relationship("PhanXuong")
    phap_nhan = relationship("PhapNhan")


class BankTransaction(Base):
    """Giao dich sao ke ngan hang dung cho doi soat phieu thu/chi."""
    __tablename__ = "bank_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bank_account_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("bank_accounts.id"), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    ngay_giao_dich: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    so_tai_khoan: Mapped[str | None] = mapped_column(String(100), nullable=True)
    so_tham_chieu: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mo_ta: Mapped[str | None] = mapped_column(Text, nullable=True)
    thu: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    chi: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    so_du: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="chua_doi_soat", index=True)
    matched_chung_tu_loai: Mapped[str | None] = mapped_column(String(30), nullable=True)
    matched_chung_tu_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    matched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    matched_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    import_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    bank_account = relationship("BankAccount")
    phap_nhan = relationship("PhapNhan")
    matcher = relationship("User", foreign_keys=[matched_by])


class ProductionCostPeriod(Base):
    """Ky tinh gia thanh theo phap nhan va phan xuong."""
    __tablename__ = "production_cost_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_ky: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_ky: Mapped[str] = mapped_column(String(255), nullable=False)
    tu_ngay: Mapped[date] = mapped_column(Date, nullable=False)
    den_ngay: Mapped[date] = mapped_column(Date, nullable=False)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True, index=True)
    tieu_thuc_pb: Mapped[str] = mapped_column(String(30), default="san_luong")
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap", index=True)
    tong_nvl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_nhan_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_sxc: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_chi_phi: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_san_luong: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    closed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")
    creator = relationship("User", foreign_keys=[created_by])
    closer = relationship("User", foreign_keys=[closed_by])
    inputs: Mapped[list["ProductionCostInput"]] = relationship(
        "ProductionCostInput", back_populates="period", cascade="all, delete-orphan"
    )
    allocations: Mapped[list["ProductionCostAllocation"]] = relationship(
        "ProductionCostAllocation", back_populates="period", cascade="all, delete-orphan"
    )
    product_costs: Mapped[list["ProductCost"]] = relationship(
        "ProductCost", back_populates="period", cascade="all, delete-orphan"
    )


class ProductionCostInput(Base):
    """Dong chi phi/san luong nguon duoc gom vao ky gia thanh."""
    __tablename__ = "production_cost_inputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_cost_periods.id"), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_table: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    production_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=True)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    so_luong: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=0)
    dien_giai: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    period = relationship("ProductionCostPeriod", back_populates="inputs")
    production_order = relationship("ProductionOrder")
    product = relationship("Product")
    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")


class ProductionCostAllocation(Base):
    """Ket qua phan bo chi phi cho tung lenh san xuat."""
    __tablename__ = "production_cost_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_cost_periods.id"), nullable=False)
    production_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    tieu_thuc: Mapped[str] = mapped_column(String(30), default="san_luong")
    ty_le: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=0)
    san_luong: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=0)
    chi_phi_nvl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_nhan_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_sxc: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_chi_phi: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    gia_thanh_don_vi: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    period = relationship("ProductionCostPeriod", back_populates="allocations")
    production_order = relationship("ProductionOrder")
    product = relationship("Product")
    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")


class ProductCost(Base):
    """Gia thanh thanh pham theo ky."""
    __tablename__ = "product_costs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_cost_periods.id"), nullable=False)
    production_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    ten_hang: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    san_luong: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=0)
    tong_chi_phi: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    gia_thanh_don_vi: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    period = relationship("ProductionCostPeriod", back_populates="product_costs")
    production_order = relationship("ProductionOrder")
    product = relationship("Product")
    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")


class AccountingPeriodLock(Base):
    """Accounting period lock by legal entity and month."""
    __tablename__ = "accounting_period_locks"
    __table_args__ = (
        UniqueConstraint("thang", "nam", "phap_nhan_id", name="uq_accounting_period_lock_period_entity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thang: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    nam: Mapped[int] = mapped_column(Integer, nullable=False)
    phap_nhan_id: Mapped[int] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=False, index=True)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="locked")
    closing_entry_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    locked_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    unlocked_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    locked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ly_do_khoa: Mapped[str | None] = mapped_column(Text, nullable=True)
    ly_do_mo_khoa: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    phap_nhan = relationship("PhapNhan")
    closing_entry = relationship("JournalEntry", foreign_keys=[closing_entry_id])
    locker = relationship("User", foreign_keys=[locked_by])
    unlocker = relationship("User", foreign_keys=[unlocked_by])


class HoaDonDienTu(Base):
    """Hóa đơn điện tử — tích hợp MISA meInvoice"""
    __tablename__ = "hoa_don_dien_tu"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_hoa_don: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Số HĐ từ MISA sau khi phát hành
    ky_hieu: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mau_so: Mapped[str | None] = mapped_column(String(20), nullable=True)

    ngay_lap: Mapped[date] = mapped_column(Date, nullable=False)
    loai_hd: Mapped[str] = mapped_column(String(5), default="1")  # 1=GTGT, 2=bán hàng, 7=xuất kho

    sales_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    sales_invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_invoices.id"), nullable=True)
    customer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"), nullable=True)

    ten_khach_hang: Mapped[str] = mapped_column(String(255), nullable=False)
    ma_so_thue_kh: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dia_chi_kh: Mapped[str | None] = mapped_column(Text, nullable=True)

    tong_tien_hang: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    tien_thue_gtgt: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    trang_thai: Mapped[str] = mapped_column(String(30), default="nhap")
    # nhap | cho_ky | da_phat_hanh | huy | can_dieu_chinh

    misa_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # UUID từ MISA
    ma_cqt: Mapped[str | None] = mapped_column(String(100), nullable=True)   # Mã CQT cấp
    xml_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ly_do_huy: Mapped[str | None] = mapped_column(Text, nullable=True)

    items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # [{ten_hang, ma_hang, don_vi, so_luong, don_gia, thanh_tien, thue_suat}]

    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sales_order = relationship("SalesOrder", foreign_keys=[sales_order_id])
    customer = relationship("Customer", foreign_keys=[customer_id])
    phap_nhan = relationship("PhapNhan")
    creator = relationship("User", foreign_keys=[created_by])


# ──────────────────────────────────────────────
# Khế ước đi vay
# ──────────────────────────────────────────────

class KheUocVay(Base):
    """Khế ước đi vay — công ty vay tiền từ tổ chức/ngân hàng"""
    __tablename__ = "khe_uoc_vay"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_khe_uoc: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    ngay_ky: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_hieu_luc: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_ket_thuc: Mapped[date] = mapped_column(Date, nullable=False)
    to_chuc_cho_vay: Mapped[str] = mapped_column(String(200), nullable=False)
    so_tien_vay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    lai_suat: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)  # %/năm
    ky_tinh_lai: Mapped[str] = mapped_column(String(10), nullable=False, default="thang")  # thang/quy/nam
    phuong_thuc_tra: Mapped[str] = mapped_column(String(20), nullable=False, default="gop_deu")  # goc_deu/gop_deu/cuoi_ky
    tai_khoan_nhan: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tai_san_the_chap: Mapped[str | None] = mapped_column(Text, nullable=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="hieu_luc", index=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    # ── Thông tin giải ngân ──────────────────────────────────────────────────
    hop_dong_tin_dung: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tk_no_goc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tk_lai_vay: Mapped[str | None] = mapped_column(String(20), nullable=True)
    loai_tien: Mapped[str] = mapped_column(String(10), nullable=False, default="VND")
    phuong_thuc_giai_ngan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ten_ngan_hang_thu_huong: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # ── Lãi suất ─────────────────────────────────────────────────────────────
    loai_lai_suat: Mapped[str] = mapped_column(String(20), nullable=False, default="du_no_goc")
    co_so_tinh_lai: Mapped[str] = mapped_column(String(5), nullable=False, default="365")
    phuong_thuc_dieu_chinh: Mapped[str] = mapped_column(String(20), nullable=False, default="co_dinh")
    lai_suat_qua_han: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    # ── Hình thức trả nợ ─────────────────────────────────────────────────────
    ngay_tra_lai_dau_tien: Mapped[date | None] = mapped_column(Date, nullable=True)
    phuong_thuc_tra_no: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tai_khoan_chuyen_vao: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ten_ngan_hang_tra: Mapped[str | None] = mapped_column(String(200), nullable=True)

    phap_nhan = relationship("PhapNhan")
    creator = relationship("User", foreign_keys=[created_by])


# ──────────────────────────────────────────────
# Khế ước cho vay
# ──────────────────────────────────────────────

class KheUocChoVay(Base):
    """Khế ước cho vay — công ty cho tổ chức/khách hàng vay tiền"""
    __tablename__ = "khe_uoc_cho_vay"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_khe_uoc: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    ngay_ky: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_hieu_luc: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_ket_thuc: Mapped[date] = mapped_column(Date, nullable=False)
    to_chuc_di_vay: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    so_tien_cho_vay: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    lai_suat: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)  # %/năm
    ky_tinh_lai: Mapped[str] = mapped_column(String(10), nullable=False, default="thang")
    phuong_thuc_tra: Mapped[str] = mapped_column(String(20), nullable=False, default="gop_deu")
    tai_san_the_chap: Mapped[str | None] = mapped_column(Text, nullable=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="hieu_luc", index=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer", foreign_keys=[customer_id])
    phap_nhan = relationship("PhapNhan")
    creator = relationship("User", foreign_keys=[created_by])


# ──────────────────────────────────────────────
# Lịch trả nợ (dùng chung cho đi vay & cho vay)
# ──────────────────────────────────────────────

class LichTraNo(Base):
    """Lịch trả nợ — kế hoạch thanh toán theo kỳ"""
    __tablename__ = "lich_tra_no"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    loai_khe_uoc: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # di_vay / cho_vay
    khe_uoc_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    ky_so: Mapped[int] = mapped_column(Integer, nullable=False)
    ngay_den_han: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    so_tien_goc: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    so_tien_lai: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    tong_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="chua_tra", index=True)  # chua_tra/da_tra/qua_han
    ngay_tra_thuc: Mapped[date | None] = mapped_column(Date, nullable=True)
    so_tien_tra_thuc: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class InternalTransfer(Base):
    """Chuyển tiền nội bộ giữa tài khoản/pháp nhân"""
    __tablename__ = "internal_transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # CTN-YYYYMM-XXXX
    ngay_phieu: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    tu_phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    den_phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True, index=True)
    tu_tai_khoan: Mapped[str | None] = mapped_column(String(100))
    den_tai_khoan: Mapped[str | None] = mapped_column(String(100))
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    hinh_thuc_tt: Mapped[str] = mapped_column(String(20), default="CK")
    so_tham_chieu: Mapped[str | None] = mapped_column(String(100))
    dien_giai: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_duyet", index=True)
    # cho_duyet | da_duyet | huy
    tk_no: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="112")
    tk_co: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="112")
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tu_phap_nhan = relationship("PhapNhan", foreign_keys=[tu_phap_nhan_id])
    den_phap_nhan = relationship("PhapNhan", foreign_keys=[den_phap_nhan_id])
    creator = relationship("User", foreign_keys=[created_by])
    nguoi_duyet = relationship("User", foreign_keys=[nguoi_duyet_id])


# Import tại đây để tránh circular import khi billing.py import CashReceipt
from app.models.billing import SalesInvoice  # noqa: E402, F401
