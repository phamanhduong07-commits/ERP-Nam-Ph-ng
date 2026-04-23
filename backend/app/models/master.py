from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, Numeric,
    SmallInteger, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_kho: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_kho: Mapped[str] = mapped_column(String(150), nullable=False)
    dia_chi: Mapped[str | None] = mapped_column(Text)
    loai_kho: Mapped[str] = mapped_column(String(30), nullable=False)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class MaterialGroup(Base):
    __tablename__ = "material_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_nhom: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten_nhom: Mapped[str] = mapped_column(String(150), nullable=False)
    la_nhom_giay: Mapped[bool] = mapped_column(Boolean, default=False)
    bo_phan: Mapped[str | None] = mapped_column(String(50))
    phan_xuong: Mapped[str | None] = mapped_column(String(50))
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    paper_materials: Mapped[list["PaperMaterial"]] = relationship("PaperMaterial", back_populates="nhom")
    other_materials: Mapped[list["OtherMaterial"]] = relationship("OtherMaterial", back_populates="nhom")


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_ncc: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_viet_tat: Mapped[str] = mapped_column(String(100), nullable=False)
    ten_don_vi: Mapped[str | None] = mapped_column(String(255))
    dia_chi: Mapped[str | None] = mapped_column(Text)
    dien_thoai: Mapped[str | None] = mapped_column(String(50))
    fax: Mapped[str | None] = mapped_column(String(50))
    di_dong: Mapped[str | None] = mapped_column(String(50))
    ma_so_thue: Mapped[str | None] = mapped_column(String(30))
    nguoi_dai_dien: Mapped[str | None] = mapped_column(String(150))
    phan_loai: Mapped[str | None] = mapped_column(String(50))
    ma_ncc_amis: Mapped[str | None] = mapped_column(String(50))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    paper_materials: Mapped[list["PaperMaterial"]] = relationship("PaperMaterial", back_populates="nsx")
    other_materials: Mapped[list["OtherMaterial"]] = relationship("OtherMaterial", back_populates="ncc")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_kh: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_viet_tat: Mapped[str] = mapped_column(String(100), nullable=False)
    ten_don_vi: Mapped[str | None] = mapped_column(String(255))
    dia_chi: Mapped[str | None] = mapped_column(Text)
    dia_chi_giao_hang: Mapped[str | None] = mapped_column(Text)
    dien_thoai: Mapped[str | None] = mapped_column(String(50))
    fax: Mapped[str | None] = mapped_column(String(50))
    ma_so_thue: Mapped[str | None] = mapped_column(String(30))
    nguoi_dai_dien: Mapped[str | None] = mapped_column(String(150))
    nguoi_lien_he: Mapped[str | None] = mapped_column(String(150))
    so_dien_thoai_lh: Mapped[str | None] = mapped_column(String(50))
    nv_phu_trach_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    no_tran: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    so_ngay_no: Mapped[int] = mapped_column(Integer, default=0)
    xep_loai: Mapped[str | None] = mapped_column(String(20))
    la_khach_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    hoa_don_ngay: Mapped[int] = mapped_column(Integer, default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sales_orders: Mapped[list["SalesOrder"]] = relationship("SalesOrder", back_populates="customer")
    products: Mapped[list["Product"]] = relationship("Product", back_populates="khach_hang")


class PaperMaterial(Base):
    __tablename__ = "paper_materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_chinh: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ma_amis: Mapped[str | None] = mapped_column(String(50))
    ma_nhom_id: Mapped[int] = mapped_column(Integer, ForeignKey("material_groups.id"), nullable=False)
    ten: Mapped[str] = mapped_column(String(255), nullable=False)
    ten_viet_tat: Mapped[str | None] = mapped_column(String(100))
    dvt: Mapped[str] = mapped_column(String(20), default="Kg")
    kho: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    ma_ky_hieu: Mapped[str | None] = mapped_column(String(20))
    dinh_luong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    ma_nsx_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"))
    tieu_chuan_dinh_luong: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    do_buc_tieu_chuan: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    do_nen_vong_tc: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    do_cobb_tieu_chuan: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    do_day_tieu_chuan: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    gia_mua: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    gia_ban: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ton_toi_thieu: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    ton_toi_da: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    la_cuon: Mapped[bool] = mapped_column(Boolean, default=True)
    su_dung: Mapped[bool] = mapped_column(Boolean, default=True)
    khong_tinh_nxt: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    nhom: Mapped["MaterialGroup"] = relationship("MaterialGroup", back_populates="paper_materials")
    nsx: Mapped["Supplier | None"] = relationship("Supplier", back_populates="paper_materials")


class OtherMaterial(Base):
    __tablename__ = "other_materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_chinh: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ma_amis: Mapped[str | None] = mapped_column(String(50))
    ten: Mapped[str] = mapped_column(String(255), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Kg")
    ma_nhom_id: Mapped[int] = mapped_column(Integer, ForeignKey("material_groups.id"), nullable=False)
    gia_mua: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ton_toi_thieu: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    ton_toi_da: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    phan_xuong: Mapped[str | None] = mapped_column(String(50))
    ma_ncc_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"))
    khong_tinh_nxt: Mapped[bool] = mapped_column(Boolean, default=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    nhom: Mapped["MaterialGroup"] = relationship("MaterialGroup", back_populates="other_materials")
    ncc: Mapped["Supplier | None"] = relationship("Supplier", back_populates="other_materials")


class CauTrucThongDung(Base):
    """Bảng kết cấu giấy thông dụng - Common paper structures for quick selection"""
    __tablename__ = "cau_truc_thong_dung"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_cau_truc: Mapped[str] = mapped_column(String(150), nullable=False)
    so_lop: Mapped[int] = mapped_column(SmallInteger, nullable=False)   # 3, 5, 7
    to_hop_song: Mapped[str | None] = mapped_column(String(20))         # B, BC, BCE...
    # Mỗi lớp: mã ký hiệu đồng cấp (ma_ky_hieu) + định lượng (g/m²)
    mat:       Mapped[str | None] = mapped_column(String(30))
    mat_dl:    Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_1:    Mapped[str | None] = mapped_column(String(30))
    song_1_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_1:     Mapped[str | None] = mapped_column(String(30))
    mat_1_dl:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_2:    Mapped[str | None] = mapped_column(String(30))
    song_2_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_2:     Mapped[str | None] = mapped_column(String(30))
    mat_2_dl:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_3:    Mapped[str | None] = mapped_column(String(30))
    song_3_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_3:     Mapped[str | None] = mapped_column(String(30))
    mat_3_dl:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    thu_tu: Mapped[int] = mapped_column(Integer, default=0)   # display order
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_amis: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ma_hang: Mapped[str | None] = mapped_column(String(50))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False)
    dai: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    rong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    cao: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    so_lop: Mapped[int] = mapped_column(SmallInteger, default=3)
    so_mau: Mapped[int] = mapped_column(SmallInteger, default=0)
    ghim: Mapped[bool] = mapped_column(Boolean, default=False)
    dan: Mapped[bool] = mapped_column(Boolean, default=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    phan_xuong: Mapped[str | None] = mapped_column(String(50))
    loai: Mapped[str | None] = mapped_column(String(50))
    ma_kh_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"))
    gia_ban: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    gia_mua: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ton_toi_thieu: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    ton_toi_da: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    khong_tinh_nxt: Mapped[bool] = mapped_column(Boolean, default=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    khach_hang: Mapped["Customer | None"] = relationship("Customer", back_populates="products")
    sales_order_items: Mapped[list["SalesOrderItem"]] = relationship("SalesOrderItem", back_populates="product")


class DonViTinh(Base):
    __tablename__ = "don_vi_tinh"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten: Mapped[str] = mapped_column(String(50), nullable=False)
    ky_hieu: Mapped[str | None] = mapped_column(String(20))
    ghi_chu: Mapped[str | None] = mapped_column(String(200))
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class ViTri(Base):
    __tablename__ = "vi_tri"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_vi_tri: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ten_vi_tri: Mapped[str] = mapped_column(String(150), nullable=False)
    loai: Mapped[str | None] = mapped_column(String(50))  # 'nhan_vien', 'kho', 'san_xuat'
    ghi_chu: Mapped[str | None] = mapped_column(String(200))
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Xe(Base):
    __tablename__ = "xe"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bien_so: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    loai_xe: Mapped[str | None] = mapped_column(String(50))
    trong_tai: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class TaiXe(Base):
    __tablename__ = "tai_xe"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ho_ten: Mapped[str] = mapped_column(String(150), nullable=False)
    so_dien_thoai: Mapped[str | None] = mapped_column(String(20))
    so_bang_lai: Mapped[str | None] = mapped_column(String(30))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class TinhThanh(Base):
    __tablename__ = "tinh_thanh"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_tinh: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    ten_tinh: Mapped[str] = mapped_column(String(100), nullable=False)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)

class PhuongXa(Base):
    __tablename__ = "phuong_xa"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_phuong: Mapped[str] = mapped_column(String(10), nullable=False)
    ten_phuong: Mapped[str] = mapped_column(String(100), nullable=False)
    tinh_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tinh_thanh.id"))
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    tinh: Mapped["TinhThanh | None"] = relationship("TinhThanh")

class DonGiaVanChuyen(Base):
    __tablename__ = "don_gia_van_chuyen"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_tuyen: Mapped[str] = mapped_column(String(150), nullable=False)
    khu_vuc_tu: Mapped[str | None] = mapped_column(String(100))
    khu_vuc_den: Mapped[str | None] = mapped_column(String(100))
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    dvt: Mapped[str] = mapped_column(String(20), default="chuyến")
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
