from datetime import date, datetime
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CustomerInteraction(Base):
    __tablename__ = "customer_interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    # goi_dien | gap_mat | email | bao_gia | khieu_nai | khac
    loai: Mapped[str] = mapped_column(String(30), nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    noi_dung: Mapped[str | None] = mapped_column(Text)
    # tich_cuc | trung_tinh | tieu_cuc
    ket_qua: Mapped[str | None] = mapped_column(String(20))
    ngay_nhac_nho: Mapped[date | None] = mapped_column(Date)
    nguoi_phu_trach_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    customer = relationship("Customer", foreign_keys=[customer_id])
    nguoi_phu_trach = relationship("User", foreign_keys=[nguoi_phu_trach_id])
