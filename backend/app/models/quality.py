from datetime import date, datetime
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(
            timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow)

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
