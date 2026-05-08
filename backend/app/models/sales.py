from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer,
    Numeric, SmallInteger, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_don: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_don: Mapped[date] = mapped_column(Date, nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    nv_kinh_doanh_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    trang_thai: Mapped[str] = mapped_column(String(30), default="moi")
    ngay_giao_hang: Mapped[date | None] = mapped_column(Date)
    dia_chi_giao: Mapped[str | None] = mapped_column(Text)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    tong_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ty_le_giam_gia: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)  # % giảm giá
    so_tien_giam_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # Số tiền giảm giá
    tong_tien_sau_giam: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # Tổng sau giảm giá
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"))
    phap_nhan_sx_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"))
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="sales_orders", foreign_keys=[customer_id])
    items: Mapped[list["SalesOrderItem"]] = relationship(
        "SalesOrderItem", back_populates="order",
        cascade="all, delete-orphan"
    )
    nv_kinh_doanh: Mapped["User | None"] = relationship("User", foreign_keys=[nv_kinh_doanh_id])
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])
    approver: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by])
    phap_nhan: Mapped["PhapNhan | None"] = relationship("PhapNhan", foreign_keys=[phap_nhan_id])
    phap_nhan_sx: Mapped["PhapNhan | None"] = relationship("PhapNhan", foreign_keys=[phap_nhan_sx_id])
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong", foreign_keys=[phan_xuong_id])  # type: ignore[name-defined]

    @property
    def ten_phap_nhan(self) -> str | None:
        return self.phap_nhan.ten_phap_nhan if self.phap_nhan else None

    @property
    def ten_phap_nhan_sx(self) -> str | None:
        return self.phap_nhan_sx.ten_phap_nhan if self.phap_nhan_sx else None

    @property
    def ten_phan_xuong(self) -> str | None:
        return self.phan_xuong.ten_xuong if self.phan_xuong else None


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    quote_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("quote_items.id", ondelete="SET NULL"), nullable=True)
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ty_le_giam_gia: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)  # % giảm giá cho dòng
    so_tien_giam_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # Số tiền giảm giá cho dòng
    ghi_chu_san_pham: Mapped[str | None] = mapped_column(Text)
    yeu_cau_in: Mapped[str | None] = mapped_column(Text)
    ngay_giao_hang: Mapped[date | None] = mapped_column(Date)
    so_luong_da_xuat: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    trang_thai_dong: Mapped[str] = mapped_column(String(20), default="cho_sx")

    # ── Thông số kỹ thuật (kế thừa từ báo giá) ──────────────────────────────
    loai_thung: Mapped[str | None] = mapped_column(String(50))
    dai:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    rong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    cao:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    so_lop:     Mapped[int | None] = mapped_column(SmallInteger)
    to_hop_song: Mapped[str | None] = mapped_column(String(20))
    mat:     Mapped[str | None] = mapped_column(String(30))
    mat_dl:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_1:     Mapped[str | None] = mapped_column(String(30))
    song_1_dl:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_1:      Mapped[str | None] = mapped_column(String(30))
    mat_1_dl:   Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_2:     Mapped[str | None] = mapped_column(String(30))
    song_2_dl:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_2:      Mapped[str | None] = mapped_column(String(30))
    mat_2_dl:   Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_3:     Mapped[str | None] = mapped_column(String(30))
    song_3_dl:  Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_3:      Mapped[str | None] = mapped_column(String(30))
    mat_3_dl:   Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    loai_in:  Mapped[str | None] = mapped_column(String(30))
    so_mau:   Mapped[int | None] = mapped_column(SmallInteger)
    loai_lan: Mapped[str | None] = mapped_column(String(50))
    kho_tt:   Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dai_tt:   Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dien_tich: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    c_tham: Mapped[str | None] = mapped_column(String(50))
    can_man: Mapped[str | None] = mapped_column(String(50))

    order: Mapped["SalesOrder"] = relationship("SalesOrder", back_populates="items")
    product: Mapped["Product | None"] = relationship("Product", back_populates="sales_order_items")
    quote_item: Mapped["QuoteItem | None"] = relationship("QuoteItem", foreign_keys=[quote_item_id])

    @property
    def thanh_tien(self) -> Decimal:
        """Thành tiền sau giảm giá"""
        tien_hang = self.so_luong * self.don_gia
        if self.ty_le_giam_gia > 0:
            return tien_hang * (1 - self.ty_le_giam_gia / 100)
        elif self.so_tien_giam_gia > 0:
            return max(0, tien_hang - self.so_tien_giam_gia)
        return tien_hang


# ─────────────────────────────────────────────
# Trả lại hàng bán (Sales Return)
# ─────────────────────────────────────────────

class SalesReturn(Base):
    __tablename__ = "sales_returns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu_tra: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_tra: Mapped[date] = mapped_column(Date, nullable=False)
    sales_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    delivery_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("delivery_orders.id"), nullable=True)  # Phiếu xuất kho cụ thể
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    ly_do_tra: Mapped[str] = mapped_column(Text, nullable=False)
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi")  # moi | da_duyet | huy
    tong_tien_tra: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sales_order: Mapped["SalesOrder"] = relationship("SalesOrder", back_populates="returns")
    delivery_order: Mapped["DeliveryOrder | None"] = relationship("DeliveryOrder", back_populates="returns")  # type: ignore[name-defined]
    customer: Mapped["Customer"] = relationship("Customer", back_populates="sales_returns")
    items: Mapped[list["SalesReturnItem"]] = relationship(
        "SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan"
    )
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])
    approver: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by])


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sales_return_id: Mapped[int] = mapped_column(Integer, ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False)
    sales_order_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("sales_order_items.id"), nullable=False)
    so_luong_tra: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    don_gia_tra: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ly_do_tra: Mapped[str | None] = mapped_column(Text)
    tinh_trang_hang: Mapped[str] = mapped_column(String(50), default="tot")  # tot | hong | loi
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    sales_return: Mapped["SalesReturn"] = relationship("SalesReturn", back_populates="items")
    sales_order_item: Mapped["SalesOrderItem"] = relationship("SalesOrderItem", back_populates="return_items")

    @property
    def delivery_order_item_id(self) -> None:
        return None

    @property
    def thanh_tien_tra(self) -> Decimal:
        return (self.so_luong_tra or Decimal("0")) * (self.don_gia_tra or Decimal("0"))


# ─────────────────────────────────────────────
# Cập nhật relationships
# ─────────────────────────────────────────────

SalesOrder.returns = relationship("SalesReturn", back_populates="sales_order", cascade="all, delete-orphan")
SalesOrderItem.return_items = relationship("SalesReturnItem", back_populates="sales_order_item", cascade="all, delete-orphan")


# ─────────────────────────────────────────────
# Báo giá (Quote)
# ─────────────────────────────────────────────
class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_bao_gia: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    so_bg_copy: Mapped[str | None] = mapped_column(String(30))
    ngay_bao_gia: Mapped[date] = mapped_column(Date, nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    nv_phu_trach_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nguoi_duyet_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    ngay_het_han: Mapped[date | None] = mapped_column(Date)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"))
    phap_nhan_sx_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"))
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"))
    nv_theo_doi_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    # Tài chính
    chi_phi_bang_in: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_khuon: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_van_chuyen: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_tien_hang: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ty_le_vat: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=8)
    tien_vat: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_hang_hoa_dv: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_khac_1_ten: Mapped[str | None] = mapped_column(String(100))
    chi_phi_khac_1: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_khac_2_ten: Mapped[str | None] = mapped_column(String(100))
    chi_phi_khac_2: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chiet_khau: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    gia_ban: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    gia_xuat_phoi_vsp: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    dieu_khoan: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi")
    # moi | da_duyet | het_han | huy

    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer", foreign_keys=[customer_id])
    nv_phu_trach: Mapped["User | None"] = relationship("User", foreign_keys=[nv_phu_trach_id])
    nv_theo_doi: Mapped["User | None"] = relationship("User", foreign_keys=[nv_theo_doi_id])
    phap_nhan: Mapped["PhapNhan | None"] = relationship("PhapNhan", foreign_keys=[phap_nhan_id])
    phap_nhan_sx: Mapped["PhapNhan | None"] = relationship("PhapNhan", foreign_keys=[phap_nhan_sx_id])
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong", foreign_keys=[phan_xuong_id])
    items: Mapped[list["QuoteItem"]] = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")


class QuoteItem(Base):
    __tablename__ = "quote_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quote_id: Mapped[int] = mapped_column(Integer, ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"))
    stt: Mapped[int] = mapped_column(SmallInteger, default=1)

    # Thông tin sản phẩm
    loai: Mapped[str | None] = mapped_column(String(50))
    ma_amis: Mapped[str | None] = mapped_column(String(50))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    so_luong: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    so_mau: Mapped[int] = mapped_column(SmallInteger, default=0)

    # Loại giấy / sóng
    # to_hop_song: tổ hợp sóng, ví dụ "B", "BC", "BCE"
    # mat/song_*: mã ký hiệu đồng cấp (ma_ky_hieu), _dl: định lượng g/m²
    so_lop: Mapped[int] = mapped_column(SmallInteger, default=3)
    to_hop_song: Mapped[str | None] = mapped_column(String(20))
    mat:    Mapped[str | None] = mapped_column(String(30))
    mat_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_1:    Mapped[str | None] = mapped_column(String(30))
    song_1_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_1:    Mapped[str | None] = mapped_column(String(30))
    mat_1_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_2:    Mapped[str | None] = mapped_column(String(30))
    song_2_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_2:    Mapped[str | None] = mapped_column(String(30))
    mat_2_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_3:    Mapped[str | None] = mapped_column(String(30))
    song_3_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_3:    Mapped[str | None] = mapped_column(String(30))
    mat_3_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    lay_gia_moi_nl: Mapped[bool] = mapped_column(Boolean, default=False)
    don_gia_m2: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))

    # Kích thước thùng
    loai_thung: Mapped[str | None] = mapped_column(String(50))
    dai: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    rong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    cao: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    kho_tt: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dai_tt: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dien_tich: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    khong_ct: Mapped[bool] = mapped_column(Boolean, default=False)

    # In ấn
    loai_in: Mapped[str] = mapped_column(String(30), default="khong_in")
    # flexo | ky_thuat_so | khong_in
    do_kho: Mapped[bool] = mapped_column(Boolean, default=False)
    ghim: Mapped[bool] = mapped_column(Boolean, default=False)
    chap_xa: Mapped[bool] = mapped_column(Boolean, default=False)
    do_phu: Mapped[bool] = mapped_column(Boolean, default=False)
    dan: Mapped[bool] = mapped_column(Boolean, default=False)
    boi: Mapped[bool] = mapped_column(Boolean, default=False)
    be_lo: Mapped[bool] = mapped_column(Boolean, default=False)
    c_tham: Mapped[str | None] = mapped_column(String(50))
    can_man: Mapped[str | None] = mapped_column(String(50))
    so_c_be: Mapped[str | None] = mapped_column(String(50))
    may_in: Mapped[str | None] = mapped_column(String(100))
    loai_lan: Mapped[str | None] = mapped_column(String(50))
    ban_ve_kt: Mapped[str | None] = mapped_column(String(500))

    # Giá
    gia_ban: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    quote: Mapped["Quote"] = relationship("Quote", back_populates="items")
    product: Mapped["Product | None"] = relationship("Product")
