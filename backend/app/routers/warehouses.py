from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.master import Warehouse, PhanXuong

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])
master_admin_required = require_roles("ADMIN", "GIAM_DOC")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class WarehouseBase(BaseModel):
    ma_kho: str
    ten_kho: str
    loai_kho: str
    dia_chi: str | None = None
    phan_xuong_id: int | None = None
    trang_thai: bool = True


class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    ten_xuong: str | None = None

    class Config:
        from_attributes = True


# ─── Endpoints: Warehouse ────────────────────────────────────────────────────

@router.get("", response_model=list[WarehouseResponse])
def list_warehouses(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Warehouse).order_by(Warehouse.ma_kho).all()
    result = []
    for w in rows:
        px = db.get(PhanXuong, w.phan_xuong_id) if w.phan_xuong_id else None
        d = WarehouseResponse(
            id=w.id, ma_kho=w.ma_kho, ten_kho=w.ten_kho, loai_kho=w.loai_kho,
            dia_chi=w.dia_chi, phan_xuong_id=w.phan_xuong_id, trang_thai=w.trang_thai,
            created_at=w.created_at, ten_xuong=px.ten_xuong if px else None,
        )
        result.append(d)
    return result


@router.post("", response_model=WarehouseResponse, status_code=201)
def create_warehouse(
    data: WarehouseBase,
    db: Session = Depends(get_db),
    _: User = Depends(master_admin_required),
):
    if db.query(Warehouse).filter(Warehouse.ma_kho == data.ma_kho).first():
        raise HTTPException(status_code=400, detail=f"Mã kho '{data.ma_kho}' đã tồn tại")
    if data.phan_xuong_id and not db.get(PhanXuong, data.phan_xuong_id):
        raise HTTPException(status_code=400, detail="Phân xưởng không tồn tại")
    obj = Warehouse(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    px = db.get(PhanXuong, obj.phan_xuong_id) if obj.phan_xuong_id else None
    return WarehouseResponse(
        id=obj.id, ma_kho=obj.ma_kho, ten_kho=obj.ten_kho, loai_kho=obj.loai_kho,
        dia_chi=obj.dia_chi, phan_xuong_id=obj.phan_xuong_id, trang_thai=obj.trang_thai,
        created_at=obj.created_at, ten_xuong=px.ten_xuong if px else None,
    )


@router.put("/{id}", response_model=WarehouseResponse)
def update_warehouse(
    id: int,
    data: WarehouseBase,
    db: Session = Depends(get_db),
    _: User = Depends(master_admin_required),
):
    obj = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy kho")
    if data.phan_xuong_id and not db.get(PhanXuong, data.phan_xuong_id):
        raise HTTPException(status_code=400, detail="Phân xưởng không tồn tại")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    px = db.get(PhanXuong, obj.phan_xuong_id) if obj.phan_xuong_id else None
    return WarehouseResponse(
        id=obj.id, ma_kho=obj.ma_kho, ten_kho=obj.ten_kho, loai_kho=obj.loai_kho,
        dia_chi=obj.dia_chi, phan_xuong_id=obj.phan_xuong_id, trang_thai=obj.trang_thai,
        created_at=obj.created_at, ten_xuong=px.ten_xuong if px else None,
    )


@router.delete("/{id}")
def delete_warehouse(id: int, db: Session = Depends(get_db), _: User = Depends(master_admin_required)):
    obj = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy kho")
    db.delete(obj)
    db.commit()
    return {"ok": True}
