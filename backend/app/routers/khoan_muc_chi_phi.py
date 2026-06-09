from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.danhmuc_cost import KhoanMucChiPhi

router = APIRouter(prefix="/api/khoan-muc-chi-phi", tags=["khoan-muc-chi-phi"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class KhoanMucChiPhiBase(BaseModel):
    ma_kmcp: str
    ten_kmcp: str
    loai_chi_phi: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class KhoanMucChiPhiResponse(KhoanMucChiPhiBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[KhoanMucChiPhiResponse])
def list_khoan_muc_chi_phi(
    loai_chi_phi: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(KhoanMucChiPhi)
    if loai_chi_phi:
        query = query.filter(KhoanMucChiPhi.loai_chi_phi == loai_chi_phi)
    return query.order_by(KhoanMucChiPhi.ma_kmcp).all()


@router.post("", response_model=KhoanMucChiPhiResponse, status_code=201)
def create_khoan_muc_chi_phi(
    data: KhoanMucChiPhiBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = KhoanMucChiPhi(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=KhoanMucChiPhiResponse)
def update_khoan_muc_chi_phi(
    id: int,
    data: KhoanMucChiPhiBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(KhoanMucChiPhi).filter(KhoanMucChiPhi.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản mục chi phí")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_khoan_muc_chi_phi(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(KhoanMucChiPhi).filter(KhoanMucChiPhi.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản mục chi phí")
    db.delete(obj)
    db.commit()
    return {"ok": True}
