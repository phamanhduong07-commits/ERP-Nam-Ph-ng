"""
Router quản lý lịch sử import.
- GET /api/import-logs  — danh sách, lọc theo loại/ngày/người
- POST /api/import-logs — ghi log (gọi từ các router import)
"""
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.import_log import ImportLog

router = APIRouter(prefix="/api/import-logs", tags=["import-logs"])


@router.get("")
def list_import_logs(
    loai_du_lieu: Optional[str] = Query(None),
    tu_ngay: Optional[str] = Query(None),
    den_ngay: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ImportLog)
    if loai_du_lieu:
        q = q.filter(ImportLog.loai_du_lieu == loai_du_lieu)
    if user_id:
        q = q.filter(ImportLog.user_id == user_id)
    if tu_ngay:
        d_from = datetime.fromisoformat(tu_ngay)
        q = q.filter(ImportLog.thoi_gian >= d_from)
    if den_ngay:
        d_to = datetime.fromisoformat(den_ngay + "T23:59:59")
        q = q.filter(ImportLog.thoi_gian <= d_to)

    total = q.count()
    items = (
        q.order_by(ImportLog.thoi_gian.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [log.to_dict() for log in items],
    }


@router.post("", status_code=201)
def create_import_log(
    loai_du_lieu: str,
    ten_file: Optional[str] = None,
    so_dong_thanh_cong: int = 0,
    so_dong_loi: int = 0,
    so_dong_bo_qua: int = 0,
    chi_tiet_loi: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trang_thai = "success" if so_dong_loi == 0 else ("partial" if so_dong_thanh_cong > 0 else "failed")
    log = ImportLog(
        user_id=current_user.id,
        ten_nguoi_import=current_user.full_name or current_user.username,
        loai_du_lieu=loai_du_lieu,
        ten_file=ten_file,
        so_dong_thanh_cong=so_dong_thanh_cong,
        so_dong_loi=so_dong_loi,
        so_dong_bo_qua=so_dong_bo_qua,
        trang_thai=trang_thai,
        chi_tiet_loi=chi_tiet_loi,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log.to_dict()


@router.delete("/{log_id}", status_code=204)
def delete_import_log(
    log_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    log = db.query(ImportLog).filter(ImportLog.id == log_id).first()
    if log:
        db.delete(log)
        db.commit()
