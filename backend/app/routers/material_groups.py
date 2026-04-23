from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import MaterialGroup

router = APIRouter(prefix="/api/material-groups", tags=["material-groups"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class MaterialGroupBase(BaseModel):
    ma_nhom: str
    ten_nhom: str
    la_nhom_giay: bool = False
    bo_phan: str | None = None
    phan_xuong: str | None = None
    trang_thai: bool = True


class MaterialGroupResponse(MaterialGroupBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialGroupDropdown(BaseModel):
    id: int
    ma_nhom: str
    ten_nhom: str

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[MaterialGroupResponse])
def list_material_groups(
    search: str = Query(default=""),
    la_nhom_giay: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaterialGroup)
    if search:
        like = f"%{search}%"
        q = q.filter(
            MaterialGroup.ma_nhom.ilike(like)
            | MaterialGroup.ten_nhom.ilike(like)
        )
    if la_nhom_giay is not None:
        q = q.filter(MaterialGroup.la_nhom_giay == la_nhom_giay)
    return q.order_by(MaterialGroup.ma_nhom).offset((page - 1) * page_size).limit(page_size).all()


@router.get("/all", response_model=list[MaterialGroupDropdown])
def get_all_material_groups(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(MaterialGroup).filter(MaterialGroup.trang_thai == True).order_by(MaterialGroup.ten_nhom).all()


@router.post("", response_model=MaterialGroupResponse, status_code=201)
def create_material_group(
    data: MaterialGroupBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(MaterialGroup).filter(MaterialGroup.ma_nhom == data.ma_nhom).first():
        raise HTTPException(status_code=400, detail=f"Mã nhóm '{data.ma_nhom}' đã tồn tại")
    obj = MaterialGroup(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=MaterialGroupResponse)
def update_material_group(
    id: int,
    data: MaterialGroupBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(MaterialGroup).filter(MaterialGroup.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm vật tư")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_material_group(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(MaterialGroup).filter(MaterialGroup.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm vật tư")
    db.delete(obj)
    db.commit()
    return {"ok": True}
