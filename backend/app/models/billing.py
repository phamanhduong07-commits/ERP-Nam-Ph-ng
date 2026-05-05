from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Computed, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
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
    # nhap | da_phat_hanh | da_tt_mot_phan | da_tt_du | qua_han | huy
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
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
