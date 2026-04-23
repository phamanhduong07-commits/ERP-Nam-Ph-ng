from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import ViTri

router = APIRouter(prefix="/api/vi-tri", tags=["vi-tri"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ViTriBase(BaseModel):
    ma_vi_tri: str
    ten_vi_tri: str
    loai: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class ViTriResponse(ViTriBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[ViTriResponse])
def list_vi_tri(
    loai: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ViTri)
    if loai:
        q = q.filter(ViTri.loai == loai)
    return q.order_by(ViTri.ma_vi_tri).all()


@router.post("", response_model=ViTriResponse, status_code=201)
def create_vi_tri(
    data: ViTriBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(ViTri).filter(ViTri.ma_vi_tri == data.ma_vi_tri).first():
        raise HTTPException(status_code=400, detail=f"Mã vị trí '{data.ma_vi_tri}' đã tồn tại")
    obj = ViTri(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=ViTriResponse)
def update_vi_tri(
    id: int,
    data: ViTriBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(ViTri).filter(ViTri.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy vị trí")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_vi_tri(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(ViTri).filter(ViTri.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy vị trí")
    db.delete(obj)
    db.commit()
    return {"ok": True}
