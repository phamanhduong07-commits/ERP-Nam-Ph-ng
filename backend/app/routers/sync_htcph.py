from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_admin_user
from app.models.import_log import ImportLog
from app.services.htcph_sync import sync_products

router = APIRouter(prefix="/api/sync-htcph", tags=["Sync HTCPH"])


@router.post("/products")
def trigger_sync_products(
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    try:
        result = sync_products(db)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
def get_sync_logs(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    logs = (
        db.query(ImportLog)
        .filter(ImportLog.loai_du_lieu == "htcph_products")
        .order_by(ImportLog.thoi_gian.desc())
        .limit(10)
        .all()
    )
    return [log.to_dict() for log in logs]


@router.get("/status")
def get_sync_status(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    last_log = (
        db.query(ImportLog)
        .filter(ImportLog.loai_du_lieu == "htcph_products")
        .order_by(ImportLog.thoi_gian.desc())
        .first()
    )
    if not last_log:
        return {"last_sync": None, "status": "never"}
    return {"last_sync": last_log.thoi_gian, "status": "ok", "result": last_log.to_dict()}
