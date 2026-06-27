from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PhieuTraHang(Base):
    """Phiếu khách trả hàng — phôi (PHOI) hoặc thành phẩm (THANH_PHAM)."""
    __tablename__ = "phieu_tra_hang"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    loai_hang: Mapped[str] = mapped_column(String(20), nullable=False)
    # PHOI | THANH_PHAM
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), nullable=False
    )
    production_order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("production_orders.id"), nullable=True
    )
    delivery_order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("delivery_orders.id"), nullable=True
    )
    warehouse_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("warehouses.id"), nullable=False
    )
    ly_do_tra: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, server_default="draft")
    # draft | confirmed | huy
    nguoi_giao: Mapped[str | None] = mapped_column(String(100))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    confirmed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    customer = relationship("Customer")
    production_order = relationship("ProductionOrder")
    delivery_order = relationship("DeliveryOrder")
    warehouse = relationship("Warehouse")
    creator = relationship("User", foreign_keys=[created_by])
    confirmer = relationship("User", foreign_keys=[confirmed_by])
    items: Mapped[list["PhieuTraHangItem"]] = relationship(
        "PhieuTraHangItem", cascade="all, delete-orphan", back_populates="phieu"
    )


class PhieuTraHangItem(Base):
    __tablename__ = "phieu_tra_hang_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("phieu_tra_hang.id", ondelete="CASCADE"), nullable=False
    )
    so_luong: Mapped[int] = mapped_column(Integer, nullable=False)
    don_vi: Mapped[str | None] = mapped_column(String(20))  # Tấm | Thùng | ...
    tinh_trang: Mapped[str] = mapped_column(String(10), nullable=False, server_default="tot")
    # tot | loi
    chieu_kho: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))   # PHOI only
    chieu_cat: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))   # PHOI only
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id"), nullable=True
    )  # THANH_PHAM only
    don_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuTraHang"] = relationship(
        "PhieuTraHang", back_populates="items"
    )
    product = relationship("Product")
