import time
import logging
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.master import Xe

logger = logging.getLogger("erp.gps")

router = APIRouter(prefix="/api/gps", tags=["GPS"])

# In-memory cache: (data, timestamp)
_cache: dict = {"data": None, "ts": 0.0}
CACHE_TTL = 30  # seconds


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
