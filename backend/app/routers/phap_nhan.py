from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.master import PhapNhan

router = APIRouter(prefix="/api/phap-nhan", tags=["phap-nhan"])


class PhapNhanCreate(BaseModel):
    ma_phap_nhan: str
    ten_phap_nhan: str
    ten_viet_tat: Optional[str] = None
    ma_so_thue: Optional[str] = None
    dia_chi: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    tai_khoan: Optional[str] = None
    ngan_hang: Optional[str] = None
    ky_hieu_hd: Optional[str] = None
    trang_thai: bool = True


def _to_dict(p: PhapNhan) -> dict:
    return {
        "id": p.id,
        "ma_phap_nhan": p.ma_phap_nhan,
        "ten_phap_nhan": p.ten_phap_nhan,
        "ten_viet_tat": p.ten_viet_tat,
        "ma_so_thue": p.ma_so_thue,
        "dia_chi": p.dia_chi,
        "so_dien_thoai": p.so_dien_thoai,
        "tai_khoan": p.tai_khoan,
        "ngan_hang": p.ngan_hang,
        "ky_hieu_hd": p.ky_hieu_hd,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/")
def list_phap_nhan(active_only: bool = False, db: Session = Depends(get_db)):
    q = db.query(PhapNhan).order_by(PhapNhan.ma_phap_nhan)
    if active_only:
        q = q.filter(PhapNhan.trang_thai == True)
    return [_to_dict(p) for p in q.all()]


@router.post("/")
def create_phap_nhan(body: PhapNhanCreate, db: Session = Depends(get_db)):
    if db.query(PhapNhan).filter(PhapNhan.ma_phap_nhan == body.ma_phap_nhan).first():
        raise HTTPException(400, "Mã pháp nhân đã tồn tại")
    p = PhapNhan(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_dict(p)


@router.put("/{id}")
def update_phap_nhan(id: int, body: PhapNhanCreate, db: Session = Depends(get_db)):
    p = db.get(PhapNhan, id)
    if not p:
        raise HTTPException(404, "Không tìm thấy")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _to_dict(p)


@router.delete("/{id}")
def delete_phap_nhan(id: int, db: Session = Depends(get_db)):
    p = db.get(PhapNhan, id)
    if not p:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(p)
    db.commit()
    return {"ok": True}
