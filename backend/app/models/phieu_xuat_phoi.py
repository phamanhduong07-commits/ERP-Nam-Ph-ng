from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PhieuXuatPhoi(Base):
    __tablename__ = "phieu_xuat_phoi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    ca: Mapped[str | None] = mapped_column(String(20))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    creator = relationship("User")  # type: ignore[assignment]
    items: Mapped[list["PhieuXuatPhoiItem"]] = relationship(
        "PhieuXuatPhoiItem", cascade="all, delete-orphan", back_populates="phieu"
    )


class PhieuXuatPhoiItem(Base):
    __tablename__ = "phieu_xuat_phoi_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("phieu_xuat_phoi.id", ondelete="CASCADE"), nullable=False
    )
    production_order_item_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("production_order_items.id"), nullable=True
    )
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False)
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuXuatPhoi"] = relationship(
        "PhieuXuatPhoi", back_populates="items"
    )
    production_order_item = relationship("ProductionOrderItem")  # type: ignore[assignment]
