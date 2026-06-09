from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.database import Base


class LoaiTien(Base):
    __tablename__ = "loai_tien"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_loai_tien: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    ten_loai_tien: Mapped[str] = mapped_column(String(100), nullable=False)
    ty_gia: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    ty_gia_mua: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    ty_gia_ban: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    la_mac_dinh: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trang_thai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
