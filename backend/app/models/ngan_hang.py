from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.database import Base


class NganHang(Base):
    __tablename__ = "ngan_hang"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_ngan_hang: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten_day_du: Mapped[str] = mapped_column(String(300), nullable=False)
    trang_thai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
