from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import TaiXe

router = APIRouter(prefix="/api/tai-xe", tags=["tai-xe"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class TaiXeBase(BaseModel):
    ho_ten: str
    so_dien_thoai: str | None = None
    so_bang_lai: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class TaiXeResponse(TaiXeBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[TaiXeResponse])
def list_tai_xe(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(TaiXe).order_by(TaiXe.ho_ten).all()


@router.post("", response_model=TaiXeResponse, status_code=201)
def create_tai_xe(
    data: TaiXeBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = TaiXe(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=TaiXeResponse)
def update_tai_xe(
    id: int,
    data: TaiXeBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TaiXe).filter(TaiXe.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài xế")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_tai_xe(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TaiXe).filter(TaiXe.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài xế")
    db.delete(obj)
    db.commit()
    return {"ok": True}
