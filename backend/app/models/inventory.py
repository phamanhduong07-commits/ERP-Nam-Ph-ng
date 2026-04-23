from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"))
    ton_luong: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0)
    gia_tri_ton: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    don_gia_binh_quan: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    cap_nhat_luc: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ngay_giao_dich: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"))
    paper_roll_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_rolls.id"))
    loai_giao_dich: Mapped[str] = mapped_column(String(30), nullable=False)
    so_luong: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    gia_tri: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ton_sau_giao_dich: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0)
    chung_tu_loai: Mapped[str | None] = mapped_column(String(50))
    chung_tu_id: Mapped[int | None] = mapped_column(Integer)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PaperRoll(Base):
    __tablename__ = "paper_rolls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_cuon: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    paper_material_id: Mapped[int] = mapped_column(Integer, ForeignKey("paper_materials.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    kho: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    dinh_luong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    trong_luong_ban_dau: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    trong_luong_hien_tai: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    trang_thai: Mapped[str] = mapped_column(String(20), default="kho")
    ngay_nhap: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ngay_xuat_gan_nhat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
