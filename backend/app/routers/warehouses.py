from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Warehouse

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class WarehouseBase(BaseModel):
    ma_kho: str
    ten_kho: str
    loai_kho: str
    dia_chi: str | None = None
    trang_thai: bool = True


class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[WarehouseResponse])
def list_warehouses(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Warehouse).order_by(Warehouse.ma_kho).all()


@router.post("", response_model=WarehouseResponse, status_code=201)
def create_warehouse(
    data: WarehouseBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Warehouse).filter(Warehouse.ma_kho == data.ma_kho).first():
        raise HTTPException(status_code=400, detail=f"Mã kho '{data.ma_kho}' đã tồn tại")
    obj = Warehouse(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=WarehouseResponse)
def update_warehouse(
    id: int,
    data: WarehouseBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy kho")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_warehouse(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy kho")
    db.delete(obj)
    db.commit()
    return {"ok": True}
