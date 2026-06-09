from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.danhmuc_chung import DieuKhoanThanhToan

router = APIRouter(prefix="/api/dieu-khoan-thanh-toan", tags=["dieu-khoan-thanh-toan"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class DieuKhoanThanhToanBase(BaseModel):
    ma_dktt: str
    ten_dktt: str
    so_ngay: int | None = None
    mo_ta: str | None = None
    trang_thai: bool = True


class DieuKhoanThanhToanResponse(DieuKhoanThanhToanBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[DieuKhoanThanhToanResponse])
def list_dieu_khoan_thanh_toan(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(DieuKhoanThanhToan).order_by(DieuKhoanThanhToan.ma_dktt).all()


@router.post("", response_model=DieuKhoanThanhToanResponse, status_code=201)
def create_dieu_khoan_thanh_toan(
    data: DieuKhoanThanhToanBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = DieuKhoanThanhToan(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=DieuKhoanThanhToanResponse)
def update_dieu_khoan_thanh_toan(
    id: int,
    data: DieuKhoanThanhToanBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DieuKhoanThanhToan).filter(DieuKhoanThanhToan.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy điều khoản thanh toán")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_dieu_khoan_thanh_toan(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DieuKhoanThanhToan).filter(DieuKhoanThanhToan.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy điều khoản thanh toán")
    db.delete(obj)
    db.commit()
    return {"ok": True}
