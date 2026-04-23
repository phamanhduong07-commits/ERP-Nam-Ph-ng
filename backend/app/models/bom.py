from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    DateTime, ForeignKey, Integer, Numeric, SmallInteger,
    String, Text, Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProductionBOM(Base):
    """BOM (Bill of Materials) cho một dòng lệnh sản xuất."""
    __tablename__ = "production_boms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Liên kết lệnh SX (optional — có thể tính BOM độc lập trước khi có LSX)
    production_order_item_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("production_order_items.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    # ---- Thông số sản phẩm ----
    loai_thung: Mapped[str] = mapped_column(String(30), nullable=False)  # A1/A3/A5/tam
    dai: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    rong: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    cao: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    so_lop: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    to_hop_song: Mapped[str | None] = mapped_column(String(20))

    # ---- Lớp giấy: mã ký hiệu + định lượng + đơn giá/kg ----
    # Mặt ngoài
    mat: Mapped[str | None] = mapped_column(String(30))
    mat_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    # Sóng 1
    song_1: Mapped[str | None] = mapped_column(String(30))
    song_1_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_1_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    # Mặt giữa / mặt 1
    mat_1: Mapped[str | None] = mapped_column(String(30))
    mat_1_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_1_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    # Sóng 2 (5, 7 lớp)
    song_2: Mapped[str | None] = mapped_column(String(30))
    song_2_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_2_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    # Mặt 2 (5, 7 lớp)
    mat_2: Mapped[str | None] = mapped_column(String(30))
    mat_2_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_2_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    # Sóng 3 (7 lớp)
    song_3: Mapped[str | None] = mapped_column(String(30))
    song_3_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    song_3_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    # Mặt trong (7 lớp)
    mat_3: Mapped[str | None] = mapped_column(String(30))
    mat_3_dl: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    mat_3_gia: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # ---- Kích thước tính toán ----
    kho_tt: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dai_tt: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    kho_kh: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dai_kh: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    dien_tich: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))  # m²/unit

    # ---- Thông số sản xuất ----
    so_luong_sx: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    ty_le_hao_hut: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))

    # ---- Chi phí ----
    chi_phi_giay: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))        # a
    chi_phi_gian_tiep: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))   # b
    chi_phi_hao_hut: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))     # e
    loi_nhuan: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))           # c
    chi_phi_addon: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))       # d
    gia_ban_co_ban: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))      # p
    gia_ban_cuoi: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # ---- Add-on cấu hình ----
    chong_tham: Mapped[int] = mapped_column(Integer, default=0)        # 0/1/2
    in_flexo_mau: Mapped[int] = mapped_column(Integer, default=0)      # 0 = không in
    in_flexo_phu_nen: Mapped[bool] = mapped_column(Boolean, default=False)
    in_ky_thuat_so: Mapped[bool] = mapped_column(Boolean, default=False)
    chap_xa: Mapped[bool] = mapped_column(Boolean, default=False)
    boi: Mapped[bool] = mapped_column(Boolean, default=False)
    be_so_con: Mapped[int] = mapped_column(Integer, default=0)         # 0/1/2/4/6/8
    can_mang: Mapped[int] = mapped_column(Integer, default=0)          # 0/1/2
    san_pham_kho: Mapped[bool] = mapped_column(Boolean, default=False)

    # ---- Định giá ----
    ty_le_loi_nhuan: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    hoa_hong_kd_pct: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=0)
    hoa_hong_kh_pct: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=0)
    chi_phi_khac: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chiet_khau: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    hoa_hong_kd: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    hoa_hong_kh: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # ---- Trạng thái & meta ----
    trang_thai: Mapped[str] = mapped_column(String(20), default="draft")
    # draft | confirmed
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # ---- Relationships ----
    production_order_item: Mapped["ProductionOrderItem | None"] = relationship(  # type: ignore[name-defined]
        "ProductionOrderItem", foreign_keys=[production_order_item_id]
    )
    creator: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )
    items: Mapped[list["ProductionBOMItem"]] = relationship(
        "ProductionBOMItem",
        back_populates="bom",
        cascade="all, delete-orphan",
        order_by="ProductionBOMItem.id",
    )


class ProductionBOMItem(Base):
    """Một dòng nguyên liệu trong BOM (mỗi lớp giấy)."""
    __tablename__ = "production_bom_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bom_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_boms.id", ondelete="CASCADE"), nullable=False
    )

    vi_tri_lop: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g. "Mặt ngoài", "Sóng C", "Mặt giữa", "Sóng B", "Mặt trong"
    loai_lop: Mapped[str] = mapped_column(String(10), nullable=False)   # "mat" | "song"
    flute_type: Mapped[str | None] = mapped_column(String(5))           # C/B/E/A

    ma_ky_hieu: Mapped[str | None] = mapped_column(String(30))
    paper_material_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("paper_materials.id", ondelete="SET NULL"), nullable=True
    )

    dinh_luong: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)  # g/m²
    take_up_factor: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=1)

    dien_tich_1con: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))  # m²/unit after take-up
    trong_luong_1con: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))  # kg/unit

    so_luong_sx: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    ty_le_hao_hut: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0)
    trong_luong_can_tong: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))  # kg total

    don_gia_kg: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    thanh_tien: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # ---- Relationships ----
    bom: Mapped["ProductionBOM"] = relationship("ProductionBOM", back_populates="items")
    paper_material: Mapped["PaperMaterial | None"] = relationship(  # type: ignore[name-defined]
        "PaperMaterial", foreign_keys=[paper_material_id]
    )
