from decimal import Decimal
from sqlalchemy import Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AddonRate(Base):
    """Đơn giá phí gia công / dịch vụ thêm — có thể cấu hình qua giao diện quản trị."""
    __tablename__ = "addon_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_chi_phi: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    nhom: Mapped[str] = mapped_column(String(10), nullable=False)   # 'd1'..'d9'
    ten: Mapped[str] = mapped_column(String(200), nullable=False)
    don_vi: Mapped[str] = mapped_column(String(20), nullable=False)  # 'm2', 'pcs', 'pct'
    don_gia: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    thu_tu: Mapped[int] = mapped_column(Integer, default=0)
