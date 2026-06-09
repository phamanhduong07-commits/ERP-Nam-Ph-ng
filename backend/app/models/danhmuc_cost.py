from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class KhoanMucChiPhi(Base):
    __tablename__ = "khoan_muc_chi_phi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_kmcp: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_kmcp: Mapped[str] = mapped_column(String(150), nullable=False)
    # "nhan_cong" | "nguyen_vat_lieu" | "may_moc" | "tieu_hao" | "chi_phi_chung" | "khac"
    loai_chi_phi: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LoaiTaisanCoDinh(Base):
    __tablename__ = "loai_tai_san_co_dinh"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_loai: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_loai: Mapped[str] = mapped_column(String(150), nullable=False)
    # Tỷ lệ khấu hao năm (%), vd 10.00 = 10%/năm
    ty_le_khau_hao: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    # Thời gian sử dụng hữu ích (năm)
    thoi_gian_sd: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # TK nguyên giá tài sản, vd "211"
    tk_nguyen_gia: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # TK hao mòn lũy kế, vd "214"
    tk_hao_mon: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # TK chi phí khấu hao, vd "6274"
    tk_khau_hao: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
