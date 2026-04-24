from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProductionPlan(Base):
    __tablename__ = "production_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_ke_hoach: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_ke_hoach: Mapped[date] = mapped_column(Date, nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")
    # nhap | da_xuat | hoan_thanh

    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    creator: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )
    lines: Mapped[list["ProductionPlanLine"]] = relationship(
        "ProductionPlanLine",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="ProductionPlanLine.thu_tu",
    )


class ProductionPlanLine(Base):
    __tablename__ = "production_plan_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_plans.id", ondelete="CASCADE"), nullable=False
    )
    production_order_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_order_items.id"), nullable=False
    )
    thu_tu: Mapped[int] = mapped_column(Integer, default=0)
    ngay_chay: Mapped[date | None] = mapped_column(Date)

    # Thông số khổ giấy (Ch Khổ)
    kho1: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))       # khổ 1 con sp (cm)
    kho_giay: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))   # khổ giấy chọn (cm)
    so_dao: Mapped[int | None] = mapped_column(Integer)                # floor(kho_giay / kho1)
    kho_tt: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))     # kho1 * so_dao + 1.8

    # Số lượng
    so_luong_ke_hoach: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    so_luong_hoan_thanh: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho")
    # cho | dang_chay | hoan_thanh

    ghi_chu: Mapped[str | None] = mapped_column(Text)

    plan: Mapped["ProductionPlan"] = relationship(
        "ProductionPlan", back_populates="lines"
    )
    production_order_item: Mapped["ProductionOrderItem"] = relationship(  # type: ignore[name-defined]
        "ProductionOrderItem"
    )
