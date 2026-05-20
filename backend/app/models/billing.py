from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Computed, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SalesInvoice(Base):
    """Hóa đơn bán hàng (GTGT) — thay thế AMIS"""
    __tablename__ = "sales_invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_hoa_don: Mapped[str | None] = mapped_column(String(50), unique=True)       # HD-YYYYMM-XXXX
    mau_so: Mapped[str | None] = mapped_column(String(50))                         # 01GTKT0/001
    ky_hieu: Mapped[str | None] = mapped_column(String(50))                        # AA/24E
    ngay_hoa_don: Mapped[date] = mapped_column(Date, nullable=False)
    han_tt: Mapped[date | None] = mapped_column(Date)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    delivery_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("delivery_orders.id"))
    sales_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_orders.id"))
    # Snapshot thông tin KH tại thời điểm phát hành
    ten_don_vi: Mapped[str | None] = mapped_column(String(500))
    dia_chi: Mapped[str | None] = mapped_column(Text)
    ma_so_thue: Mapped[str | None] = mapped_column(String(50))
    nguoi_mua_hang: Mapped[str | None] = mapped_column(String(200))
    hinh_thuc_tt: Mapped[str] = mapped_column(String(20), default="CK")
    # Tài chính
    tong_tien_hang: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    ty_le_vat: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=10)
    tien_vat: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    tong_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    da_thanh_toan: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    con_lai: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        Computed("tong_cong - da_thanh_toan", persisted=True),
    )
    trang_thai: Mapped[str] = mapped_column(String(30), default="nhap")
    bo_qua_hach_toan: Mapped[bool] = mapped_column(Boolean, default=False)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    # nhap | da_phat_hanh | da_tt_mot_phan | da_tt_du | qua_han | huy
    anh_phieu_giao: Mapped[str | None] = mapped_column(Text)   # đường dẫn ảnh phiếu giao có chữ ký
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    phap_nhan = relationship("PhapNhan")

    @property
    def phap_nhan_ten(self) -> str | None:
        return self.phap_nhan.ten_phap_nhan if self.phap_nhan else None

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    customer = relationship("Customer")
    delivery = relationship("DeliveryOrder", back_populates="invoices")
    sales_order = relationship("SalesOrder")
    creator = relationship("User", foreign_keys=[created_by])
    receipts: Mapped[list["CashReceipt"]] = relationship(
        "CashReceipt", back_populates="invoice"
    )
    adjustment_logs: Mapped[list["InvoiceAdjustmentLog"]] = relationship(
        "InvoiceAdjustmentLog", back_populates="invoice", order_by="InvoiceAdjustmentLog.adjusted_at"
    )


class InvoiceAdjustmentLog(Base):
    """Nhật ký điều chỉnh hóa đơn — audit trail cho cả trước và sau kết chuyển"""
    __tablename__ = "invoice_adjustment_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(Integer, ForeignKey(
        "sales_invoices.id", ondelete="CASCADE"), nullable=False)
    adjusted_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    adjusted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    loai: Mapped[str] = mapped_column(String(30), nullable=False)
    # truoc_ket_chuyen | sau_ket_chuyen
    ghi_chu: Mapped[str] = mapped_column(Text, nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(20), default="na")
    # na (trực tiếp) | pending | approved | rejected
    approved_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    du_lieu_truoc: Mapped[str | None] = mapped_column(Text)  # JSON snapshot trước khi sửa
    du_lieu_sau: Mapped[str | None] = mapped_column(Text)    # JSON snapshot sau khi sửa

    __table_args__ = (
        Index("ix_invoice_adjustment_logs_invoice_id", "invoice_id"),
    )

    invoice = relationship("SalesInvoice", back_populates="adjustment_logs")
    adjusted_by = relationship("User", foreign_keys=[adjusted_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
