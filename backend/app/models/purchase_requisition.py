from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PurchaseRequisition(Base):
    """Yêu cầu mua hàng (YMH) — purchase requisition workflow"""
    __tablename__ = "purchase_requisitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_ymh: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # YMH-YYYYMM-XXXX
    ngay_yeu_cau: Mapped[date] = mapped_column(Date, nullable=False)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), index=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), index=True)
    trang_thai: Mapped[str] = mapped_column(String(30), default="nhap", index=True)
    # nhap → cho_duyet → duyet_pb → duyet_gd → tao_po
    # nhap / cho_duyet / duyet_pb / duyet_gd → huy | tu_choi
    nguoi_yeu_cau_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nguoi_duyet_pb_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nguoi_duyet_gd_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_duyet_pb: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ngay_duyet_gd: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    po_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_orders.id"))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    ly_do_tu_choi: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    phan_xuong = relationship("PhanXuong")
    phap_nhan = relationship("PhapNhan")
    nguoi_yeu_cau = relationship("User", foreign_keys=[nguoi_yeu_cau_id])
    nguoi_duyet_pb = relationship("User", foreign_keys=[nguoi_duyet_pb_id])
    nguoi_duyet_gd = relationship("User", foreign_keys=[nguoi_duyet_gd_id])
    po = relationship("PurchaseOrder")
    items: Mapped[list["PurchaseRequisitionItem"]] = relationship(
        "PurchaseRequisitionItem", back_populates="ymh", cascade="all, delete-orphan"
    )


class PurchaseRequisitionItem(Base):
    __tablename__ = "purchase_requisition_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ymh_id: Mapped[int] = mapped_column(Integer, ForeignKey("purchase_requisitions.id"), nullable=False, index=True)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Kg")
    don_gia_du_kien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ngay_can: Mapped[date | None] = mapped_column(Date)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    loai_item: Mapped[str] = mapped_column(String(20), default="nvl")  # nvl | ban_in | khuon_be
    san_pham_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    tai_san_in_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("tai_san_in.id", ondelete="SET NULL"), nullable=True, index=True
    )

    ymh: Mapped["PurchaseRequisition"] = relationship("PurchaseRequisition", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")
    san_pham = relationship("Product")
    tai_san_in = relationship("TaiSanIn", foreign_keys=[tai_san_in_id])


class CongCuSanXuat(Base):
    """Công cụ sản xuất — bản in / khuôn bế gắn với mã hàng cụ thể"""
    __tablename__ = "cong_cu_san_xuat"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    san_pham_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    loai_cong_cu: Mapped[str] = mapped_column(String(20), nullable=False)  # ban_in | khuon_be
    trang_thai: Mapped[str] = mapped_column(String(20), default="co_san")  # co_san | dat_mua | hong
    so_luong: Mapped[int] = mapped_column(Integer, default=1)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    ymh_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_requisition_items.id"), nullable=True)
    po_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    san_pham = relationship("Product")
    ymh_item = relationship("PurchaseRequisitionItem")
