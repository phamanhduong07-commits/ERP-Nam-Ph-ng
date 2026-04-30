from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class GoodsReceipt(Base):
    """Phiếu nhập kho — linked to PurchaseOrder"""
    __tablename__ = "goods_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # GR-YYYYMM-XXXX
    ngay_nhap: Mapped[date] = mapped_column(Date, nullable=False)
    po_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_orders.id"))
    supplier_id: Mapped[int] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    loai_nhap: Mapped[str] = mapped_column(String(30), default="MUA_HANG")
    # MUA_HANG | TRA_SX | DIEU_CHINH | CHUYEN_KHO
    tong_gia_tri: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")  # nhap | da_duyet
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    po = relationship("PurchaseOrder")
    supplier = relationship("Supplier")
    warehouse = relationship("Warehouse")
    creator = relationship("User")
    items: Mapped[list["GoodsReceiptItem"]] = relationship(
        "GoodsReceiptItem", back_populates="receipt", cascade="all, delete-orphan"
    )


class GoodsReceiptItem(Base):
    __tablename__ = "goods_receipt_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    receipt_id: Mapped[int] = mapped_column(Integer, ForeignKey("goods_receipts.id"), nullable=False)
    po_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("purchase_order_items.id"))
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Kg")
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    dinh_luong_thuc_te: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    do_am: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    ket_qua_kiem_tra: Mapped[str] = mapped_column(String(20), default="DAT")
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    receipt: Mapped["GoodsReceipt"] = relationship("GoodsReceipt", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")


class MaterialIssue(Base):
    """Phiếu xuất NVL cho sản xuất — linked to ProductionOrder"""
    __tablename__ = "material_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # XI-YYYYMM-XXXX
    ngay_xuat: Mapped[date] = mapped_column(Date, nullable=False)
    production_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")  # nhap | da_xuat | huy
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    production_order = relationship("ProductionOrder")
    warehouse = relationship("Warehouse")
    creator = relationship("User")
    items: Mapped[list["MaterialIssueItem"]] = relationship(
        "MaterialIssueItem", back_populates="issue", cascade="all, delete-orphan"
    )


class MaterialIssueItem(Base):
    __tablename__ = "material_issue_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(Integer, ForeignKey("material_issues.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong_ke_hoach: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    so_luong_thuc_xuat: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    dvt: Mapped[str] = mapped_column(String(20), default="Kg")
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    issue: Mapped["MaterialIssue"] = relationship("MaterialIssue", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")


class ProductionOutput(Base):
    """Phiếu nhập thành phẩm từ sản xuất vào kho"""
    __tablename__ = "production_outputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # TP-YYYYMM-XXXX
    ngay_nhap: Mapped[date] = mapped_column(Date, nullable=False)
    production_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"))
    ten_hang: Mapped[str | None] = mapped_column(String(255))
    so_luong_nhap: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    so_luong_loi: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    don_gia_xuat_xuong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    production_order = relationship("ProductionOrder")
    warehouse = relationship("Warehouse")
    product = relationship("Product")
    creator = relationship("User")


class DeliveryOrder(Base):
    """Phiếu xuất thành phẩm giao khách — linked to SalesOrder"""
    __tablename__ = "delivery_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # DO-YYYYMM-XXXX
    ngay_xuat: Mapped[date] = mapped_column(Date, nullable=False)
    sales_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    dia_chi_giao: Mapped[str | None] = mapped_column(Text)
    nguoi_nhan: Mapped[str | None] = mapped_column(String(150))
    xe_van_chuyen: Mapped[str | None] = mapped_column(String(50))
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")
    # nhap | da_xuat | da_giao | huy
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    sales_order = relationship("SalesOrder")
    customer = relationship("Customer")
    warehouse = relationship("Warehouse")
    creator = relationship("User")
    items: Mapped[list["DeliveryOrderItem"]] = relationship(
        "DeliveryOrderItem", back_populates="delivery", cascade="all, delete-orphan"
    )


class DeliveryOrderItem(Base):
    __tablename__ = "delivery_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    delivery_id: Mapped[int] = mapped_column(Integer, ForeignKey("delivery_orders.id"), nullable=False)
    sales_order_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_order_items.id"))
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    delivery: Mapped["DeliveryOrder"] = relationship("DeliveryOrder", back_populates="items")
    product = relationship("Product")


class PhieuChuyenKho(Base):
    """Chuyển phôi liên xưởng: Hoàng Gia/Nam Thuận → Hóc Môn/Củ Chi"""
    __tablename__ = "phieu_chuyen_kho"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # CK-YYYYMM-XXXX
    warehouse_xuat_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    warehouse_nhap_id: Mapped[int] = mapped_column(Integer, ForeignKey("warehouses.id"), nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="nhap")
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    warehouse_xuat = relationship("Warehouse", foreign_keys=[warehouse_xuat_id])
    warehouse_nhap = relationship("Warehouse", foreign_keys=[warehouse_nhap_id])
    creator = relationship("User")
    items: Mapped[list["PhieuChuyenKhoItem"]] = relationship(
        "PhieuChuyenKhoItem", back_populates="phieu", cascade="all, delete-orphan"
    )


class PhieuChuyenKhoItem(Base):
    __tablename__ = "phieu_chuyen_kho_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phieu_chuyen_kho_id: Mapped[int] = mapped_column(Integer, ForeignKey("phieu_chuyen_kho.id"), nullable=False)
    paper_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("paper_materials.id"))
    other_material_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("other_materials.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    don_vi: Mapped[str] = mapped_column(String(20), default="Kg")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    don_gia: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phieu: Mapped["PhieuChuyenKho"] = relationship("PhieuChuyenKho", back_populates="items")
    paper_material = relationship("PaperMaterial")
    other_material = relationship("OtherMaterial")
