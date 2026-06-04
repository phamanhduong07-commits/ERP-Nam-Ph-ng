from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class QCSheet(Base):
    __tablename__ = "qc_sheets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    # nhan_hang | san_xuat | xuat_hang

    ref_type: Mapped[str | None] = mapped_column(String(50))
    # goods_receipt | production_order | delivery_order
    ref_id: Mapped[int | None] = mapped_column(Integer)

    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    nguoi_kiem_tra: Mapped[str | None] = mapped_column(String(100))
    ket_qua: Mapped[str | None] = mapped_column(String(20))
    # dat | khong_dat | tam_chap_nhan
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"))
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(
            timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc))

    phap_nhan = relationship("PhapNhan")
    phan_xuong = relationship("PhanXuong")
    defects: Mapped[list["QCDefect"]] = relationship("QCDefect", back_populates="sheet", cascade="all, delete-orphan")


class QCDefect(Base):
    __tablename__ = "qc_defects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    qc_sheet_id: Mapped[int] = mapped_column(Integer, ForeignKey("qc_sheets.id", ondelete="CASCADE"), nullable=False)
    loai_loi: Mapped[str] = mapped_column(String(100), nullable=False)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    so_luong_loi: Mapped[int] = mapped_column(Integer, default=0)
    hinh_anh_path: Mapped[str | None] = mapped_column(String(500))

    sheet: Mapped["QCSheet"] = relationship("QCSheet", back_populates="defects")


class QCGiayCuonPhieu(Base):
    __tablename__ = "qc_giay_cuon_phieu"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)

    # Liên kết
    paper_material_id: Mapped[int] = mapped_column(Integer, ForeignKey("paper_materials.id"), nullable=False)
    goods_receipt_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("goods_receipts.id"))
    goods_receipt_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("goods_receipt_items.id"))

    # Thông tin phiếu
    ngay_nhap_giay: Mapped[date | None] = mapped_column(Date)
    ngay_kiem_tra: Mapped[date] = mapped_column(Date, nullable=False)
    nguoi_kiem_tra: Mapped[str | None] = mapped_column(String(100))
    trong_luong_tem: Mapped[float | None] = mapped_column(Float)   # KG trên nhãn
    kho_thuc_te: Mapped[float | None] = mapped_column(Float)       # cm — khổ đo thực tế
    kho_tc: Mapped[float | None] = mapped_column(Float)            # cm — khổ tiêu chuẩn (snapshot)

    # Snapshot tiêu chuẩn tại thời điểm kiểm tra (audit trail)
    tc_dinh_luong: Mapped[float | None] = mapped_column(Float)
    tc_sai_so_pct: Mapped[float | None] = mapped_column(Float)
    tc_do_buc: Mapped[float | None] = mapped_column(Float)
    tc_do_nen_vong: Mapped[float | None] = mapped_column(Float)

    # Định lượng GSM
    dl_l1: Mapped[float | None] = mapped_column(Float)
    dl_l2: Mapped[float | None] = mapped_column(Float)
    dl_tb: Mapped[float | None] = mapped_column(Float)
    dl_ket_qua: Mapped[str | None] = mapped_column(String(20))     # dat | khong_dat

    # Độ bục (kgf/cm²)
    buc_l1: Mapped[float | None] = mapped_column(Float)
    buc_l2: Mapped[float | None] = mapped_column(Float)
    buc_l3: Mapped[float | None] = mapped_column(Float)
    buc_l4: Mapped[float | None] = mapped_column(Float)
    buc_tb: Mapped[float | None] = mapped_column(Float)
    buc_ket_qua: Mapped[str | None] = mapped_column(String(20))

    # Độ nén vòng (kgf/6inch)
    nen_vong_l1: Mapped[float | None] = mapped_column(Float)
    nen_vong_l2: Mapped[float | None] = mapped_column(Float)
    nen_vong_l3: Mapped[float | None] = mapped_column(Float)
    nen_vong_tb: Mapped[float | None] = mapped_column(Float)
    nen_vong_ket_qua: Mapped[str | None] = mapped_column(String(20))

    # Khổ giấy pass/fail: (tc-4) ≤ thực tế ≤ (tc+4)
    kho_ket_qua: Mapped[str | None] = mapped_column(String(20))

    # Kết quả tổng
    ket_qua: Mapped[str | None] = mapped_column(String(20))        # dat | khong_dat
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    paper_material = relationship("PaperMaterial", foreign_keys=[paper_material_id])
    goods_receipt = relationship("GoodsReceipt", foreign_keys=[goods_receipt_id])
    phap_nhan = relationship("PhapNhan")
