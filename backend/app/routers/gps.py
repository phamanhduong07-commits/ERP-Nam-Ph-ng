import time
import logging
from datetime import date, datetime, timedelta
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.master import Xe
from app.models.gps import GpsSnapshot

logger = logging.getLogger("erp.gps")

router = APIRouter(prefix="/api/gps", tags=["GPS"])

# In-memory cache: (data, timestamp)
_cache: dict = {"data": None, "ts": 0.0}
CACHE_TTL = 30  # seconds

# Throttle: plate → last snapshot saved timestamp
_snapshot_throttle: dict[str, float] = {}
SNAPSHOT_INTERVAL = 1800  # 30 phút


def _normalize_plate(plate: str) -> str:
    """Remove hyphens/spaces to allow matching '50H-34427' == '50H34427'."""
    return plate.upper().replace("-", "").replace(" ", "")


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

        to_insert.append(GpsSnapshot(
            bien_so=plate,
            xe_id=v.get("xe_id"),
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

    Mỗi ngày lấy max(km_today) — đây là số km xe đã chạy trong ngày đó.
    """
    rows = (
        db.query(
            GpsSnapshot.bien_so,
            GpsSnapshot.xe_id,
            GpsSnapshot.ngay,
            func.max(GpsSnapshot.km_today).label("km_ngay"),
            func.avg(GpsSnapshot.fuel_pct).label("fuel_avg"),
            func.max(GpsSnapshot.km_total).label("km_total_max"),
            func.min(GpsSnapshot.km_total).label("km_total_min"),
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
    """Tổng hợp km theo xe trong kỳ — sum(max km_today per day)."""
    # Subquery: max km_today per (bien_so, ngay)
    sub = (
        db.query(
            GpsSnapshot.bien_so,
            GpsSnapshot.xe_id,
            GpsSnapshot.ngay,
            func.max(GpsSnapshot.km_today).label("km_ngay"),
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
    rows = (
        db.query(
            GpsSnapshot.ngay,
            func.max(GpsSnapshot.km_today).label("km_ngay"),
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
