from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, Numeric, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class GpsSnapshot(Base):
    """Lưu trữ snapshot GPS định kỳ — dùng để báo cáo km thực tế theo xe/ngày."""
    __tablename__ = "gps_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bien_so: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    xe_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("xe.id"), nullable=True, index=True)
    ngay: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float] = mapped_column(Float, default=0)
    fuel_pct: Mapped[float] = mapped_column(Float, default=0)
    km_today: Mapped[float] = mapped_column(Float, default=0)   # km hôm nay (reset mỗi ngày)
    km_total: Mapped[float] = mapped_column(Float, default=0)   # đồng hồ tổng
    is_stop: Mapped[bool] = mapped_column(Boolean, default=True)
    driver_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    xe = relationship("Xe", foreign_keys=[xe_id])


class GpsBinhMinhDaily(Base):
    """Tổng hợp nhiên liệu hàng ngày từ Bình Minh API — nguồn chính xác kể cả khi server restart."""
    __tablename__ = "gps_binhminh_daily"
    __table_args__ = (UniqueConstraint("bien_so", "ngay", name="uq_binhminh_daily_plate_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bien_so: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    ngay: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    km_odometer: Mapped[float] = mapped_column(Float, default=0)   # KmGps — đồng hồ cuối ngày
    nl_dau_ngay: Mapped[float] = mapped_column(Float, default=0)   # NhienLieuDauNgay (L)
    nl_tieu_thu: Mapped[float] = mapped_column(Float, default=0)   # NhienLieuTieuThu (L) — Bình Minh tính
    dung_tich_binh: Mapped[float] = mapped_column(Float, default=0)
    # JSON list: [{"so_lit": 110.0, "gio": "12:34:13", "dia_diem": "...", "loai": "Tăng"}]
    fills_json: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DrainAlertLog(Base):
    """Lưu lịch sử cảnh báo rút dầu severity='cao' từ poller real-time."""
    __tablename__ = "drain_alert_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bien_so: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    xe_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("xe.id"), nullable=True)
    ngay: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    gio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    so_lit: Mapped[float] = mapped_column(Float, nullable=False)
    drain_rate_L_per_h: Mapped[float] = mapped_column(Float, nullable=False)
    dia_diem: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phan_loai: Mapped[str] = mapped_column(String(30), default="rut_khi_dung")
    muc_canh_bao: Mapped[str] = mapped_column(String(20), default="cao")
    trang_thai: Mapped[str] = mapped_column(String(20), default="moi")  # moi/dang_xu_ly/da_xu_ly
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
