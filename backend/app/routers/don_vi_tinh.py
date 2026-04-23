from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import DonViTinh

router = APIRouter(prefix="/api/don-vi-tinh", tags=["don-vi-tinh"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class DonViTinhBase(BaseModel):
    ten: str
    ky_hieu: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class DonViTinhResponse(DonViTinhBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[DonViTinhResponse])
def list_don_vi_tinh(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(DonViTinh).order_by(DonViTinh.ten).all()


@router.post("", response_model=DonViTinhResponse, status_code=201)
def create_don_vi_tinh(
    data: DonViTinhBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = DonViTinh(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=DonViTinhResponse)
def update_don_vi_tinh(
    id: int,
    data: DonViTinhBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DonViTinh).filter(DonViTinh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn vị tính")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_don_vi_tinh(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DonViTinh).filter(DonViTinh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn vị tính")
    db.delete(obj)
    db.commit()
    return {"ok": True}
