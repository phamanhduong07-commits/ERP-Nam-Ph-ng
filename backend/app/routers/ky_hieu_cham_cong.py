from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.danhmuc_hr import KyHieuChamCong

router = APIRouter(prefix="/api/ky-hieu-cham-cong", tags=["ky-hieu-cham-cong"])

LOAI_HOP_LE = [
    "di_lam",
    "nghi_phep",
    "tang_ca",
    "vang_mat",
    "nghi_le",
    "nghi_khong_luong",
]


# ─── Schemas ─────────────────────────────────────────────────────────────────

class KyHieuChamCongBase(BaseModel):
    ky_hieu: str
    ten_ky_hieu: str
    loai: str
    he_so_cong: float = 1.0
    tinh_luong: bool = True
    ghi_chu: str | None = None
    trang_thai: bool = True


class KyHieuChamCongResponse(KyHieuChamCongBase):
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

@router.get("", response_model=list[KyHieuChamCongResponse])
def list_ky_hieu_cham_cong(
    loai: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(KyHieuChamCong)
    if loai:
        query = query.filter(KyHieuChamCong.loai == loai)
    return query.order_by(KyHieuChamCong.ky_hieu).all()


@router.post("", response_model=KyHieuChamCongResponse, status_code=201)
def create_ky_hieu_cham_cong(
    data: KyHieuChamCongBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _validate_loai(data.loai)
    obj = KyHieuChamCong(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=KyHieuChamCongResponse)
def update_ky_hieu_cham_cong(
    id: int,
    data: KyHieuChamCongBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _validate_loai(data.loai)
    obj = db.query(KyHieuChamCong).filter(KyHieuChamCong.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy ký hiệu chấm công")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_ky_hieu_cham_cong(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(KyHieuChamCong).filter(KyHieuChamCong.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy ký hiệu chấm công")
    db.delete(obj)
    db.commit()
    return {"ok": True}
