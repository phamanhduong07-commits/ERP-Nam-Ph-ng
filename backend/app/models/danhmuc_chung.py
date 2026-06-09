from datetime import datetime, timezone

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DieuKhoanThanhToan(Base):
    """Điều khoản thanh toán — danh mục dùng chung cho đơn hàng, báo giá, hợp đồng."""

    __tablename__ = "dieu_khoan_thanh_toan"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_dktt: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_dktt: Mapped[str] = mapped_column(String(150), nullable=False)
    # so_ngay: số ngày tín dụng. 0 = COD (thanh toán ngay), 30 = Net30, NULL = không có kỳ hạn cố định.
    so_ngay: Mapped[int | None] = mapped_column(Integer)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))


class MucThuChi(Base):
    """Mục thu/chi — danh mục phân loại khoản thu và khoản chi cho phiếu thu/phiếu chi."""

    __tablename__ = "muc_thu_chi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_muc: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_muc: Mapped[str] = mapped_column(String(150), nullable=False)
    # loai: "thu" | "chi" | "ca_hai" — validate ở tầng router trước khi ghi.
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
