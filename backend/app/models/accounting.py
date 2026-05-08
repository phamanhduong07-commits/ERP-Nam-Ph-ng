from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, CheckConstraint, Computed, Date, DateTime,
    ForeignKey, Integer, Numeric, SmallInteger, String, Text,
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
    ngay_but_toan: Mapped[date] = mapped_column(Date, nullable=False)
    dien_giai: Mapped[str] = mapped_column(Text, nullable=False)
    loai_but_toan: Mapped[str] = mapped_column(String(30), nullable=False)
    tong_no: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_co: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chung_tu_loai: Mapped[str | None] = mapped_column(String(50))
    chung_tu_id: Mapped[int | None] = mapped_column(Integer)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")

    lines: Mapped[list["JournalEntryLine"]] = relationship(
        "JournalEntryLine", back_populates="entry", cascade="all, delete-orphan"
    )


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("journal_entries.id"), nullable=False)
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
    ngay_lap: Mapped[date] = mapped_column(Date, nullable=False)       # ngày nhận/nhập hệ thống
    ngay_hoa_don: Mapped[date | None] = mapped_column(Date)           # ngày ghi trên HĐ
    han_tt: Mapped[date | None] = mapped_column(Date)
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False)
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
    trang_thai: Mapped[str] = mapped_column(String(30), default="nhap")
    bo_qua_hach_toan: Mapped[bool] = mapped_column(Boolean, default=False)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    # nhap | da_tt_mot_phan | da_tt_du | qua_han | huy
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    supplier = relationship("Supplier")
    po = relationship("PurchaseOrder")
    gr = relationship("GoodsReceipt")
    creator = relationship("User", foreign_keys=[created_by])
    payments: Mapped[list["CashPayment"]] = relationship(
        "CashPayment", back_populates="purchase_invoice"
    )


class CashReceipt(Base):
    """Phiếu thu tiền từ khách hàng"""
    __tablename__ = "cash_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # PT-YYYYMM-XXXX
    ngay_phieu: Mapped[date] = mapped_column(Date, nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    sales_invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_invoices.id"))
    hinh_thuc_tt: Mapped[str] = mapped_column(String(20), default="CK")
    so_tai_khoan: Mapped[str | None] = mapped_column(String(100))
    so_tham_chieu: Mapped[str | None] = mapped_column(String(100))
    dien_giai: Mapped[str | None] = mapped_column(Text)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    # Tài khoản kế toán VAS
    tk_no: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="112")
    tk_co: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="131")
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_duyet")
    # cho_duyet | da_duyet | huy
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    customer = relationship("Customer")
    invoice: Mapped["SalesInvoice | None"] = relationship("SalesInvoice", back_populates="receipts")
    creator = relationship("User", foreign_keys=[created_by])
    nguoi_duyet = relationship("User", foreign_keys=[nguoi_duyet_id])


class CashPayment(Base):
    """Phiếu chi thanh toán nhà cung cấp"""
    __tablename__ = "cash_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # PC-YYYYMM-XXXX
    ngay_phieu: Mapped[date] = mapped_column(Date, nullable=False)
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_invoices.id"))
    hinh_thuc_tt: Mapped[str] = mapped_column(String(20), default="CK")
    so_tai_khoan: Mapped[str | None] = mapped_column(String(100))
    so_tham_chieu: Mapped[str | None] = mapped_column(String(100))
    dien_giai: Mapped[str | None] = mapped_column(Text)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    # Tài khoản kế toán VAS
    tk_no: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="331")
    tk_co: Mapped[str] = mapped_column(String(20), ForeignKey("chart_of_accounts.so_tk"), default="112")
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_chot")
    # cho_chot | da_chot | da_duyet | huy
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    supplier = relationship("Supplier")
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
    customer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"))
    supplier_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"))
    chung_tu_loai: Mapped[str | None] = mapped_column(String(50))
    chung_tu_id: Mapped[int | None] = mapped_column(Integer)
    so_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    customer = relationship("Customer")
    supplier = relationship("Supplier")


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
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    customer = relationship("Customer")
    sales_return = relationship("SalesReturn")
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
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    customer = relationship("Customer")
    supplier = relationship("Supplier")


class WorkshopPayroll(Base):
    """Bảng lương tổng hợp theo phân xưởng — dùng để hạch toán chi phí nhân công trực tiếp"""
    __tablename__ = "workshop_payroll"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False) # BL-YYYYMM-XX
    thang: Mapped[date] = mapped_column(Date, nullable=False) # Ngày đầu tháng hoặc cuối tháng đại diện
    phan_xuong_id: Mapped[int] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=False)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    
    tong_luong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_thuong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_bao_hiem: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0) # CP BH công ty đóng
    
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap") # nhap | da_duyet | huy
    bo_qua_hach_toan: Mapped[bool] = mapped_column(Boolean, default=False)

    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

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
    
    so_thang_khau_hao: Mapped[int] = mapped_column(Integer, nullable=False) # Tổng số tháng KH
    da_khau_hao_thang: Mapped[int] = mapped_column(Integer, default=0) # Số tháng đã KH
    gia_tri_da_khau_hao: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    
    tk_nguyen_gia: Mapped[str] = mapped_column(String(20), default="211")
    tk_khau_hao: Mapped[str] = mapped_column(String(20), default="214")
    tk_chi_phi: Mapped[str] = mapped_column(String(20), default="154")
    
    trang_thai: Mapped[str] = mapped_column(String(20), default="dang_su_dung") # dang_su_dung | da_kh_het | thanh_ly
    bo_qua_hach_toan: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    phan_xuong = relationship("PhanXuong")
    phap_nhan = relationship("PhapNhan")


# Import tại đây để tránh circular import khi billing.py import CashReceipt
from app.models.billing import SalesInvoice  # noqa: E402, F401
