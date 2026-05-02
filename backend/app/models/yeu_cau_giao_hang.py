from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class YeuCauGiaoHang(Base):
    """Yêu cầu giao hàng — kế hoạch, không di chuyển kho"""
    __tablename__ = "yeu_cau_giao_hang"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_yeu_cau: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # YC-YYYYMM-XXXX
    ngay_yeu_cau: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_giao_yeu_cau: Mapped[date | None] = mapped_column(Date, nullable=True)
    customer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"), nullable=True)
    dia_chi_giao: Mapped[str | None] = mapped_column(Text)
    nguoi_nhan: Mapped[str | None] = mapped_column(String(150))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi")
    # moi | da_sap_xe | da_tao_phieu | huy
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    customer = relationship("Customer")
    creator = relationship("User")
    items: Mapped[list["YeuCauGiaoHangItem"]] = relationship(
        "YeuCauGiaoHangItem", back_populates="yeu_cau", cascade="all, delete-orphan"
    )


class YeuCauGiaoHangItem(Base):
    __tablename__ = "yeu_cau_giao_hang_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    yeu_cau_id: Mapped[int] = mapped_column(Integer, ForeignKey("yeu_cau_giao_hang.id", ondelete="CASCADE"), nullable=False)
    production_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    sales_order_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_order_items.id"), nullable=True)
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    dien_tich: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    trong_luong: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    yeu_cau: Mapped["YeuCauGiaoHang"] = relationship("YeuCauGiaoHang", back_populates="items")
    production_order = relationship("ProductionOrder")
    warehouse = relationship("Warehouse")
    product = relationship("Product")
