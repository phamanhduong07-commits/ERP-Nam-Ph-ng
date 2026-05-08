import httpx
from fastapi import APIRouter, HTTPException
from app.deps import get_current_user
from fastapi import Depends
from app.models.auth import User

router = APIRouter(prefix="/api/mst-lookup", tags=["mst-lookup"])

VIETQR_URL = "https://api.vietqr.io/v2/business/{mst}"


@router.get("/{mst}")
async def lookup_mst(mst: str, _: User = Depends(get_current_user)):
    mst = mst.strip()
    if not mst or not mst.isdigit() or len(mst) not in (10, 13):
        raise HTTPException(400, "MST không hợp lệ (10 hoặc 13 chữ số)")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(VIETQR_URL.format(mst=mst))
            data = resp.json()
    except Exception as e:
        raise HTTPException(502, f"Không thể kết nối API tra cứu MST: {e}")

    if data.get("code") != "00" or not data.get("data"):
        raise HTTPException(404, "Không tìm thấy doanh nghiệp với MST này")

    d = data["data"]
    return {
        "name":      d.get("name", ""),
        "shortName": d.get("shortName", "") or "",
        "address":   d.get("address", "") or "",
        "status":    d.get("status", ""),
    }
