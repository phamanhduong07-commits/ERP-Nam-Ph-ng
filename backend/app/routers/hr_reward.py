from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from app.database import get_db
from app.models.hr import RewardDiscipline, Employee
from pydantic import BaseModel
from decimal import Decimal

router = APIRouter(prefix="/api/hr", tags=["HR Reward & Discipline"])

class RewardCreate(BaseModel):
    employee_id: int
    loai: str # khen_thuong | ky_luat
    hinh_thuc: str # thuong_tien | phat_tien | canh_cao
    so_tien: Decimal
    ly_do: str
    thang_ap_dung: int
    nam_ap_dung: int

@router.get("/rewards")
def list_rewards(db: Session = Depends(get_db)):
    items = db.query(RewardDiscipline).order_by(RewardDiscipline.created_at.desc()).all()
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "employee": {"ho_ten": item.employee.ho_ten, "ma_nv": item.employee.ma_nv},
            "ngay_quyet_dinh": item.ngay_quyet_dinh.isoformat(),
            "loai": item.loai,
            "hinh_thuc": item.hinh_thuc,
            "so_tien": item.so_tien,
            "ly_do": item.ly_do,
            "thang": item.thang_ap_dung,
            "nam": item.nam_ap_dung,
            "trang_thai": item.trang_thai
        })
    return result

@router.post("/rewards")
def create_reward(body: RewardCreate, db: Session = Depends(get_db)):
    db_obj = RewardDiscipline(**body.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return {"status": "success", "id": db_obj.id}

@router.put("/rewards/{id}/status")
def update_reward_status(id: int, status: str, db: Session = Depends(get_db)):
    item = db.query(RewardDiscipline).filter(RewardDiscipline.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")
    item.trang_thai = status
    db.commit()
    return {"status": "success"}
