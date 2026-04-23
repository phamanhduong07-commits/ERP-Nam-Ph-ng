from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import DonGiaVanChuyen

router = APIRouter(prefix="/api/don-gia-van-chuyen", tags=["don-gia-van-chuyen"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class DonGiaVanChuyenBase(BaseModel):
    ten_tuyen: str
    khu_vuc_tu: str | None = None
    khu_vuc_den: str | None = None
    don_gia: Decimal = Decimal("0")
    dvt: str = "chuyến"
    ghi_chu: str | None = None
    trang_thai: bool = True


class DonGiaVanChuyenResponse(DonGiaVanChuyenBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[DonGiaVanChuyenResponse])
def list_don_gia_van_chuyen(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(DonGiaVanChuyen).order_by(DonGiaVanChuyen.ten_tuyen).all()


@router.post("", response_model=DonGiaVanChuyenResponse, status_code=201)
def create_don_gia_van_chuyen(
    data: DonGiaVanChuyenBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = DonGiaVanChuyen(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=DonGiaVanChuyenResponse)
def update_don_gia_van_chuyen(
    id: int,
    data: DonGiaVanChuyenBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DonGiaVanChuyen).filter(DonGiaVanChuyen.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn giá vận chuyển")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_don_gia_van_chuyen(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(DonGiaVanChuyen).filter(DonGiaVanChuyen.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn giá vận chuyển")
    db.delete(obj)
    db.commit()
    return {"ok": True}
