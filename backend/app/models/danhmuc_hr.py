from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class KyHieuChamCong(Base):
    """Ký hiệu chấm công — bảng mã chấm công dùng cho bảng công và tính lương."""

    __tablename__ = "ky_hieu_cham_cong"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Ký hiệu ngắn hiển thị trên bảng công, vd "P", "NP", "OT"
    ky_hieu: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    # Tên đầy đủ, vd "Có mặt", "Nghỉ phép"
    ten_ky_hieu: Mapped[str] = mapped_column(String(100), nullable=False)
    # "di_lam" | "nghi_phep" | "tang_ca" | "vang_mat" | "nghi_le" | "nghi_khong_luong"
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    # Hệ số công: 1.0 = nguyên công, 0.5 = nửa công, 1.5 = tăng ca
    he_so_cong: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1.00"))
    # Ký hiệu này có được tính vào lương hay không
    tinh_luong: Mapped[bool] = mapped_column(Boolean, default=True)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class BieuThueThuNhap(Base):
    """Biểu tính thuế thu nhập cá nhân (TNCN) — gồm nhiều bậc thuế lũy tiến."""

    __tablename__ = "bieu_thue_thu_nhap"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Tên biểu thuế, vd "Biểu thuế TNCN 2024"
    ten_bieu: Mapped[str] = mapped_column(String(150), nullable=False)
    # Năm áp dụng biểu thuế
    nam_ap_dung: Mapped[int] = mapped_column(Integer, nullable=False)
    # "ca_nhan_cu_tru" | "ca_nhan_khong_cu_tru"
    loai: Mapped[str] = mapped_column(String(30), nullable=False)
    ghi_chu: Mapped[str | None] = mapped_column(Text, nullable=True)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    bac_thue: Mapped[list["BieuThueThuNhapBac"]] = relationship(
        backref="bieu",
        cascade="all, delete-orphan",
    )


class BieuThueThuNhapBac(Base):
    """Một bậc trong biểu thuế lũy tiến TNCN."""

    __tablename__ = "bieu_thue_thu_nhap_bac"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bieu_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bieu_thue_thu_nhap.id"), nullable=False, index=True
    )
    # Số thứ tự bậc thuế 1-7
    bac: Mapped[int] = mapped_column(Integer, nullable=False)
    # Cận dưới thu nhập tính thuế của bậc (VNĐ)
    thu_nhap_tu: Mapped[Decimal] = mapped_column(Numeric(18, 0), nullable=False, default=Decimal("0"))
    # Cận trên thu nhập tính thuế của bậc (VNĐ); NULL = không giới hạn
    thu_nhap_den: Mapped[Decimal | None] = mapped_column(Numeric(18, 0), nullable=True)
    # Tỷ lệ thuế (%), vd 5.00
    ty_le_thue: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    # Số tiền giảm trừ tính nhanh theo phương pháp rút gọn (VNĐ)
    so_tien_giam_tru: Mapped[Decimal] = mapped_column(Numeric(18, 0), default=Decimal("0"))

    # Quan hệ ngược về biểu thuế được tạo qua backref="bieu" trong BieuThueThuNhap.bac_thue
