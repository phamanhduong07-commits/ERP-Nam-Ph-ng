from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class NhomCCDC(Base):
    """Nhóm công cụ dụng cụ"""
    __tablename__ = "nhom_ccdc"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_nhom: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_nhom: Mapped[str] = mapped_column(String(150), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    items: Mapped[list["CongCuDungCu"]] = relationship("CongCuDungCu", back_populates="nhom")


class CongCuDungCu(Base):
    """Công cụ dụng cụ"""
    __tablename__ = "cong_cu_dung_cu"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_ccdc: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_ccdc: Mapped[str] = mapped_column(String(200), nullable=False)
    nhom_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("nhom_ccdc.id"))
    don_vi_tinh: Mapped[str | None] = mapped_column(String(20))
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=1)
    nguyen_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    gia_tri_con_lai: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ngay_mua: Mapped[date | None] = mapped_column(Date)
    thoi_gian_phan_bo: Mapped[int] = mapped_column(Integer, default=0)
    so_thang_da_phan_bo: Mapped[int] = mapped_column(Integer, default=0)
    bo_phan_su_dung: Mapped[str | None] = mapped_column(String(150))
    trang_thai: Mapped[str] = mapped_column(String(30), default="dang_su_dung")
    # dang_su_dung | da_thanh_ly | mat | bao_hanh
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    nhom: Mapped["NhomCCDC | None"] = relationship("NhomCCDC", back_populates="items")
    phieu_xuat_items: Mapped[list["PhieuXuatCCDCItem"]] = relationship(
        "PhieuXuatCCDCItem", back_populates="ccdc"
    )


class PhieuXuatCCDC(Base):
    """Phiếu xuất dùng công cụ dụng cụ"""
    __tablename__ = "phieu_xuat_ccdc"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # PXCCDC-YYYYMM-XXXX
    ngay_xuat: Mapped[date] = mapped_column(Date, nullable=False)
    nguoi_nhan: Mapped[str | None] = mapped_column(String(150))
    bo_phan: Mapped[str | None] = mapped_column(String(150))
    ly_do: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_duyet")
    # cho_duyet | da_duyet | huy
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    items: Mapped[list["PhieuXuatCCDCItem"]] = relationship(
        "PhieuXuatCCDCItem", back_populates="phieu", cascade="all, delete-orphan"
    )
    creator = relationship("User", foreign_keys=[created_by])
    nguoi_duyet = relationship("User", foreign_keys=[nguoi_duyet_id])


class PhieuXuatCCDCItem(Base):
    __tablename__ = "phieu_xuat_ccdc_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_id: Mapped[int] = mapped_column(Integer, ForeignKey("phieu_xuat_ccdc.id"), nullable=False)
    ccdc_id: Mapped[int] = mapped_column(Integer, ForeignKey("cong_cu_dung_cu.id"), nullable=False)
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=1)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuXuatCCDC"] = relationship("PhieuXuatCCDC", back_populates="items")
    ccdc: Mapped["CongCuDungCu"] = relationship("CongCuDungCu", back_populates="phieu_xuat_items")
