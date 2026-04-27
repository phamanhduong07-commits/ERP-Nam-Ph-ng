from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PurchaseOrder(Base):
    """Đơn đặt mua nguyên liệu (giấy cuộn hoặc hàng khác)"""
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_don_mua: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    loai_don: Mapped[str] = mapped_column(String(20), nullable=False)  # giay_cuon | khac
    ngay_dat: Mapped[date] = mapped_column(Date, nullable=False)
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False)
    nv_thu_mua_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ten_nhom_hang: Mapped[str | None] = mapped_column(String(200))
    tong_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_duyet")
    # cho_duyet | da_duyet | hoan_thanh | huy
    noi_dung: Mapped[str | None] = mapped_column(Text)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", foreign_keys=[supplier_id])  # type: ignore[name-defined]
    nv_thu_mua: Mapped["User | None"] = relationship("User", foreign_keys=[nv_thu_mua_id])  # type: ignore[name-defined]
    nguoi_duyet: Mapped["User | None"] = relationship("User", foreign_keys=[nguoi_duyet_id])  # type: ignore[name-defined]
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])  # type: ignore[name-defined]
    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    receipts: Mapped[list["MaterialReceipt"]] = relationship("MaterialReceipt", back_populates="purchase_order")


class PurchaseOrderItem(Base):
    """Dòng chi tiết đơn mua hàng"""
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str | None] = mapped_column(String(500))
    so_cuon: Mapped[int | None] = mapped_column(Integer)
    so_luong: Mapped[Decimal] = mapped_column(Numeric(18, 3), nullable=False)
    dvt: Mapped[str | None] = mapped_column(String(20))
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    so_luong_da_nhap: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")
    paper_material: Mapped["PaperMaterial | None"] = relationship("PaperMaterial")  # type: ignore[name-defined]
    other_material: Mapped["OtherMaterial | None"] = relationship("OtherMaterial")  # type: ignore[name-defined]


class MaterialReceipt(Base):
    """Phiếu nhập nguyên liệu"""
    __tablename__ = "material_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # PIN-2024-001
    ngay_nhap: Mapped[date] = mapped_column(Date, nullable=False)
    phan_xuong: Mapped[str | None] = mapped_column(String(100))
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_orders.id"))
    so_phieu_can: Mapped[str | None] = mapped_column(String(100))
    bien_so_xe: Mapped[str | None] = mapped_column(String(50))
    trong_luong_xe: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    trong_luong_hang: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    tong_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")  # nhap | xac_nhan
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", foreign_keys=[supplier_id])  # type: ignore[name-defined]
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", foreign_keys=[warehouse_id])  # type: ignore[name-defined]
    purchase_order: Mapped["PurchaseOrder | None"] = relationship("PurchaseOrder", back_populates="receipts")
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])  # type: ignore[name-defined]
    items: Mapped[list["MaterialReceiptItem"]] = relationship(
        "MaterialReceiptItem", back_populates="receipt", cascade="all, delete-orphan"
    )


class MaterialReceiptItem(Base):
    """Chi tiết phiếu nhập nguyên liệu"""
    __tablename__ = "material_receipt_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    receipt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("material_receipts.id", ondelete="CASCADE"), nullable=False
    )
    purchase_order_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_order_items.id"))
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str | None] = mapped_column(String(500))
    so_luong: Mapped[Decimal] = mapped_column(Numeric(18, 3), nullable=False)
    dvt: Mapped[str | None] = mapped_column(String(20))
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    receipt: Mapped["MaterialReceipt"] = relationship("MaterialReceipt", back_populates="items")
    purchase_order_item: Mapped["PurchaseOrderItem | None"] = relationship("PurchaseOrderItem")
    paper_material: Mapped["PaperMaterial | None"] = relationship("PaperMaterial")  # type: ignore[name-defined]
    other_material: Mapped["OtherMaterial | None"] = relationship("OtherMaterial")  # type: ignore[name-defined]
