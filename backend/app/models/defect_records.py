from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Integer, String, Numeric, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class DefectRecord(Base):
    """Unified defect record — polymorphic source via ref_type + ref_id."""
    __tablename__ = "defect_records"
    __table_args__ = (
        UniqueConstraint("ref_type", "ref_id", name="uq_defect_records_ref"),
        Index("ix_defect_records_trang_thai", "trang_thai"),
        Index("ix_defect_records_khau", "khau"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ref_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # 'production_output' | 'phieu_nhap_phoi_song_item' | 'cd2_item' | ... (extensible)
    ref_id: Mapped[int] = mapped_column(Integer, nullable=False)
    khau: Mapped[str] = mapped_column(String(20), nullable=False)
    # 'cd1' | 'cd2' | 'tp' | 'nhap_kho' | 'xuat_kho' | 'tra_ve'
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, server_default="cho_xu_ly")
    # cho_xu_ly | ban_phe | tan_dung | da_xu_ly | huy
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    warehouse_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("warehouses.id"), nullable=True
    )
    phan_xuong_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("phan_xuong.id"), nullable=True
    )
    phap_nhan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("phap_nhan.id"), nullable=True
    )
    production_order_id_tan_dung: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("production_orders.id"), nullable=True
    )
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    lsx_tan_dung = relationship("ProductionOrder", foreign_keys=[production_order_id_tan_dung])
    creator = relationship("User", foreign_keys=[created_by])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
