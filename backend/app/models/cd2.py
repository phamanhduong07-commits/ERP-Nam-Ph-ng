from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Machine(Base):
    """Bảng máy móc dùng chung cho toàn bộ nhà máy."""
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_may: Mapped[str] = mapped_column(String(100), nullable=False)
    ma_may: Mapped[str | None] = mapped_column(String(50), unique=True)
    # in | be | dan | ghim | can_mang | boi | phoi | khac
    loai_may: Mapped[str] = mapped_column(String(50), default="khac")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)

    phan_xuong_obj = relationship("PhanXuong", foreign_keys=[phan_xuong_id])
    logs: Mapped[list["ProductionLog"]] = relationship("ProductionLog", back_populates="machine_obj")


class ProductionLog(Base):
    """Nhật ký chi tiết các sự kiện sản xuất tại máy (Start, Stop, Complete)."""
    __tablename__ = "production_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(Integer, ForeignKey("production_orders.id"), nullable=False)
    phieu_in_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phieu_in.id"), nullable=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines.id"), nullable=False)

    # start | stop | resume | complete
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)

    quantity_ok: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    quantity_loi: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    quantity_setup: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))

    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    machine_obj: Mapped["Machine"] = relationship("Machine", back_populates="logs")
    production_order = relationship("ProductionOrder")
    phieu_in = relationship("PhieuIn")
    creator = relationship("User")


class MayScan(Base):
    __tablename__ = "may_scan"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_may: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    don_gia: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)

    scan_logs: Mapped[list["ScanLog"]] = relationship("ScanLog", back_populates="may_scan_obj")
    phan_xuong_obj = relationship("PhanXuong", foreign_keys=[phan_xuong_id])


class ScanLog(Base):
    __tablename__ = "scan_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    may_scan_id: Mapped[int] = mapped_column(Integer, ForeignKey("may_scan.id"), nullable=False)
    so_lsx: Mapped[str] = mapped_column(String(50), nullable=False)
    ten_hang: Mapped[str | None] = mapped_column(String(255))
    dai: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    rong: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    cao: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    kho_tt: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    dien_tich: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))   # tổng m² (đã nhân SL)
    so_luong_tp: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    don_gia: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    tien_luong: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))  # = dien_tich * don_gia
    nguoi_sx: Mapped[str | None] = mapped_column(String(100))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    may_scan_obj: Mapped["MayScan"] = relationship("MayScan", back_populates="scan_logs")
    creator = relationship("User")  # type: ignore[assignment]


class MaySauIn(Base):
    __tablename__ = "may_sau_in"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_may: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)

    phieu_ins: Mapped[list["PhieuIn"]] = relationship("PhieuIn", back_populates="may_sau_in_obj")
    phan_xuong_obj = relationship("PhanXuong", foreign_keys=[phan_xuong_id])


class MayIn(Base):
    __tablename__ = "may_in"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ten_may: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    capacity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)

    phieu_ins: Mapped[list["PhieuIn"]] = relationship("PhieuIn", back_populates="may_in_obj")
    phan_xuong_obj = relationship("PhanXuong", foreign_keys=[phan_xuong_id])


class PhieuIn(Base):
    __tablename__ = "phieu_in"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_phieu: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    production_order_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("production_orders.id"))
    may_in_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("may_in.id"))
    may_sau_in_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("may_sau_in.id"))

    # cho_in | ke_hoach | dang_in | cho_dinh_hinh | sau_in | hoan_thanh | huy
    trang_thai: Mapped[str] = mapped_column(String(20), default="cho_in")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    ten_hang: Mapped[str | None] = mapped_column(String(255))
    ma_kh: Mapped[str | None] = mapped_column(String(50))
    ten_khach_hang: Mapped[str | None] = mapped_column(String(255))
    quy_cach: Mapped[str | None] = mapped_column(String(100))
    so_luong_phoi: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    ngay_lenh: Mapped[date | None] = mapped_column(Date)
    loai_in: Mapped[str | None] = mapped_column(String(50))
    loai: Mapped[str | None] = mapped_column(String(50))          # Thùng, Hộp, Khay...
    ths: Mapped[str | None] = mapped_column(String(20))           # loại sóng: B, C, C-B
    pp_ghep: Mapped[str | None] = mapped_column(String(50))       # Dán, Đóng Ghim
    ghi_chu_printer: Mapped[str | None] = mapped_column(Text)
    ghi_chu_prepare: Mapped[str | None] = mapped_column(Text)
    so_don: Mapped[str | None] = mapped_column(String(50))
    ngay_giao_hang: Mapped[date | None] = mapped_column(Date)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Kết quả in
    ngay_in: Mapped[date | None] = mapped_column(Date)
    ca: Mapped[str | None] = mapped_column(String(20))
    so_luong_in_ok: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    so_luong_loi: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    so_luong_setup: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    so_lan_setup: Mapped[int | None] = mapped_column(Integer)
    ghi_chu_ket_qua: Mapped[str | None] = mapped_column(Text)

    # Kết quả sau in
    ngay_sau_in: Mapped[date | None] = mapped_column(Date)
    ca_sau_in: Mapped[str | None] = mapped_column(String(20))
    so_luong_sau_in_ok: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    so_luong_sau_in_loi: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    ghi_chu_sau_in: Mapped[str | None] = mapped_column(Text)

    gio_bat_dau_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gio_hoan_thanh: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gio_bat_dau_dinh_hinh: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gio_hoan_thanh_dinh_hinh: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))

    may_in_obj: Mapped["MayIn | None"] = relationship("MayIn", back_populates="phieu_ins")
    may_sau_in_obj: Mapped["MaySauIn | None"] = relationship("MaySauIn", back_populates="phieu_ins")
    production_order = relationship("ProductionOrder")  # type: ignore[assignment]
    creator = relationship("User")  # type: ignore[assignment]
    phan_xuong_obj = relationship("PhanXuong", foreign_keys=[phan_xuong_id])


class ShiftCa(Base):
    __tablename__ = "shift_ca"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    leader: Mapped[str | None] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)

    configs: Mapped[list["ShiftConfig"]] = relationship("ShiftConfig", back_populates="shift_ca_obj")
    phan_xuong_obj = relationship("PhanXuong", foreign_keys=[phan_xuong_id])


class ShiftConfig(Base):
    __tablename__ = "shift_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    may_in_id: Mapped[int] = mapped_column(Integer, ForeignKey("may_in.id"), nullable=False)
    shift_ca_id: Mapped[int] = mapped_column(Integer, ForeignKey("shift_ca.id"), nullable=False)
    ngay: Mapped[date] = mapped_column(Date, nullable=False)
    gio_lam: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    gio_bat_dau: Mapped[str | None] = mapped_column(String(10))
    gio_ket_thuc: Mapped[str | None] = mapped_column(String(10))
    nghi_1: Mapped[int | None] = mapped_column(Integer)
    nghi_2: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    may_in_obj: Mapped["MayIn"] = relationship("MayIn")
    shift_ca_obj: Mapped["ShiftCa"] = relationship("ShiftCa", back_populates="configs")


class PrinterUser(Base):
    __tablename__ = "printer_user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rfid_key: Mapped[str | None] = mapped_column(String(100))
    token_user: Mapped[str] = mapped_column(String(100), nullable=False)
    token_password: Mapped[str] = mapped_column(String(255), nullable=False)
    shift: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    machine_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("machines.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    machine: Mapped["Machine"] = relationship("Machine", foreign_keys=[machine_id])
