from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.loai_tien import LoaiTien

router = APIRouter(prefix="/api/loai-tien", tags=["Loại tiền"])


class LoaiTienCreate(BaseModel):
    ma_loai_tien: str
    ten_loai_tien: str
    ty_gia: float = 1
    ty_gia_mua: Optional[float] = None
    ty_gia_ban: Optional[float] = None
    la_mac_dinh: bool = False
    trang_thai: bool = True


class LoaiTienUpdate(BaseModel):
    ten_loai_tien: Optional[str] = None
    ty_gia: Optional[float] = None
    ty_gia_mua: Optional[float] = None
    ty_gia_ban: Optional[float] = None
    la_mac_dinh: Optional[bool] = None
    trang_thai: Optional[bool] = None


class LoaiTienOut(BaseModel):
    id: int
    ma_loai_tien: str
    ten_loai_tien: str
    ty_gia: float
    ty_gia_mua: Optional[float]
    ty_gia_ban: Optional[float]
    la_mac_dinh: bool
    trang_thai: bool
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[LoaiTienOut])
def list_loai_tien(
    trang_thai: Optional[bool] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(LoaiTien)
    if trang_thai is not None:
        q = q.filter(LoaiTien.trang_thai == trang_thai)
    return q.order_by(LoaiTien.ma_loai_tien).all()


@router.post("", response_model=LoaiTienOut, status_code=201)
def create_loai_tien(
    body: LoaiTienCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if db.query(LoaiTien).filter(LoaiTien.ma_loai_tien == body.ma_loai_tien).first():
        raise HTTPException(400, "Mã loại tiền đã tồn tại")
    if body.la_mac_dinh:
        db.query(LoaiTien).filter(LoaiTien.la_mac_dinh == True).update({"la_mac_dinh": False})
    obj = LoaiTien(**body.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj


@router.put("/{id}", response_model=LoaiTienOut)
def update_loai_tien(
    id: int,
    body: LoaiTienUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    obj = db.get(LoaiTien, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy")
    data = body.model_dump(exclude_none=True)
    if data.get("la_mac_dinh"):
        db.query(LoaiTien).filter(LoaiTien.la_mac_dinh == True, LoaiTien.id != id).update({"la_mac_dinh": False})
    data["updated_at"] = datetime.utcnow()
    for k, v in data.items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj


@router.delete("/{id}", status_code=204)
def delete_loai_tien(
    id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    obj = db.get(LoaiTien, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy")
    if obj.la_mac_dinh:
        raise HTTPException(400, "Không thể xóa loại tiền mặc định")
    db.delete(obj); db.commit()
