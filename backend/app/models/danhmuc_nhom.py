from datetime import datetime, timezone

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class NhomDoiTuong(Base):
    """Nhóm đối tượng — danh mục phân nhóm khách hàng và nhà cung cấp.

    Dùng chung một bảng cho cả hai loại, phân biệt bằng cột `loai`:
    - "khach_hang"   → nhóm khách hàng
    - "nha_cung_cap" → nhóm nhà cung cấp

    Việc validate giá trị `loai` được thực hiện ở tầng router trước khi ghi.
    """

    __tablename__ = "nhom_doi_tuong"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_nhom: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ten_nhom: Mapped[str] = mapped_column(String(150), nullable=False)
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
