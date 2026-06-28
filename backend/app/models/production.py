from datetime import date, datetime, time, timezone
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_lenh: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    ngay_lenh: Mapped[date] = mapped_column(Date, nullable=False)
    sales_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_orders.id"))
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi")
    # moi | dang_chay | hoan_thanh | huy | mua_ngoai

    ngay_bat_dau_ke_hoach: Mapped[date | None] = mapped_column(Date)
    ngay_hoan_thanh_ke_hoach: Mapped[date | None] = mapped_column(Date)
    ngay_bat_dau_thuc_te: Mapped[date | None] = mapped_column(Date)
    ngay_hoan_thanh_thuc_te: Mapped[date | None] = mapped_column(Date)

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    so_po_kh: Mapped[str | None] = mapped_column(String(100))
    don_gia_noi_bo: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    tan_dung: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")
    in_2_lan: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"))
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"))
    kho_sx_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("warehouses.id"))
    phoi_phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    nv_theo_doi_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    phieu_goc_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=True)
    parent_production_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(
            timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc))

    sales_order: Mapped["SalesOrder | None"] = relationship(
        "SalesOrder", foreign_keys=[sales_order_id])  # type: ignore[name-defined]
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])  # type: ignore[name-defined]
    nv_theo_doi: Mapped["User | None"] = relationship(
        "User", foreign_keys=[nv_theo_doi_id])  # type: ignore[name-defined]
    phap_nhan: Mapped["PhapNhan | None"] = relationship(
        "PhapNhan", foreign_keys=[phap_nhan_id])  # type: ignore[name-defined]
    kho_sx: Mapped["Warehouse | None"] = relationship(
        "Warehouse", foreign_keys=[kho_sx_id])  # type: ignore[name-defined]
    phan_xuong: Mapped["PhanXuong | None"] = relationship(
        "PhanXuong", foreign_keys=[phan_xuong_id])
    phoi_phan_xuong: Mapped["PhanXuong | None"] = relationship(
        "PhanXuong", foreign_keys=[phoi_phan_xuong_id])  # type: ignore[name-defined]
    parent_order: Mapped["ProductionOrder | None"] = relationship(
        "ProductionOrder", foreign_keys=[parent_production_order_id],
        remote_side="ProductionOrder.id")
    items: Mapped[list["ProductionOrderItem"]] = relationship(
        "ProductionOrderItem", back_populates="production_order",
        cascade="all, delete-orphan"
    )


class ProductionOrderItem(Base):
    __tablename__ = "production_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False
    )
    sales_order_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sales_order_items.id"))
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"))
    ten_hang: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    so_luong_ke_hoach: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    so_luong_hoan_thanh: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    dvt: Mapped[str] = mapped_column(String(20), default="Thùng")
    ngay_giao_hang: Mapped[date | None] = mapped_column(Date)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # ── Thông số kỹ thuật (kế thừa từ SalesOrderItem / QuoteItem) ──────────────
    loai_thung: Mapped[str | None] = mapped_column(String(50))
    dai: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    rong: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    cao: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    so_lop: Mapped[int | None] = mapped_column(SmallInteger)
    to_hop_song: Mapped[str | None] = mapped_column(String(20))
    mat: Mapped[str | None] = mapped_column(String(30))
    mat_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_1: Mapped[str | None] = mapped_column(String(30))
    song_1_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_1: Mapped[str | None] = mapped_column(String(30))
    mat_1_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_2: Mapped[str | None] = mapped_column(String(30))
    song_2_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_2: Mapped[str | None] = mapped_column(String(30))
    mat_2_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_3: Mapped[str | None] = mapped_column(String(30))
    song_3_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_3: Mapped[str | None] = mapped_column(String(30))
    mat_3_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    loai_in: Mapped[str | None] = mapped_column(String(30))
    so_mau: Mapped[int | None] = mapped_column(SmallInteger)
    loai_lan: Mapped[str | None] = mapped_column(String(50))
    c_tham: Mapped[str | None] = mapped_column(String(50))
    can_man: Mapped[str | None] = mapped_column(String(50))
    kho_tt: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dai_tt: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    so_lan_cat: Mapped[int | None] = mapped_column(SmallInteger)
    be_so_con: Mapped[int | None] = mapped_column(SmallInteger)
    qccl: Mapped[str | None] = mapped_column(String(50))
    dien_tich: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    gia_ban_muc_tieu: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    mua_phoi_ngoai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")

    @property
    def gia_ban(self) -> "Decimal | None":
        """Alias cho gia_ban_muc_tieu — để tương thích với _find_quote_item."""
        return self.gia_ban_muc_tieu

    production_order: Mapped["ProductionOrder"] = relationship("ProductionOrder", back_populates="items")
    product: Mapped["Product | None"] = relationship("Product")  # type: ignore[name-defined]
    sales_order_item: Mapped["SalesOrderItem | None"] = relationship("SalesOrderItem")  # type: ignore[name-defined]


class MayDungLog(Base):
    """Ghi nhận mỗi lần tạm dừng máy trong ca sản xuất."""
    __tablename__ = "may_dung_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(Integer, ForeignKey(
        "production_orders.id", ondelete="CASCADE"), nullable=False)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"))
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    gio_bat_dau_dung: Mapped[time] = mapped_column(Time, nullable=False)
    gio_tiep_tuc: Mapped[time | None] = mapped_column(Time)
    thoi_gian_dung: Mapped[int | None] = mapped_column(Integer)  # phút, tính khi có gio_tiep_tuc
    # hong_may | het_nguyen_lieu | nghi_giai_lao | giao_ca | khac
    ly_do: Mapped[str] = mapped_column(String(30), nullable=False, default="khac")
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    production_order: Mapped["ProductionOrder"] = relationship("ProductionOrder")
    phan_xuong: Mapped["PhanXuong | None"] = relationship("PhanXuong")  # type: ignore[name-defined]
    creator: Mapped["User | None"] = relationship("User")  # type: ignore[name-defined]


class ProductionSession(Base):
    """Phiên sản xuất chạy máy — gom nhóm LSX, phôi sóng, giấy cuộn và NVL phụ theo đợt chạy thực tế."""
    __tablename__ = "production_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_phien: Mapped[str] = mapped_column(String(100), nullable=False)
    ngay_tao: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    trang_thai: Mapped[str] = mapped_column(String(20), nullable=False, default="dang_chay")
    # dang_chay | cho_phan_bo | da_chot
    so_kg_hao_hut_chung: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("0"))
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    closed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    allocation_detail: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: kết quả phân bổ chi tiết về từng LSX

    phan_xuong = relationship("PhanXuong", foreign_keys=[phan_xuong_id])
    creator = relationship("User", foreign_keys=[created_by])
    closed_by_user = relationship("User", foreign_keys=[closed_by])

    rolls: Mapped[list["ProductionSessionRoll"]] = relationship(
        "ProductionSessionRoll", back_populates="session", cascade="all, delete-orphan"
    )
    materials: Mapped[list["ProductionSessionMaterial"]] = relationship(
        "ProductionSessionMaterial", back_populates="session", cascade="all, delete-orphan"
    )
    paper_wastes: Mapped[list["ProductionSessionPaperWaste"]] = relationship(
        "ProductionSessionPaperWaste", back_populates="session", cascade="all, delete-orphan"
    )
    phieu_nhap_phoi_songs: Mapped[list["PhieuNhapPhoiSong"]] = relationship(
        "PhieuNhapPhoiSong", back_populates="session"
    )
    overheads: Mapped[list["ProductionSessionOverhead"]] = relationship(
        "ProductionSessionOverhead", back_populates="session", cascade="all, delete-orphan"
    )


class ProductionSessionRoll(Base):
    """Tiêu hao của từng cuộn giấy trong Phiên sản xuất."""
    __tablename__ = "production_session_rolls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_sessions.id", ondelete="CASCADE"), nullable=False
    )
    giay_roll_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("giay_rolls.id"), nullable=False
    )
    trong_luong_dau: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    trong_luong_cuoi: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    trong_luong_tieu_hao: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    ngay_can: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    can_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    session: Mapped["ProductionSession"] = relationship("ProductionSession", back_populates="rolls")
    giay_roll = relationship("GiayRoll", foreign_keys=[giay_roll_id])
    can_by_user = relationship("User", foreign_keys=[can_by])


class ProductionSessionMaterial(Base):
    """Tiêu hao nguyên vật liệu phụ (Keo dán, Bột mì...) trong Phiên sản xuất."""
    __tablename__ = "production_session_materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_sessions.id", ondelete="CASCADE"), nullable=False
    )
    other_material_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("other_materials.id"), nullable=False
    )
    so_luong: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=Decimal("0"))
    don_gia: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))

    session: Mapped["ProductionSession"] = relationship("ProductionSession", back_populates="materials")
    other_material = relationship("OtherMaterial", foreign_keys=[other_material_id])


class ProductionSessionPaperWaste(Base):
    """Hao hụt giấy (phế liệu) chi tiết theo loại Sóng thu hồi trong Phiên sản xuất."""
    __tablename__ = "production_session_paper_wastes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_sessions.id", ondelete="CASCADE"), nullable=False
    )
    flute_type: Mapped[str] = mapped_column(String(10), nullable=False) # B | C | E | A | CHUNG
    so_kg_hao_hut: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("0"))

    session: Mapped["ProductionSession"] = relationship("ProductionSession", back_populates="paper_wastes")


class ProductionKhauCost(Base):
    """Chi phí gia công theo khâu converting (in, bế, dán, chống thấm...) per m².

    Được auto-tạo khi confirm_bom() từ các flag add-on trong BOM.
    Staff có thể cập nhật dien_tich / don_gia_m2 để reflect actual costs.
    thanh_tien = dien_tich × don_gia_m2
    """
    __tablename__ = "production_khau_costs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_order_items.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Tham chiếu addon_rate (nullable — cho phép nhập tay không cần rate có sẵn)
    addon_rate_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("addon_rates.id", ondelete="SET NULL"), nullable=True
    )
    khau: Mapped[str] = mapped_column(String(50), nullable=False)
    # "in_flexo_2mau", "be_4con", "chong_tham_1mat", "can_mang_2mat", "dan", "boi", etc.

    don_gia_m2: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    dien_tich: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False)  # m² tổng
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    production_order_item: Mapped["ProductionOrderItem"] = relationship(  # type: ignore[name-defined]
        "ProductionOrderItem", foreign_keys=[production_order_item_id]
    )


class ProductionSessionOverhead(Base):
    """Chi phí sản xuất chung (overhead) theo phiên — điện, thuê xưởng, khấu hao máy, lương gián tiếp."""
    __tablename__ = "production_session_overheads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    loai_chi_phi: Mapped[str] = mapped_column(String(50), nullable=False)
    # "dien" | "thue_xuong" | "khau_hao_may" | "luong_gian_tiep" | "khac"
    ten_chi_phi: Mapped[str] = mapped_column(String(200), nullable=False)
    thanh_tien: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    session: Mapped["ProductionSession"] = relationship("ProductionSession", back_populates="overheads")
