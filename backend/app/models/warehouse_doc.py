from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PhieuNhapKho(Base):
    __tablename__ = "phieu_nhap_kho"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # NK-YYYYMM-XXXX
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    loai_nhap: Mapped[str] = mapped_column(String(30), default="mua_hang")  # mua_hang | tra_hang | noi_bo | khac
    nha_cung_cap_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")  # nhap | da_duyet
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    warehouse = relationship("Warehouse")
    nha_cung_cap = relationship("Supplier")
    creator = relationship("User")
    items: Mapped[list["PhieuNhapKhoItem"]] = relationship(
        "PhieuNhapKhoItem", back_populates="phieu", cascade="all, delete-orphan"
    )


class PhieuNhapKhoItem(Base):
    __tablename__ = "phieu_nhap_kho_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_nhap_kho_id: Mapped[int] = mapped_column(Integer, ForeignKey("phieu_nhap_kho.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False)
    don_vi: Mapped[str] = mapped_column(String(20), default="Kg")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuNhapKho"] = relationship("PhieuNhapKho", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")


class PhieuXuatKho(Base):
    __tablename__ = "phieu_xuat_kho"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # XK-YYYYMM-XXXX
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    loai_xuat: Mapped[str] = mapped_column(String(30), default="san_xuat")  # san_xuat | ban_hang | noi_bo | khac
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    warehouse = relationship("Warehouse")
    creator = relationship("User")
    items: Mapped[list["PhieuXuatKhoItem"]] = relationship(
        "PhieuXuatKhoItem", back_populates="phieu", cascade="all, delete-orphan"
    )


class PhieuXuatKhoItem(Base):
    __tablename__ = "phieu_xuat_kho_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_xuat_kho_id: Mapped[int] = mapped_column(Integer, ForeignKey("phieu_xuat_kho.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False)
    don_vi: Mapped[str] = mapped_column(String(20), default="Kg")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuXuatKho"] = relationship("PhieuXuatKho", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")


class PhieuChuyenKho(Base):
    """Chuyển phôi liên xưởng: Hoàng Gia/Nam Thuận → Hóc Môn/Củ Chi"""
    __tablename__ = "phieu_chuyen_kho"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # CK-YYYYMM-XXXX
    warehouse_xuat_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    warehouse_nhap_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    warehouse_xuat = relationship("Warehouse", foreign_keys=[warehouse_xuat_id])
    warehouse_nhap = relationship("Warehouse", foreign_keys=[warehouse_nhap_id])
    creator = relationship("User")
    items: Mapped[list["PhieuChuyenKhoItem"]] = relationship(
        "PhieuChuyenKhoItem", back_populates="phieu", cascade="all, delete-orphan"
    )


class PhieuChuyenKhoItem(Base):
    __tablename__ = "phieu_chuyen_kho_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_chuyen_kho_id: Mapped[int] = mapped_column(Integer, ForeignKey("phieu_chuyen_kho.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False)
    don_vi: Mapped[str] = mapped_column(String(20), default="Kg")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuChuyenKho"] = relationship("PhieuChuyenKho", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")
