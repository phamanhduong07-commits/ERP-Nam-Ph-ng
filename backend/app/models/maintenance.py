from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MaintenanceMachine(Base):
    __tablename__ = "machines_maintenance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_may: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten_may: Mapped[str] = mapped_column(String(200), nullable=False)
    hang_sx: Mapped[str | None] = mapped_column(String(100))
    nam_sx: Mapped[int | None] = mapped_column(Integer)
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"))
    trang_thai: Mapped[str] = mapped_column(String(20), default="dang_dung")
    # dang_dung | ngung | sua_chua
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    phan_xuong = relationship("PhanXuong")
    schedules: Mapped[list["MaintenanceSchedule"]] = relationship(
        "MaintenanceSchedule", back_populates="machine", cascade="all, delete-orphan"
    )
    maintenance_logs: Mapped[list["MaintenanceLog"]] = relationship(
        "MaintenanceLog", back_populates="machine", cascade="all, delete-orphan"
    )


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines_maintenance.id", ondelete="CASCADE"), nullable=False)
    loai_bao_tri: Mapped[str] = mapped_column(String(100), nullable=False)
    chu_ky_ngay: Mapped[int] = mapped_column(Integer, nullable=False)
    ngay_bao_tri_gan_nhat: Mapped[date | None] = mapped_column(Date)
    ngay_bao_tri_tiep_theo: Mapped[date | None] = mapped_column(Date)
    trang_thai: Mapped[str] = mapped_column(String(20), default="dung_han")
    # dung_han | qua_han | sap_den_han
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    machine: Mapped["MaintenanceMachine"] = relationship("MaintenanceMachine", back_populates="schedules")


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines_maintenance.id", ondelete="CASCADE"), nullable=False)
    schedule_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("maintenance_schedules.id", ondelete="SET NULL"))
    loai: Mapped[str] = mapped_column(String(20), nullable=False)
    # dinh_ky | su_co
    ngay_bat_dau: Mapped[date] = mapped_column(Date, nullable=False)
    ngay_ket_thuc: Mapped[date | None] = mapped_column(Date)
    downtime_phut: Mapped[int] = mapped_column(Integer, default=0)
    mo_ta_su_co: Mapped[str | None] = mapped_column(Text)
    bien_phap_xu_ly: Mapped[str | None] = mapped_column(Text)
    chi_phi_vat_tu: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    chi_phi_nhan_cong: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    tong_chi_phi: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    phieu_chi_id: Mapped[int | None] = mapped_column(Integer)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    machine: Mapped["MaintenanceMachine"] = relationship("MaintenanceMachine", back_populates="maintenance_logs")
    schedule: Mapped["MaintenanceSchedule | None"] = relationship("MaintenanceSchedule")
