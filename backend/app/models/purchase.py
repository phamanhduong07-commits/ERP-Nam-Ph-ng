from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_po: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_po: Mapped[date] = mapped_column(Date, nullable=False)
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(30), default="moi")
    # moi | da_duyet | da_gui_ncc | dang_giao | hoan_thanh | huy
    ngay_du_kien_nhan: Mapped[date | None] = mapped_column(Date)
    dieu_khoan_tt: Mapped[str | None] = mapped_column(String(50))
    tong_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    supplier = relationship("Supplier")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem", back_populates="po", cascade="all, delete-orphan"
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    po_id: Mapped[int] = mapped_column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Kg")
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    so_luong_da_nhan: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    po: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")
