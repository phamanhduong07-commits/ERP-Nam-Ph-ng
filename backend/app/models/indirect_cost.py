from decimal import Decimal
from sqlalchemy import Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class IndirectCostItem(Base):
    """Chi phí gián tiếp theo số lớp — có thể cấu hình qua giao diện quản trị."""
    __tablename__ = "indirect_cost_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_lop: Mapped[int] = mapped_column(SmallInteger, nullable=False)   # 3 | 5 | 7
    ten: Mapped[str] = mapped_column(String(100), nullable=False)
    don_gia_m2: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    thu_tu: Mapped[int] = mapped_column(Integer, default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
