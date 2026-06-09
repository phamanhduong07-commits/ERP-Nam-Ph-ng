from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.danhmuc_cost import LoaiTaisanCoDinh

router = APIRouter(prefix="/api/loai-tai-san-co-dinh", tags=["loai-tai-san-co-dinh"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class LoaiTaisanCoDinhBase(BaseModel):
    ma_loai: str
    ten_loai: str
    ty_le_khau_hao: float | None = None
    thoi_gian_sd: int | None = None
    tk_nguyen_gia: str | None = None
    tk_hao_mon: str | None = None
    tk_khau_hao: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class LoaiTaisanCoDinhResponse(LoaiTaisanCoDinhBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[LoaiTaisanCoDinhResponse])
def list_loai_tai_san_co_dinh(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(LoaiTaisanCoDinh).order_by(LoaiTaisanCoDinh.ma_loai).all()


@router.post("", response_model=LoaiTaisanCoDinhResponse, status_code=201)
def create_loai_tai_san_co_dinh(
    data: LoaiTaisanCoDinhBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = LoaiTaisanCoDinh(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=LoaiTaisanCoDinhResponse)
def update_loai_tai_san_co_dinh(
    id: int,
    data: LoaiTaisanCoDinhBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(LoaiTaisanCoDinh).filter(LoaiTaisanCoDinh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy loại tài sản cố định")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_loai_tai_san_co_dinh(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(LoaiTaisanCoDinh).filter(LoaiTaisanCoDinh.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy loại tài sản cố định")
    db.delete(obj)
    db.commit()
    return {"ok": True}
