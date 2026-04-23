from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import TinhThanh

router = APIRouter(prefix="/api/tinh-thanh", tags=["tinh-thanh"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class TinhThanhBase(BaseModel):
    ma_tinh: str
    ten_tinh: str
    trang_thai: bool = True


class TinhThanhResponse(TinhThanhBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[TinhThanhResponse])
def list_tinh_thanh(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(TinhThanh).order_by(TinhThanh.ten_tinh).all()


@router.post("", response_model=TinhThanhResponse, status_code=201)
def create_tinh_thanh(
    data: TinhThanhBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(TinhThanh).filter(TinhThanh.ma_tinh == data.ma_tinh).first():
        raise HTTPException(status_code=400, detail=f"Mã tỉnh '{data.ma_tinh}' đã tồn tại")
    obj = TinhThanh(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=TinhThanhResponse)
def update_tinh_thanh(
    id: int,
    data: TinhThanhBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TinhThanh).filter(TinhThanh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy tỉnh thành")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_tinh_thanh(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TinhThanh).filter(TinhThanh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy tỉnh thành")
    db.delete(obj)
    db.commit()
    return {"ok": True}
