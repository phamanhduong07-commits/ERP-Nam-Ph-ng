from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
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
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    production_order = relationship("ProductionOrder")  # type: ignore[assignment]
    creator = relationship("User")                      # type: ignore[assignment]
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
    chieu_kho: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))      # chiều khổ (cm)
    chieu_cat: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))      # chiều cắt (cm)
    so_tam: Mapped[int | None] = mapped_column(Integer)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuNhapPhoiSong"] = relationship(
        "PhieuNhapPhoiSong", back_populates="items"
    )
    production_order_item = relationship("ProductionOrderItem")  # type: ignore[assignment]
