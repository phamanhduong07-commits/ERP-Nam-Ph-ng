from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PurchaseReturn(Base):
    """Phiếu trả hàng mua / Giảm giá hàng mua từ NCC"""
    __tablename__ = "purchase_returns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    # PTH-YYYYMM-XXXX (trả hàng) | PGG-YYYYMM-XXXX (giảm giá)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False)
    po_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_orders.id"))
    gr_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("goods_receipts.id"))
    invoice_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_invoices.id"))
    loai: Mapped[str] = mapped_column(String(20), nullable=False, default="tra_hang")
    # tra_hang | giam_gia
    ly_do: Mapped[str | None] = mapped_column(String(500))
    thue_suat: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    tong_tien_hang: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tien_thue: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_thanh_toan: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")
    # nhap | da_duyet | huy
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    supplier = relationship("Supplier")
    po = relationship("PurchaseOrder")
    gr = relationship("GoodsReceipt")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    items: Mapped[list["PurchaseReturnItem"]] = relationship(
        "PurchaseReturnItem", back_populates="phieu_tra", cascade="all, delete-orphan"
    )


class PurchaseReturnItem(Base):
    """Chi tiết hàng trả / giảm giá"""
    __tablename__ = "purchase_return_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    return_id: Mapped[int] = mapped_column(Integer, ForeignKey("purchase_returns.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    dvt: Mapped[str] = mapped_column(String(20), default="Kg")
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu_tra: Mapped["PurchaseReturn"] = relationship("PurchaseReturn", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")


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

    @hybrid_property
    def so_don_mua(self) -> str:
        return self.so_po

    @so_don_mua.expression
    def so_don_mua(cls):
        return cls.so_po

    @hybrid_property
    def ngay_dat(self) -> date:
        return self.ngay_po

    @ngay_dat.expression
    def ngay_dat(cls):
        return cls.ngay_po

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
