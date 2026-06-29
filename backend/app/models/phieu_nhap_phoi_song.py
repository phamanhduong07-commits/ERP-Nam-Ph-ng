from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base



class PhieuNhapPhoiSong(Base):
    __tablename__ = "phieu_nhap_phoi_song"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    production_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False
    )
    loai: Mapped[str | None] = mapped_column(String(20))           # deprecated – NULL for new phiếu
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    ca: Mapped[str | None] = mapped_column(String(20))             # Ca 1 | Ca 2 | Ca 3
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    gio_bat_dau: Mapped[str | None] = mapped_column(String(8))     # HH:MM
    gio_ket_thuc: Mapped[str | None] = mapped_column(String(8))    # HH:MM
    warehouse_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("warehouses.id"), nullable=True
    )
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    session_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("production_sessions.id", ondelete="SET NULL"), nullable=True
    )
    phoi_du_trang_thai: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # NULL=chưa xử lý | 'da_nhap_kho_tan_dung' | 'giao_sx' | 'giao_khach' | 'huy'
    phoi_du_ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    phoi_du_so_luong: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    production_order = relationship("ProductionOrder")  # type: ignore[assignment]
    warehouse = relationship("Warehouse")               # type: ignore[assignment]
    creator = relationship("User")                      # type: ignore[assignment]
    session = relationship("ProductionSession", back_populates="phieu_nhap_phoi_songs")
    items: Mapped[list["PhieuNhapPhoiSongItem"]] = relationship(
        "PhieuNhapPhoiSongItem", cascade="all, delete-orphan", back_populates="phieu"
    )


class PhieuNhapPhoiSongItem(Base):
    __tablename__ = "phieu_nhap_phoi_song_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("phieu_nhap_phoi_song.id", ondelete="CASCADE"), nullable=False
    )
    production_order_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_order_items.id"), nullable=False
    )
    so_luong_ke_hoach: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    so_luong_thuc_te: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    so_luong_loi: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))  # phôi lỗi/hư hao
    trang_thai_loi: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # None=không có lỗi | 'cho_xu_ly' | 'da_nhap_kho_ao'
    chieu_kho: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))      # chiều khổ (cm)
    chieu_cat: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))      # chiều cắt (cm)
    so_tam: Mapped[int | None] = mapped_column(Integer)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuNhapPhoiSong"] = relationship(
        "PhieuNhapPhoiSong", back_populates="items"
    )
    production_order_item = relationship("ProductionOrderItem")  # type: ignore[assignment]
    hang_loi_phoi_kho_ao: Mapped["HangLoiPhoiKhoAo | None"] = relationship(
        "HangLoiPhoiKhoAo", back_populates="phieu_item", uselist=False
    )


class HangLoiPhoiKhoAo(Base):
    """Kho ảo phôi lỗi — chứa phôi lỗi từ CD1 trước khi xử lý (bán phế / tận dụng)."""
    __tablename__ = "hang_loi_phoi_kho_ao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_nhap_phoi_song_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("phieu_nhap_phoi_song_items.id"), unique=True, nullable=False
    )
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, server_default="cho_xu_ly")
    # cho_xu_ly | ban_phe | tan_dung | da_xu_ly | huy
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    production_order_id_tan_dung: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("production_orders.id"), nullable=True
    )
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    phieu_item: Mapped["PhieuNhapPhoiSongItem"] = relationship(
        "PhieuNhapPhoiSongItem", back_populates="hang_loi_phoi_kho_ao"
    )
    lsx_tan_dung = relationship("ProductionOrder", foreign_keys=[production_order_id_tan_dung])
    creator = relationship("User", foreign_keys=[created_by])
