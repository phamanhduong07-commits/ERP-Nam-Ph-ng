import time
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.master import Xe
from app.models.gps import DrainAlertLog, GpsSnapshot
from app.socket_manager import sio

logger = logging.getLogger("erp.gps")

router = APIRouter(prefix="/api/gps", tags=["GPS"])

GPS_POLL_INTERVAL = 300  # giây — poll GPS background mỗi 5 phút


def _cleanup_old_snapshots(db: Session) -> int:
    """Xóa snapshot GPS cũ hơn RETENTION_DAYS ngày. Trả về số dòng đã xóa."""
    cutoff = date.today() - timedelta(days=RETENTION_DAYS)
    deleted = db.query(GpsSnapshot).filter(GpsSnapshot.ngay < cutoff).delete(synchronize_session=False)
    db.commit()
    return deleted


async def gps_poller_loop() -> None:
    """Background task: tự động poll GPS API và lưu snapshot mỗi GPS_POLL_INTERVAL giây.
    Chạy kể từ khi FastAPI khởi động — không cần người dùng mở trang GPS.
    Mỗi ngày chạy 1 lần cleanup, xóa snapshot cũ hơn RETENTION_DAYS ngày.
    """
    import asyncio
    from app.database import SessionLocal
    global _last_cleanup

    logger.info("GPS poller: started (interval=%ds, retention=%dd)", GPS_POLL_INTERVAL, RETENTION_DAYS)
    await asyncio.sleep(15)  # Đợi app khởi động xong

    while True:
        db = SessionLocal()
        try:
            # 0. Refresh xe plate cache nếu stale (mỗi XE_CACHE_TTL giây)
            if time.time() - _xe_cache_ts >= XE_CACHE_TTL:
                _refresh_xe_cache(db)

            # 1. Lưu snapshot mới
            # GPS API trả về uppercase keys ("Plate", "Fuel", "TripKm", ...).
            # _try_save_snapshots dùng lowercase ("plate", "fuel_pct", "km_today", ...) — cần normalize trước.
            raw = await _fetch_gps_raw()
            if raw:
                normalized = [
                    {
                        "plate": v.get("Plate", ""),
                        "lat": v.get("Lat"),
                        "lng": v.get("Lng"),
                        "speed": v.get("Speed") or 0,
                        "fuel_pct": v.get("Fuel") or 0,
                        "km_today": v.get("TripKm") or 0,
                        "km_total": v.get("Km") or 0,
                        "is_stop": v.get("IsStop", True),
                        "driver_name": v.get("DriverName"),
                        "address": v.get("Address"),
                        "time_update": v.get("TimeUpdate"),  # GPS device time (VN tz) cho fill detection
                    }
                    for v in raw if v.get("Plate")
                ]
                # 1a. Detect drain real-time — try riêng để không chặn snapshot khi lỗi socket/DB
                try:
                    await _check_drain_realtime(normalized, db)
                except Exception as drain_exc:
                    logger.warning("GPS drain check failed (snapshots still saved): %s", drain_exc)
                # 1b. Lưu snapshot (throttled 5 phút) với xe_id đã resolve
                _try_save_snapshots(normalized, db)

            # 2. Cleanup hàng ngày (86400s = 1 ngày)
            if time.time() - _last_cleanup >= 86400:
                deleted = _cleanup_old_snapshots(db)
                if deleted:
                    logger.info("GPS cleanup: đã xóa %d snapshot cũ hơn %d ngày", deleted, RETENTION_DAYS)
                _last_cleanup = time.time()

        except Exception as exc:
            logger.warning("GPS poller error (retry in %ds): %s", GPS_POLL_INTERVAL, exc)
        finally:
            db.close()

        await asyncio.sleep(GPS_POLL_INTERVAL)

# In-memory cache: (data, timestamp)
_cache: dict = {"data": None, "ts": 0.0}
CACHE_TTL = 30  # seconds

# Throttle: plate → last snapshot saved timestamp
_snapshot_throttle: dict[str, float] = {}
SNAPSHOT_INTERVAL = 300   # 5 phút — đủ dày để theo dõi dầu GPS chính xác
RETENTION_DAYS = 60       # giữ dữ liệu GPS 2 tháng, sau đó tự xóa
FUEL_SPIKE_THRESHOLD = 8.0   # L — tăng ≥8L giữa 2 snapshot liên tiếp = phát hiện đổ dầu tự động
DRAIN_THRESHOLD = 8.0        # L — hụt ≥8L = sự kiện cần kiểm tra
DRAIN_WHILE_MOVING_FACTOR = 2.5  # hụt > 2.5× định mức L/100km khi di chuyển = tiêu hao bất thường
_last_cleanup: float = 0.0

# xe_id plate cache: normalized_plate → xe_id (refresh mỗi 3600s)
_xe_plate_cache: dict[str, int] = {}
_xe_dinh_muc_cache: dict[str, float] = {}  # normalized_plate → dinh_muc_dau (L/100km)
_xe_cache_ts: float = 0.0
XE_CACHE_TTL = 3600  # 1 giờ

# Real-time drain: previous snapshot state per plate
_prev_snap: dict[str, dict] = {}

# Anti-spam: plate → timestamp of last drain alert (30 min cooldown)
_drain_alert_cooldown: dict[str, float] = {}
DRAIN_ALERT_COOLDOWN = 1800  # 30 phút


def _normalize_plate(plate: str) -> str:
    """Remove hyphens/spaces to allow matching '50H-34427' == '50H34427'."""
    return plate.upper().replace("-", "").replace(" ", "")


def _parse_gps_time(raw: str | None) -> datetime | None:
    """Parse GPS TimeUpdate string (Vietnam time UTC+7) → naive UTC datetime.

    GPS Bình Minh trả về nhiều format khác nhau — thử tuần tự.
    Fallback None nếu không parse được → caller dùng datetime.utcnow().
    """
    if not raw:
        return None
    for fmt in ("%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S"):
        try:
            dt_vn = datetime.strptime(raw.strip(), fmt)
            return dt_vn - timedelta(hours=7)
        except ValueError:
            continue
    return None


def _refresh_xe_cache(db: Session) -> None:
    """Load xe.bien_so → xe.id + dinh_muc_dau vào in-memory cache."""
    global _xe_plate_cache, _xe_dinh_muc_cache, _xe_cache_ts
    rows = db.query(Xe.id, Xe.bien_so, Xe.dinh_muc_dau).filter(Xe.bien_so.isnot(None)).all()
    _xe_plate_cache = {_normalize_plate(r.bien_so): r.id for r in rows}
    _xe_dinh_muc_cache = {
        _normalize_plate(r.bien_so): float(r.dinh_muc_dau or 0)
        for r in rows
    }
    _xe_cache_ts = time.time()
    logger.info("GPS xe cache refreshed: %d entries", len(_xe_plate_cache))


async def _check_drain_realtime(vehicles: list[dict], db: Session) -> None:
    """Sau mỗi poll cycle: phát hiện rút dầu real-time.

    Detect 2 loại:
    - rut_khi_dung: xe dừng, drop ≥8L, rate >10 L/h
    - tieu_hao_bat_thuong: xe chạy, drop > expected × DRAIN_WHILE_MOVING_FACTOR
    """
    now_t = time.time()
    for v in vehicles:
        plate = v.get("plate", "")
        if not plate:
            continue
        plate_norm = _normalize_plate(plate)
        curr_fuel = float(v.get("fuel_pct") or 0)
        curr_stop = bool(v.get("is_stop", True))
        curr_addr = v.get("address")
        curr_km = float(v.get("km_today") or 0)
        curr_xe_id = _xe_plate_cache.get(plate_norm)
        dinh_muc = _xe_dinh_muc_cache.get(plate_norm, 0.0)

        gps_ts = _parse_gps_time(v.get("time_update"))
        curr_ts = (gps_ts or datetime.utcnow()).replace(tzinfo=timezone.utc)

        prev = _prev_snap.get(plate)
        _prev_snap[plate] = {
            "fuel": curr_fuel,
            "is_stop": curr_stop,
            "created_at": curr_ts,
            "address": curr_addr,
            "xe_id": curr_xe_id,
            "km_today": curr_km,
        }

        if prev is None:
            continue

        drop = prev["fuel"] - curr_fuel
        if drop < DRAIN_THRESHOLD:
            continue

        prev_ts = prev["created_at"]
        elapsed_min = max(1.0, (curr_ts - prev_ts).total_seconds() / 60)
        drain_rate = drop / (elapsed_min / 60)

        # Xác định loại sự kiện
        phan_loai: str | None = None
        if curr_stop:
            # Xe dừng: check tốc độ rút (rate > 10 L/h mới là bất thường, không phải bay hơi)
            if drain_rate >= 10:
                phan_loai = "rut_khi_dung"
        else:
            # Xe chạy: check so với định mức
            if dinh_muc > 0:
                prev_km = prev.get("km_today", 0.0)
                km_delta = curr_km - prev_km
                # Bỏ qua khi km_today reset về 0 lúc 0h hoặc dữ liệu GPS lỗi
                if 0 < km_delta < 999:
                    expected_L = km_delta * dinh_muc / 100
                    if drop > expected_L * DRAIN_WHILE_MOVING_FACTOR:
                        phan_loai = "tieu_hao_bat_thuong"

        if phan_loai is None:
            continue

        # Anti-spam cooldown per plate
        if now_t - _drain_alert_cooldown.get(plate, 0) < DRAIN_ALERT_COOLDOWN:
            continue
        _drain_alert_cooldown[plate] = now_t

        dia_diem = curr_addr or prev.get("address")
        log = DrainAlertLog(
            bien_so=plate,
            xe_id=curr_xe_id,
            ngay=date.today(),
            gio=curr_ts,
            so_lit=round(drop, 1),
            drain_rate_L_per_h=round(drain_rate, 1),
            dia_diem=dia_diem,
            phan_loai=phan_loai,
            muc_canh_bao="cao",
        )
        try:
            db.add(log)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("DrainAlertLog save failed: %s", exc)

        payload = {
            "bien_so": plate,
            "so_lit": round(drop, 1),
            "drain_rate_L_per_h": round(drain_rate, 1),
            "dia_diem": dia_diem,
            "gio": curr_ts.isoformat(),
            "muc_canh_bao": "cao",
            "phan_loai": phan_loai,
        }
        try:
            await sio.emit("drain_alert", payload)
            logger.warning(
                "DRAIN ALERT [%s]: %s hụt %.1fL (%.1f L/h) tại %s",
                phan_loai, plate, drop, drain_rate, dia_diem,
            )
        except Exception as exc:
            logger.warning("Socket emit drain_alert failed: %s", exc)


async def _fetch_gps_raw() -> list[dict]:
    now = time.time()
    if _cache["data"] is not None and (now - _cache["ts"]) < CACHE_TTL:
        return _cache["data"]

    params = {
        "pageIds": settings.GPS_PAGE_IDS,
        "username": settings.GPS_USERNAME,
        "pwd": settings.GPS_PASSWORD,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(settings.GPS_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.error("GPS API error: %s", e)
        # Return stale cache if available, else raise
        if _cache["data"] is not None:
            return _cache["data"]
        raise HTTPException(503, "Không kết nối được GPS API")

    # GPS Bình Minh trả về {"Data": [...]}
    result = data if isinstance(data, list) else data.get("Data", data.get("data", []))
    _cache["data"] = result
    _cache["ts"] = now
    return result


def _try_save_snapshots(vehicles: list[dict], db: Session) -> None:
    """Lưu snapshot cho các xe chưa được lưu trong 30 phút qua."""
    now = time.time()
    today = date.today()
    to_insert = []

    for v in vehicles:
        plate = v.get("plate", "") or ""
        if not plate:
            continue
        last = _snapshot_throttle.get(plate, 0)
        if now - last < SNAPSHOT_INTERVAL:
            continue

        # Dùng GPS TimeUpdate (giờ thực GPS device) thay vì server time,
        # giúp fill detection chính xác. Fallback utcnow() nếu field thiếu/sai format.
        gps_ts = _parse_gps_time(v.get("time_update"))
        created_utc = gps_ts if gps_ts else datetime.utcnow()

        xe_id = _xe_plate_cache.get(_normalize_plate(plate))
        to_insert.append(GpsSnapshot(
            bien_so=plate,
            xe_id=xe_id,
            ngay=today,
            lat=v.get("lat"),
            lng=v.get("lng"),
            speed=v.get("speed") or 0,
            fuel_pct=v.get("fuel_pct") or 0,
            km_today=v.get("km_today") or 0,
            km_total=v.get("km_total") or 0,
            is_stop=v.get("is_stop", True),
            driver_name=v.get("driver_name"),
            address=v.get("address"),
            created_at=created_utc,
        ))
        _snapshot_throttle[plate] = now

    if to_insert:
        try:
            db.add_all(to_insert)
            db.commit()
            logger.info("GPS: saved %d snapshots", len(to_insert))
        except Exception as e:
            db.rollback()
            logger.warning("GPS snapshot save failed: %s", e)


@router.get("/vehicles")
async def get_gps_vehicles(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Trả về trạng thái thời gian thực của tất cả xe GPS, enrich với dữ liệu ERP."""
    raw = await _fetch_gps_raw()

    # Build plate→Xe map for quick lookup
    xe_map: dict[str, Xe] = {}
    for xe in db.query(Xe).filter(Xe.trang_thai == True).all():
        key = _normalize_plate(xe.bien_so)
        xe_map[key] = xe

    vehicles = []
    for v in raw:
        plate_norm = _normalize_plate(v.get("Plate", ""))
        xe_erp: Optional[Xe] = xe_map.get(plate_norm)

        # Determine status
        is_stop = v.get("IsStop", True)
        is_overspeed = v.get("IsOverSpeed", False)
        speed = v.get("Speed", 0)
        if is_overspeed:
            status = "overspeed"
        elif not is_stop:
            status = "moving"
        else:
            status = "stopped"

        vehicles.append({
            # GPS data
            "gps_id": v.get("Id"),
            "plate": v.get("Plate"),
            "lat": v.get("Lat"),
            "lng": v.get("Lng"),
            "speed": speed,
            "fuel_pct": v.get("Fuel"),
            "driver_name": v.get("DriverName"),
            "address": v.get("Address"),
            "vehicle_type": v.get("VehicleType"),
            "capacity": v.get("SheeatsOrTons"),
            "km_today": v.get("TripKm"),
            "km_total": v.get("Km"),
            "time_update": v.get("TimeUpdate"),
            "is_stop": is_stop,
            "is_overspeed": is_overspeed,
            "stop_time": v.get("StopTime"),
            "stop_counter": v.get("StopCounter"),
            "day_driving_time": v.get("DayDrivingTime"),
            "status": status,
            # ERP enrichment
            "xe_id": xe_erp.id if xe_erp else None,
            "loai_xe_erp": xe_erp.loai_xe if xe_erp else None,
            "trong_tai": float(xe_erp.trong_tai) if xe_erp and xe_erp.trong_tai else None,
            "dinh_muc_dau": float(xe_erp.dinh_muc_dau) if xe_erp and xe_erp.dinh_muc_dau else None,
        })

    # Sort: moving first, then stopped, then overspeed
    order = {"moving": 0, "overspeed": 1, "stopped": 2}
    vehicles.sort(key=lambda x: order.get(x["status"], 3))

    # Auto-save snapshots (throttled to 30 phút/xe)
    _try_save_snapshots(vehicles, db)

    return {
        "vehicles": vehicles,
        "total": len(vehicles),
        "moving": sum(1 for v in vehicles if v["status"] == "moving"),
        "stopped": sum(1 for v in vehicles if v["status"] == "stopped"),
        "overspeed": sum(1 for v in vehicles if v["status"] == "overspeed"),
        "cache_age_seconds": round(time.time() - _cache["ts"]),
    }


@router.get("/vehicles/refresh")
async def refresh_gps_cache(_user=Depends(get_current_user)):
    """Xóa cache, buộc fetch mới từ GPS API."""
    _cache["data"] = None
    _cache["ts"] = 0.0
    return {"message": "Cache đã được xóa, lần fetch tiếp sẽ lấy dữ liệu mới"}


@router.get("/km-report")
def get_km_report(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Báo cáo km thực tế từng xe theo từng ngày.

    Dùng max(km_today) per ngày nhưng lọc outlier (>= 999 km/ngày là bất khả thi với xe tải).
    Một số thiết bị GPS Bình Minh báo sai TripKm (ví dụ: 64589 km), cần loại bỏ.
    """
    # valid_km: chỉ chấp nhận km_today hợp lệ (< 999 km/ngày)
    valid_km = case((GpsSnapshot.km_today < 999, GpsSnapshot.km_today), else_=None)
    rows = (
        db.query(
            GpsSnapshot.bien_so,
            GpsSnapshot.xe_id,
            GpsSnapshot.ngay,
            func.max(valid_km).label("km_ngay"),
            func.avg(GpsSnapshot.fuel_pct).label("fuel_avg"),
            func.max(GpsSnapshot.km_total).label("km_total_max"),
            func.count(GpsSnapshot.id).label("so_snapshot"),
        )
        .filter(
            GpsSnapshot.ngay >= from_date,
            GpsSnapshot.ngay <= to_date,
        )
        .group_by(GpsSnapshot.bien_so, GpsSnapshot.xe_id, GpsSnapshot.ngay)
        .order_by(GpsSnapshot.ngay.desc(), GpsSnapshot.bien_so)
        .all()
    )

    return [
        {
            "bien_so": r.bien_so,
            "xe_id": r.xe_id,
            "ngay": r.ngay.isoformat(),
            "km_ngay": round(r.km_ngay or 0, 1),
            "fuel_avg": round(r.fuel_avg or 0, 1),
            "km_total_max": round(r.km_total_max or 0, 0),
            "so_snapshot": r.so_snapshot,
        }
        for r in rows
    ]


@router.get("/km-summary")
def get_km_summary(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Tổng hợp km theo xe trong kỳ — sum(max valid km_today per day).

    Lọc outlier: km_today >= 999 bị bỏ qua (một số GPS Bình Minh báo sai TripKm).
    """
    valid_km = case((GpsSnapshot.km_today < 999, GpsSnapshot.km_today), else_=None)
    # Subquery: max valid km_today per (bien_so, ngay)
    sub = (
        db.query(
            GpsSnapshot.bien_so,
            GpsSnapshot.xe_id,
            GpsSnapshot.ngay,
            func.max(valid_km).label("km_ngay"),
            func.avg(GpsSnapshot.fuel_pct).label("fuel_avg"),
        )
        .filter(
            GpsSnapshot.ngay >= from_date,
            GpsSnapshot.ngay <= to_date,
        )
        .group_by(GpsSnapshot.bien_so, GpsSnapshot.xe_id, GpsSnapshot.ngay)
        .subquery()
    )

    rows = (
        db.query(
            sub.c.bien_so,
            sub.c.xe_id,
            func.sum(sub.c.km_ngay).label("km_tong"),
            func.avg(sub.c.fuel_avg).label("fuel_avg"),
            func.count(sub.c.ngay).label("so_ngay"),
            func.max(sub.c.ngay).label("ngay_cuoi_gps"),
        )
        .group_by(sub.c.bien_so, sub.c.xe_id)
        .order_by(func.sum(sub.c.km_ngay).desc())
        .all()
    )

    return [
        {
            "bien_so": r.bien_so,
            "xe_id": r.xe_id,
            "km_tong": round(r.km_tong or 0, 1),
            "fuel_avg": round(r.fuel_avg or 0, 1),
            "so_ngay": r.so_ngay,
            "ngay_cuoi_gps": r.ngay_cuoi_gps.isoformat() if r.ngay_cuoi_gps else None,
        }
        for r in rows
    ]


@router.get("/km-by-date")
def get_km_by_date(
    xe_id: int = Query(...),
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Km theo từng ngày của một xe — dùng cho biểu đồ."""
    valid_km = case((GpsSnapshot.km_today < 999, GpsSnapshot.km_today), else_=None)
    rows = (
        db.query(
            GpsSnapshot.ngay,
            func.max(valid_km).label("km_ngay"),
            func.avg(GpsSnapshot.fuel_pct).label("fuel_avg"),
        )
        .filter(
            GpsSnapshot.xe_id == xe_id,
            GpsSnapshot.ngay >= from_date,
            GpsSnapshot.ngay <= to_date,
        )
        .group_by(GpsSnapshot.ngay)
        .order_by(GpsSnapshot.ngay)
        .all()
    )
    return [
        {"ngay": r.ngay.isoformat(), "km_ngay": round(r.km_ngay or 0, 1), "fuel_avg": round(r.fuel_avg or 0, 1)}
        for r in rows
    ]


@router.get("/fuel-comparison")
def get_fuel_comparison(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Đối chiếu xăng GPS vs FuelLog.

    km_GPS × định mức (L/100km) / 100 = dầu lý thuyết.
    So với lít đổ thực tế từ FuelLog. Cảnh báo khi chênh lệch > 10%.
    """
    from app.models.hr import FuelLog

    # GPS km per bien_so in period — lọc outlier km_today >= 999 (GPS thiết bị lỗi)
    valid_km = case((GpsSnapshot.km_today < 999, GpsSnapshot.km_today), else_=None)
    daily_sub = (
        db.query(
            GpsSnapshot.bien_so,
            GpsSnapshot.ngay,
            func.max(valid_km).label("km_ngay"),
        )
        .filter(
            GpsSnapshot.ngay >= from_date,
            GpsSnapshot.ngay <= to_date,
        )
        .group_by(GpsSnapshot.bien_so, GpsSnapshot.ngay)
        .subquery()
    )
    km_rows = (
        db.query(daily_sub.c.bien_so, func.sum(daily_sub.c.km_ngay).label("km_gps"))
        .group_by(daily_sub.c.bien_so)
        .all()
    )
    km_map: dict[str, float] = {r.bien_so: float(r.km_gps or 0) for r in km_rows}

    if not km_map:
        return []

    # Match GPS plate → ERP Xe bằng bien_so chuẩn hóa
    all_xe = db.query(Xe).all()
    plate_to_xe: dict[str, Xe] = {_normalize_plate(xe.bien_so): xe for xe in all_xe}

    # Lấy xe_id từ các xe đã match để tra FuelLog
    xe_for_fuel: dict[int, str] = {}  # xe_id → GPS plate
    for plate in km_map:
        xe = plate_to_xe.get(_normalize_plate(plate))
        if xe:
            xe_for_fuel[xe.id] = plate

    fuel_map: dict[int, float] = {}  # xe_id → liters
    if xe_for_fuel:
        fuel_rows = (
            db.query(FuelLog.xe_id, func.sum(FuelLog.so_lit_dau).label("so_lit"))
            .filter(
                FuelLog.xe_id.in_(list(xe_for_fuel.keys())),
                FuelLog.ngay_do >= from_date,
                FuelLog.ngay_do <= to_date,
            )
            .group_by(FuelLog.xe_id)
            .all()
        )
        fuel_map = {r.xe_id: float(r.so_lit or 0) for r in fuel_rows}

    results = []
    for plate, km_gps in km_map.items():
        xe = plate_to_xe.get(_normalize_plate(plate))
        xe_id = xe.id if xe else None
        dinh_muc = float(xe.dinh_muc_dau or 0) if xe else 0
        dau_thuc_te = fuel_map.get(xe_id, 0) if xe_id else 0

        dau_ly_thuyet = (km_gps * dinh_muc / 100) if dinh_muc > 0 and km_gps > 0 else None
        chenh_lech_lit = (dau_thuc_te - dau_ly_thuyet) if dau_ly_thuyet is not None else None
        chenh_lech_pct = (chenh_lech_lit / dau_ly_thuyet * 100) if chenh_lech_lit is not None and dau_ly_thuyet else None

        if chenh_lech_pct is None:
            canh_bao = "no_data"
        elif abs(chenh_lech_pct) > 10:
            canh_bao = "danger"
        elif abs(chenh_lech_pct) > 5:
            canh_bao = "warning"
        else:
            canh_bao = "ok"

        results.append({
            "xe_id": xe_id,
            "bien_so": plate,
            "loai_xe": xe.loai_xe if xe else None,
            "dinh_muc_dau": dinh_muc,
            "km_gps": round(km_gps, 1),
            "dau_ly_thuyet": round(dau_ly_thuyet, 1) if dau_ly_thuyet else None,
            "dau_thuc_te": round(dau_thuc_te, 1),
            "chenh_lech_lit": round(chenh_lech_lit, 1) if chenh_lech_lit is not None else None,
            "chenh_lech_pct": round(chenh_lech_pct, 1) if chenh_lech_pct is not None else None,
            "canh_bao": canh_bao,
        })

    results.sort(key=lambda x: abs(x["chenh_lech_pct"] or 0), reverse=True)
    return results


@router.get("/maintenance-alerts")
def get_maintenance_alerts(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Cảnh báo bảo dưỡng theo km GPS.

    Mỗi xe: km_hien_tai (max km_total từ snapshot) so với km lần bảo dưỡng tiếp theo.
    """
    # Max km_total per bien_so — fallback khi xe_id chưa liên kết ERP
    km_rows = (
        db.query(GpsSnapshot.bien_so, func.max(GpsSnapshot.km_total).label("km_hien_tai"))
        .filter(GpsSnapshot.km_total > 0)
        .group_by(GpsSnapshot.bien_so)
        .all()
    )
    km_by_plate: dict[str, float] = {r.bien_so: float(r.km_hien_tai or 0) for r in km_rows}

    # ERP Xe — match by normalized plate
    all_xe = db.query(Xe).filter(Xe.trang_thai == True).all()
    plate_to_xe: dict[str, Xe] = {_normalize_plate(xe.bien_so): xe for xe in all_xe}

    results = []
    seen_plates: set[str] = set()

    # 1. GPS plates (có dữ liệu km thực)
    for plate, km_hien_tai in km_by_plate.items():
        seen_plates.add(_normalize_plate(plate))
        xe = plate_to_xe.get(_normalize_plate(plate))
        xe_id = xe.id if xe else None
        loai_xe = xe.loai_xe if xe else None
        ky = int(xe.km_bao_duong_dinh_ky or 5000) if xe else 5000
        gan_nhat = float(xe.km_bao_duong_gan_nhat or 0) if xe else 0

        km_tiep_theo = gan_nhat + ky
        km_con_lai = km_tiep_theo - km_hien_tai

        if km_con_lai < 0:
            alert = "overdue"
        elif km_con_lai < 500:
            alert = "danger"
        elif km_con_lai < 1000:
            alert = "warning"
        else:
            alert = "ok"

        results.append({
            "xe_id": xe_id,
            "bien_so": plate,
            "loai_xe": loai_xe,
            "km_hien_tai": round(km_hien_tai),
            "km_bao_duong_gan_nhat": gan_nhat,
            "km_bao_duong_dinh_ky": ky,
            "km_tiep_theo": round(km_tiep_theo),
            "km_con_lai": round(km_con_lai),
            "alert": alert,
        })

    # 2. ERP xe không có GPS data
    for xe in all_xe:
        if _normalize_plate(xe.bien_so) not in seen_plates:
            ky = int(xe.km_bao_duong_dinh_ky or 5000)
            gan_nhat = float(xe.km_bao_duong_gan_nhat or 0)
            results.append({
                "xe_id": xe.id,
                "bien_so": xe.bien_so,
                "loai_xe": xe.loai_xe,
                "km_hien_tai": 0,
                "km_bao_duong_gan_nhat": gan_nhat,
                "km_bao_duong_dinh_ky": ky,
                "km_tiep_theo": round(gan_nhat + ky),
                "km_con_lai": round(gan_nhat + ky),
                "alert": "no_data",
            })

    results.sort(key=lambda x: x["km_con_lai"])
    return results


_VN = timezone(timedelta(hours=7))


def to_vn(dt: datetime | None):
    """Convert UTC datetime → Vietnam time (UTC+7), timezone-aware."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_VN)


def _match_fuel_log(
    spike_ts,
    fl_list: list,
    already_matched: set,
    max_hours: int = 2,
):
    """Match GPS spike tới FuelLog gần nhất về thời gian (≤ max_hours), chưa matched.

    Trả về (index, FuelLog) hoặc None nếu không tìm được.
    """
    best_idx, best_fl, best_diff = None, None, timedelta(hours=max_hours)
    for i, fl in enumerate(fl_list):
        if i in already_matched:
            continue
        fl_ts = to_vn(fl.created_at)
        if fl_ts is None:
            continue
        diff = abs(spike_ts - fl_ts)
        if diff <= best_diff:
            best_diff = diff
            best_idx = i
            best_fl = fl
    return (best_idx, best_fl) if best_fl is not None else None


@router.get("/daily-detail")
def get_daily_detail(
    from_date: date = Query(...),
    to_date: date = Query(...),
    bien_so: str | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Nhật ký xe theo ngày: công tơ mét đầu/cuối ngày, dầu GPS theo timeline.

    Mỗi dòng = 1 xe × 1 ngày, gồm:
    - Giờ + công tơ + dầu% đầu ngày (snapshot đầu tiên)
    - Giờ + công tơ + dầu% cuối ngày (snapshot cuối cùng)
    - Km chạy = congto_cuoi - congto_dau
    - FuelLog cùng ngày: dầu% snapshot gần nhất trước/sau lúc nhập log
    """
    if (to_date - from_date).days > 31:
        raise HTTPException(400, "Khoảng thời gian tối đa 31 ngày cho nhật ký xe")

    from app.models.hr import FuelLog
    from collections import defaultdict

    def hhmm(dt: datetime | None) -> str | None:
        v = to_vn(dt)
        return v.strftime("%H:%M") if v else None

    # --- Snapshots ---
    snap_q = (
        db.query(GpsSnapshot)
        .filter(GpsSnapshot.ngay >= from_date, GpsSnapshot.ngay <= to_date)
    )
    if bien_so:
        snap_q = snap_q.filter(GpsSnapshot.bien_so == bien_so)
    all_snaps = snap_q.order_by(GpsSnapshot.bien_so, GpsSnapshot.created_at).all()

    if not all_snaps:
        return []

    # Group by (bien_so, ngay)
    groups: dict[tuple, list] = defaultdict(list)
    for s in all_snaps:
        groups[(s.bien_so, s.ngay)].append(s)

    # Index snapshots for FuelLog matching: plate_norm → sorted list by vn_ts
    snap_by_plate: dict[str, list[dict]] = defaultdict(list)
    for s in all_snaps:
        snap_by_plate[_normalize_plate(s.bien_so)].append({
            "vn_ts": to_vn(s.created_at),
            "fuel_pct": s.fuel_pct,
            "km_total": s.km_total,
        })

    def nearest_before(plate_norm: str, ts):
        """Snapshot gần nhất TRƯỚC thời điểm ts."""
        candidates = [x for x in snap_by_plate.get(plate_norm, []) if x["vn_ts"] <= ts]
        return candidates[-1] if candidates else None

    def nearest_after(plate_norm: str, ts):
        """Snapshot gần nhất SAU thời điểm ts."""
        candidates = [x for x in snap_by_plate.get(plate_norm, []) if x["vn_ts"] > ts]
        return candidates[0] if candidates else None

    # --- Xe lookup (1 query dùng chung cho FuelLog mapping và định mức dầu) ---
    all_xe = db.query(Xe).all()
    all_xe_map: dict[int, str] = {xe.id: xe.bien_so for xe in all_xe}
    xe_dinh_muc: dict[str, float] = {
        _normalize_plate(xe.bien_so): float(xe.dinh_muc_dau)
        for xe in all_xe
        if xe.dinh_muc_dau and float(xe.dinh_muc_dau) > 0
    }

    # --- FuelLog ---
    fl_q = (
        db.query(FuelLog)
        .filter(FuelLog.ngay_do >= from_date, FuelLog.ngay_do <= to_date)
        .order_by(FuelLog.ngay_do, FuelLog.created_at)
    )
    if bien_so:
        # Khi lọc biển số cụ thể: chỉ load FuelLog của xe đó, tránh full scan
        pnorm_target = _normalize_plate(bien_so)
        xe_target = next((x for x in all_xe if _normalize_plate(x.bien_so) == pnorm_target), None)
        fl_q = fl_q.filter(FuelLog.xe_id == xe_target.id) if xe_target else fl_q.filter(False)
    fl_rows = fl_q.all()
    fl_by_key: dict[tuple, list] = defaultdict(list)
    for fl in fl_rows:
        b = all_xe_map.get(fl.xe_id) if fl.xe_id else None
        if b:
            fl_by_key[(_normalize_plate(b), fl.ngay_do)].append(fl)

    # --- Build result ---
    results = []
    for (plate, ngay), snaps in sorted(groups.items()):
        first, last = snaps[0], snaps[-1]
        # km_today (TripKm) reset hàng ngày — chính xác hơn km_total khi GPS device bị thay/reset.
        # Lấy max trong ngày, lọc outlier >999 km (GPS Bình Minh báo sai).
        km_chay = max(
            (s.km_today for s in snaps if 0 < s.km_today < 999),
            default=max(0.0, last.km_total - first.km_total),
        )

        pnorm = _normalize_plate(plate)

        # GPS spike detection: quét consecutive snapshots tìm tăng dầu đột biến
        gps_spikes = []
        for i in range(len(snaps) - 1):
            delta = snaps[i + 1].fuel_pct - snaps[i].fuel_pct
            if delta >= FUEL_SPIKE_THRESHOLD:
                gps_spikes.append({
                    "spike_ts": to_vn(snaps[i + 1].created_at),
                    "dau_truoc": round(snaps[i].fuel_pct, 1),
                    "dau_sau": round(snaps[i + 1].fuel_pct, 1),
                    "so_lit_gps": round(delta, 1),
                    "congto": round(snaps[i + 1].km_total, 1),
                })

        fl_list = sorted(
            fl_by_key.get((pnorm, ngay), []),
            key=lambda f: f.created_at or datetime.min.replace(tzinfo=timezone.utc),
        )
        fuel_events = []

        if gps_spikes:
            # Primary: GPS spike — match với FuelLog gần nhất về thời gian (±2h), không theo index.
            # Positional matching (cũ) sai khi GPS phát hiện spike 08:00+14:00 nhưng FuelLog ghi 13:30.
            matched_fl_indices: set[int] = set()
            for ge in gps_spikes:
                match = _match_fuel_log(ge["spike_ts"], fl_list, matched_fl_indices, max_hours=2)
                if match:
                    fl_idx, fl = match
                    matched_fl_indices.add(fl_idx)
                    fl_lit = float(fl.so_lit_dau or 0)
                else:
                    fl = None
                    fl_lit = None
                fuel_events.append({
                    "id": fl.id if fl else None,
                    "gio_do": ge["spike_ts"].strftime("%H:%M"),
                    "so_lit": ge["so_lit_gps"],        # GPS delta — có thập phân (9,5L)
                    "so_lit_fuellog": fl_lit,          # Nhập tay để đối chiếu
                    "don_gia": float(fl.don_gia or 0) if fl else 0,
                    "ghi_chu": fl.ghi_chu if fl else None,
                    "dau_truoc_pct": ge["dau_truoc"],
                    "dau_sau_pct": ge["dau_sau"],
                    "congto_luc_do": ge["congto"],
                })
            # FuelLog dư (không match spike nào) — không có GPS spike tương ứng
            for i, fl in enumerate(fl_list):
                if i in matched_fl_indices:
                    continue
                fl_ts = to_vn(fl.created_at)
                sb = nearest_before(pnorm, fl_ts)
                sa = nearest_after(pnorm, fl_ts)
                fuel_events.append({
                    "id": fl.id,
                    "gio_do": hhmm(fl.created_at),
                    "so_lit": float(fl.so_lit_dau or 0),
                    "so_lit_fuellog": None,
                    "don_gia": float(fl.don_gia or 0),
                    "ghi_chu": fl.ghi_chu,
                    "dau_truoc_pct": round(sb["fuel_pct"], 1) if sb else None,
                    "dau_sau_pct": round(sa["fuel_pct"], 1) if sa else None,
                    "congto_luc_do": round(sb["km_total"], 1) if sb else None,
                })
        else:
            # Fallback: GPS không phát hiện spike — dùng FuelLog (existing logic)
            for fl in fl_list:
                fl_ts = to_vn(fl.created_at)
                sb = nearest_before(pnorm, fl_ts)
                sa = nearest_after(pnorm, fl_ts)
                fuel_events.append({
                    "id": fl.id,
                    "gio_do": hhmm(fl.created_at),
                    "so_lit": float(fl.so_lit_dau or 0),
                    "so_lit_fuellog": None,
                    "don_gia": float(fl.don_gia or 0),
                    "ghi_chu": fl.ghi_chu,
                    "dau_truoc_pct": round(sb["fuel_pct"], 1) if sb else None,
                    "dau_sau_pct": round(sa["fuel_pct"], 1) if sa else None,
                    "congto_luc_do": round(sb["km_total"], 1) if sb else None,
                })

        # Sort fuel_events theo thời gian (GPS spikes đã đúng thứ tự, nhưng FuelLog dư có thể chen vào)
        fuel_events.sort(key=lambda e: e.get("gio_do") or "99:99")

        # --- Drain detection: phát hiện hụt dầu bất thường ---
        dinh_muc = xe_dinh_muc.get(pnorm, 0)
        drain_events = []
        for i in range(len(snaps) - 1):
            delta = snaps[i + 1].fuel_pct - snaps[i].fuel_pct
            if delta >= -DRAIN_THRESHOLD:
                continue
            drop = abs(delta)

            # Khoảng cách thời gian thực giữa 2 snapshot (GPS có thể mất tín hiệu → gap > 5 phút)
            t0 = snaps[i].created_at
            t1 = snaps[i + 1].created_at
            if t0.tzinfo is None:
                t0 = t0.replace(tzinfo=timezone.utc)
            if t1.tzinfo is None:
                t1 = t1.replace(tzinfo=timezone.utc)
            elapsed_min = max(1.0, (t1 - t0).total_seconds() / 60)
            drain_rate = round(drop / (elapsed_min / 60), 1)  # L/h

            d_km = max(0.0, snaps[i + 1].km_total - snaps[i].km_total)
            stopped = snaps[i + 1].is_stop or snaps[i + 1].speed < 5
            expected = (d_km * dinh_muc / 100) if dinh_muc > 0 and d_km > 0 else 0

            if stopped and d_km < 1:
                # Hụt khi xe dừng — chỉ flag nếu tốc độ hụt > 10L/h (idle bình thường ~2-4L/h).
                # Tránh false positive khi GPS mất tín hiệu 30 phút (drop / 0.5h = 16L/h nếu drop=8L).
                if drain_rate < 10:
                    continue
                phan_loai_drain = "rut_khi_dung"
                muc_canh_bao = "cao" if drop >= 15 else "trung_binh"
            elif expected > 0 and drop > expected * DRAIN_WHILE_MOVING_FACTOR:
                # Tiêu hao cao hơn định mức × hệ số khi đang di chuyển
                phan_loai_drain = "tieu_hao_bat_thuong"
                muc_canh_bao = "cao" if drop > expected * 3 else "trung_binh"
            else:
                continue  # Tiêu hao bình thường, bỏ qua

            drain_events.append({
                "gio_bat_dau": hhmm(snaps[i].created_at),
                "gio_ket_thuc": hhmm(snaps[i + 1].created_at),
                "fuel_truoc": round(snaps[i].fuel_pct, 1),
                "fuel_sau": round(snaps[i + 1].fuel_pct, 1),
                "so_lit_hut": round(drop, 1),
                "du_kien_lit": round(expected, 1) if expected > 0 else None,
                "delta_km": round(d_km, 1),
                "xe_dung": stopped,
                "phan_loai": phan_loai_drain,
                "muc_canh_bao": muc_canh_bao,
                "elapsed_minutes": round(elapsed_min, 1),
                "drain_rate_L_per_h": drain_rate,
                # Địa điểm xe lúc phát hiện hụt — snapshot sau thường chính xác hơn
                "dia_diem": snaps[i + 1].address or snaps[i].address or None,
            })

        # Lượng dầu tiêu hao thực tế trong ngày = dầu đầu - dầu cuối + tổng đổ
        fill_total = sum(e["so_lit"] for e in fuel_events)
        fuel_tieu_hao = round(max(0.0, first.fuel_pct - last.fuel_pct + fill_total), 1)
        fuel_ly_thuyet = round(km_chay * dinh_muc / 100, 1) if dinh_muc > 0 and km_chay > 0 else None

        actual_per_100 = round(fuel_tieu_hao * 100 / km_chay, 1) if km_chay > 0 and fuel_tieu_hao > 0 else None
        results.append({
            "bien_so": plate,
            "ngay": ngay.isoformat(),
            "gio_dau": hhmm(first.created_at),
            "gio_cuoi": hhmm(last.created_at),
            "congto_dau": round(first.km_total, 1),
            "congto_cuoi": round(last.km_total, 1),
            "km_chay": round(km_chay, 1),
            "dau_dau_pct": round(first.fuel_pct, 1),
            "dau_cuoi_pct": round(last.fuel_pct, 1),
            "so_snapshot": len(snaps),
            "dinh_muc_dau": dinh_muc,         # L/100km theo ERP
            "fuel_tieu_hao": fuel_tieu_hao,
            "fuel_ly_thuyet": fuel_ly_thuyet,
            "tieu_hao_per_100": actual_per_100, # L/100km thực tế GPS
            "fuel_events": fuel_events,
            "drain_events": drain_events,
        })

    return results


@router.get("/drain-alerts")
def get_drain_alerts(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    bien_so: str | None = Query(None),
    trang_thai: str | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Liệt kê lịch sử cảnh báo rút dầu với filter và workflow state."""
    q = db.query(DrainAlertLog)
    if from_date:
        q = q.filter(DrainAlertLog.ngay >= from_date)
    if to_date:
        q = q.filter(DrainAlertLog.ngay <= to_date)
    if bien_so:
        q = q.filter(DrainAlertLog.bien_so.ilike(f"%{bien_so}%"))
    if trang_thai:
        q = q.filter(DrainAlertLog.trang_thai == trang_thai)
    rows = q.order_by(DrainAlertLog.ngay.desc(), DrainAlertLog.id.desc()).limit(500).all()
    return [
        {
            "id": r.id,
            "bien_so": r.bien_so,
            "xe_id": r.xe_id,
            "ngay": r.ngay.isoformat(),
            "gio": r.gio.isoformat() if r.gio else None,
            "so_lit": r.so_lit,
            "drain_rate_L_per_h": r.drain_rate_L_per_h,
            "dia_diem": r.dia_diem,
            "phan_loai": r.phan_loai,
            "muc_canh_bao": r.muc_canh_bao,
            "trang_thai": r.trang_thai,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.put("/drain-alerts/{alert_id}")
def update_drain_alert(
    alert_id: int,
    trang_thai: str = Query(..., description="moi | dang_xu_ly | da_xu_ly"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Cập nhật trạng thái xử lý của một cảnh báo rút dầu."""
    VALID = {"moi", "dang_xu_ly", "da_xu_ly"}
    if trang_thai not in VALID:
        raise HTTPException(400, f"trang_thai phải là một trong: {', '.join(VALID)}")
    alert = db.query(DrainAlertLog).filter(DrainAlertLog.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Không tìm thấy cảnh báo")
    alert.trang_thai = trang_thai
    db.commit()
    db.refresh(alert)
    return {
        "id": alert.id,
        "bien_so": alert.bien_so,
        "ngay": alert.ngay.isoformat(),
        "so_lit": alert.so_lit,
        "phan_loai": alert.phan_loai,
        "muc_canh_bao": alert.muc_canh_bao,
        "trang_thai": alert.trang_thai,
    }
