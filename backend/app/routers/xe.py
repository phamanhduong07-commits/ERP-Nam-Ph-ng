from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Xe

router = APIRouter(prefix="/api/xe", tags=["xe"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class XeBase(BaseModel):
    bien_so: str
    loai_xe: str | None = None
    trong_tai: Decimal | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class XeResponse(XeBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[XeResponse])
def list_xe(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Xe).order_by(Xe.bien_so).all()


@router.post("", response_model=XeResponse, status_code=201)
def create_xe(
    data: XeBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Xe).filter(Xe.bien_so == data.bien_so).first():
        raise HTTPException(status_code=400, detail=f"Biển số '{data.bien_so}' đã tồn tại")
    obj = Xe(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=XeResponse)
def update_xe(
    id: int,
    data: XeBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Xe).filter(Xe.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy xe")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_xe(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Xe).filter(Xe.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy xe")
    db.delete(obj)
    db.commit()
    return {"ok": True}
