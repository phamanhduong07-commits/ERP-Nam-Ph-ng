"""
Router: Ghi nhận tạm dừng máy trong ca sản xuất
POST /api/may-dung-log            — tạo log (bấm tạm dừng)
PUT  /api/may-dung-log/{id}/tiep-tuc — cập nhật giờ tiếp tục
GET  /api/may-dung-log            — danh sách (báo cáo)
"""
from datetime import date, datetime, time as time_type
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.production import MayDungLog
from app.deps import get_current_user
from app.models.auth import User

router = APIRouter(prefix="/may-dung-log", tags=["Máy dừng log"])

LY_DO_LABELS = {
    "hong_may":        "Hỏng máy",
    "het_nguyen_lieu": "Hết nguyên liệu",
    "nghi_giai_lao":   "Nghỉ giải lao",
    "giao_ca":         "Giao ca",
    "khac":            "Khác",
}


class MayDungCreate(BaseModel):
    production_order_id: int
    phan_xuong_id: Optional[int] = None
    ngay: date
    gio_bat_dau_dung: str          # "HH:MM"
    ly_do: str = "khac"
    ghi_chu: Optional[str] = None


class MayDungTiepTuc(BaseModel):
    gio_tiep_tuc: str              # "HH:MM"


def _to_dict(r: MayDungLog) -> dict:
    def fmt_time(t) -> str | None:
        return t.strftime("%H:%M") if t else None

    return {
        "id":                   r.id,
        "production_order_id":  r.production_order_id,
        "so_lenh":              r.production_order.so_lenh if r.production_order else None,
        "phan_xuong_id":        r.phan_xuong_id,
        "ten_phan_xuong":       r.phan_xuong.ten_xuong if r.phan_xuong else None,
        "ngay":                 r.ngay.isoformat(),
        "gio_bat_dau_dung":     fmt_time(r.gio_bat_dau_dung),
        "gio_tiep_tuc":         fmt_time(r.gio_tiep_tuc),
        "thoi_gian_dung":       r.thoi_gian_dung,
        "ly_do":                r.ly_do,
        "ten_ly_do":            LY_DO_LABELS.get(r.ly_do, r.ly_do),
        "ghi_chu":              r.ghi_chu,
        "created_by":           r.created_by,
        "ten_created_by":       r.creator.ho_ten if r.creator else None,
        "created_at":           r.created_at.isoformat() if r.created_at else None,
    }


def _parse_time(s: str) -> time_type:
    h, m = map(int, s.strip().split(":"))
    return time_type(h, m)


@router.post("", status_code=201)
def create_log(
    body: MayDungCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    log = MayDungLog(
        production_order_id=body.production_order_id,
        phan_xuong_id=body.phan_xuong_id,
        ngay=body.ngay,
        gio_bat_dau_dung=_parse_time(body.gio_bat_dau_dung),
        ly_do=body.ly_do,
        ghi_chu=body.ghi_chu,
        created_by=user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _load(log.id, db)


@router.put("/{log_id}/tiep-tuc")
def tiep_tuc(
    log_id: int,
    body: MayDungTiepTuc,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    log = db.query(MayDungLog).filter(MayDungLog.id == log_id).first()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(404, "Không tìm thấy log")
    log.gio_tiep_tuc = _parse_time(body.gio_tiep_tuc)
    # Tính thời gian dừng (phút)
    bd = datetime.combine(log.ngay, log.gio_bat_dau_dung)
    kt = datetime.combine(log.ngay, log.gio_tiep_tuc)
    diff = int((kt - bd).total_seconds() / 60)
    log.thoi_gian_dung = max(0, diff)
    db.commit()
    return _load(log.id, db)


@router.get("")
def list_logs(
    production_order_id: Optional[int] = None,
    phan_xuong_id: Optional[int] = None,
    tu_ngay: Optional[date] = Query(default=None),
    den_ngay: Optional[date] = Query(default=None),
    ly_do: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MayDungLog).options(
        joinedload(MayDungLog.production_order),
        joinedload(MayDungLog.phan_xuong),
        joinedload(MayDungLog.creator),
    )
    if production_order_id:
        q = q.filter(MayDungLog.production_order_id == production_order_id)
    if phan_xuong_id:
        q = q.filter(MayDungLog.phan_xuong_id == phan_xuong_id)
    if tu_ngay:
        q = q.filter(MayDungLog.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(MayDungLog.ngay <= den_ngay)
    if ly_do:
        q = q.filter(MayDungLog.ly_do == ly_do)
    logs = q.order_by(MayDungLog.ngay.desc(), MayDungLog.gio_bat_dau_dung.desc()).all()
    return [_to_dict(r) for r in logs]


def _load(log_id: int, db: Session) -> dict:
    log = db.query(MayDungLog).options(
        joinedload(MayDungLog.production_order),
        joinedload(MayDungLog.phan_xuong),
        joinedload(MayDungLog.creator),
    ).filter(MayDungLog.id == log_id).first()
    return _to_dict(log)
