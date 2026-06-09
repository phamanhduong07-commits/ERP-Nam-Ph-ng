from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.danhmuc_nhom import NhomDoiTuong

router = APIRouter(prefix="/api/nhom-doi-tuong", tags=["nhom-doi-tuong"])

# Giá trị hợp lệ cho cột `loai`. Source of truth cho validate ở create/update.
VALID_LOAI = ("khach_hang", "nha_cung_cap")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class NhomDoiTuongBase(BaseModel):
    ma_nhom: str
    ten_nhom: str
    loai: str  # "khach_hang" | "nha_cung_cap"
    ghi_chu: str | None = None
    trang_thai: bool = True


class NhomDoiTuongResponse(NhomDoiTuongBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[NhomDoiTuongResponse])
def list_nhom_doi_tuong(
    loai: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(NhomDoiTuong)
    if loai is not None:
        query = query.filter(NhomDoiTuong.loai == loai)
    return query.order_by(NhomDoiTuong.ma_nhom).all()


@router.post("", response_model=NhomDoiTuongResponse, status_code=201)
def create_nhom_doi_tuong(
    data: NhomDoiTuongBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if data.loai not in VALID_LOAI:
        raise HTTPException(
            status_code=400,
            detail='Loại không hợp lệ. Chỉ chấp nhận "khach_hang" hoặc "nha_cung_cap"',
        )
    obj = NhomDoiTuong(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=NhomDoiTuongResponse)
def update_nhom_doi_tuong(
    id: int,
    data: NhomDoiTuongBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(NhomDoiTuong).filter(NhomDoiTuong.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm đối tượng")
    if data.loai not in VALID_LOAI:
        raise HTTPException(
            status_code=400,
            detail='Loại không hợp lệ. Chỉ chấp nhận "khach_hang" hoặc "nha_cung_cap"',
        )
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_nhom_doi_tuong(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(NhomDoiTuong).filter(NhomDoiTuong.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm đối tượng")
    db.delete(obj)
    db.commit()
    return {"ok": True}
