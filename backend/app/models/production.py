from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_lenh: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_lenh: Mapped[date] = mapped_column(Date, nullable=False)
    sales_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_orders.id"))
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi")
    # moi | dang_chay | hoan_thanh | huy

    ngay_bat_dau_ke_hoach: Mapped[date | None] = mapped_column(Date)
    ngay_hoan_thanh_ke_hoach: Mapped[date | None] = mapped_column(Date)
    ngay_bat_dau_thuc_te: Mapped[date | None] = mapped_column(Date)
    ngay_hoan_thanh_thuc_te: Mapped[date | None] = mapped_column(Date)

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sales_order: Mapped["SalesOrder | None"] = relationship("SalesOrder", foreign_keys=[sales_order_id])  # type: ignore[name-defined]
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])  # type: ignore[name-defined]
    items: Mapped[list["ProductionOrderItem"]] = relationship(
        "ProductionOrderItem", back_populates="production_order",
        cascade="all, delete-orphan"
    )


class ProductionOrderItem(Base):
    __tablename__ = "production_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False
    )
    sales_order_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_order_items.id"))
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong_ke_hoach: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    so_luong_hoan_thanh: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    ngay_giao_hang: Mapped[date | None] = mapped_column(Date)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    production_order: Mapped["ProductionOrder"] = relationship("ProductionOrder", back_populates="items")
    product: Mapped["Product | None"] = relationship("Product")  # type: ignore[name-defined]
    sales_order_item: Mapped["SalesOrderItem | None"] = relationship("SalesOrderItem")  # type: ignore[name-defined]
