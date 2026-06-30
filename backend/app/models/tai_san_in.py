from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TaiSanIn(Base):
    """Tài sản in ấn của khách hàng: bản in (ban_in) và khuôn bế (khuon_be).
    Vòng đời: cho_mua → dang_mua → dang_dung → hong / da_tra_khach / mat
    """
    __tablename__ = "tai_san_in"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_tai_san: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    # BSI-YYYY-001 (bản in) hoặc KBE-YYYY-001 (khuôn bế)
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    # ban_in | khuon_be
    mo_ta: Mapped[str | None] = mapped_column(String(300))

    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    nguoi_chi_tra: Mapped[str] = mapped_column(String(20), nullable=False, default="khach_hang")
    # khach_hang | cong_ty
    gia_tri: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    # Liên thông mua hàng NCC
    purchase_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_orders.id"), index=True)

    # Thu tiền KH (chỉ dùng khi nguoi_chi_tra='khach_hang')
    sales_order_thu_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_orders.id"), index=True)
    da_thu_tien: Mapped[bool] = mapped_column(Boolean, default=False)

    # Hoàn tiền KH khi đủ sản lượng định mức
    san_luong_dinh_muc_hoan: Mapped[Decimal | None] = mapped_column(Numeric(14, 0))
    da_hoan_tien: Mapped[bool] = mapped_column(Boolean, default=False)
    cash_payment_hoan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("cash_payments.id"))

    ngay_tao: Mapped[date] = mapped_column(Date, nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_mua")
    # cho_mua | dang_mua | dang_dung | hong | da_tra_khach | mat
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    customer = relationship("Customer", foreign_keys=[customer_id])
    purchase_order = relationship("PurchaseOrder", foreign_keys=[purchase_order_id])
    sales_order_thu = relationship("SalesOrder", foreign_keys=[sales_order_thu_id])
    cash_payment_hoan = relationship("CashPayment", foreign_keys=[cash_payment_hoan_id])
    creator = relationship("User", foreign_keys=[user_id])
    san_pham_links: Mapped[list["TaiSanInSanPham"]] = relationship(
        "TaiSanInSanPham", back_populates="tai_san", cascade="all, delete-orphan"
    )


class TaiSanInSanPham(Base):
    """Liên kết tài sản in ấn với sản phẩm sử dụng.
    Bản in: tối đa 1 sản phẩm (validate tại API).
    Khuôn bế: nhiều sản phẩm.
    """
    __tablename__ = "tai_san_in_san_pham"
    __table_args__ = (
        UniqueConstraint("tai_san_id", "san_pham_id", name="uq_tai_san_san_pham"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tai_san_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tai_san_in.id", ondelete="CASCADE"), nullable=False, index=True
    )
    san_pham_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    ghi_chu: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tai_san: Mapped["TaiSanIn"] = relationship("TaiSanIn", back_populates="san_pham_links")
    san_pham = relationship("Product", foreign_keys=[san_pham_id])
