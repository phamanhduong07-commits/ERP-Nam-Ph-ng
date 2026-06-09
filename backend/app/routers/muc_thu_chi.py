from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.danhmuc_chung import MucThuChi

router = APIRouter(prefix="/api/muc-thu-chi", tags=["muc-thu-chi"])

LOAI_HOP_LE = ["thu", "chi", "ca_hai"]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class MucThuChiBase(BaseModel):
    ma_muc: str
    ten_muc: str
    loai: str
    ghi_chu: str | None = None
    trang_thai: bool = True


class MucThuChiResponse(MucThuChiBase):
    id: int

    class Config:
        from_attributes = True


def _validate_loai(loai: str) -> None:
    if loai not in LOAI_HOP_LE:
        raise HTTPException(
            status_code=400,
            detail=f"Loại không hợp lệ. Chỉ chấp nhận: {', '.join(LOAI_HOP_LE)}",
        )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[MucThuChiResponse])
def list_muc_thu_chi(
    loai: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MucThuChi)
    if loai is not None:
        _validate_loai(loai)
        q = q.filter(MucThuChi.loai == loai)
    return q.order_by(MucThuChi.ma_muc).all()


@router.post("", response_model=MucThuChiResponse, status_code=201)
def create_muc_thu_chi(
    data: MucThuChiBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _validate_loai(data.loai)
    obj = MucThuChi(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=MucThuChiResponse)
def update_muc_thu_chi(
    id: int,
    data: MucThuChiBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _validate_loai(data.loai)
    obj = db.query(MucThuChi).filter(MucThuChi.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục thu/chi")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_muc_thu_chi(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(MucThuChi).filter(MucThuChi.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục thu/chi")
    db.delete(obj)
    db.commit()
    return {"ok": True}
