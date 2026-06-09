from datetime import datetime, timezone

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TaiKhoanNgamDinh(Base):
    """Tài khoản ngầm định — ánh xạ loại nghiệp vụ → mã tài khoản kế toán mặc định.

    Cho phép sinh bút toán tự động dùng đúng mã TK mà không cần nhập tay mỗi lần.
    ``ma_loai``, ``ten_loai`` và ``nhom`` là dữ liệu hệ thống (seed sẵn) — người dùng
    chỉ được sửa ``so_tk`` và ``ghi_chu``.
    """

    __tablename__ = "tai_khoan_ngam_dinh"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Mã loại nghiệp vụ, ví dụ "doanh_thu_ban_hang", "hang_ton_kho", "phai_thu_kh"
    ma_loai: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    # Tên hiển thị, ví dụ "Doanh thu bán hàng"
    ten_loai: Mapped[str] = mapped_column(String(200), nullable=False)
    # Nhóm: "ban_hang" | "mua_hang" | "tien_te" | "thue" | "chi_phi" | "san_xuat"
    nhom: Mapped[str] = mapped_column(String(50), nullable=False)
    # Mã tài khoản từ hệ thống tài khoản (chart_of_accounts), ví dụ "511"
    so_tk: Mapped[str | None] = mapped_column(String(20))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
