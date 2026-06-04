from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class DepreciationEntry(Base):
    """Bút toán khấu hao TSCĐ hàng tháng."""
    __tablename__ = "depreciation_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fixed_assets.id", ondelete="CASCADE"), nullable=False
    )
    ky: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    so_tien_kh: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    gia_tri_da_kh_sau: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    journal_entry_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
