from decimal import Decimal
from sqlalchemy import Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class LayerAllocationCoefficient(Base):
    """Hệ số phân bổ giấy theo loại lớp — dùng khi allocate kg thực xuất về từng LSX.

    mat (liner): he_so = 1.00 (cơ sở)
    song: he_so > 1 vì giấy sóng tiêu hao nhiều hơn do uốn lượn.
    """
    __tablename__ = "layer_allocation_coefficients"
    __table_args__ = (
        UniqueConstraint("loai_lop", "flute_type", name="uq_lac_lop_flute"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    loai_lop: Mapped[str] = mapped_column(String(10), nullable=False)        # "mat" | "song"
    flute_type: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "A"|"C"|"B"|"E"|None
    he_so: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=Decimal("1.0"))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
