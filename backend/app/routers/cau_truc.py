from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.master import CauTrucThongDung
from app.models.auth import User

router = APIRouter(prefix="/api/cau-truc", tags=["cau-truc"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CauTrucBase(BaseModel):
    ten_cau_truc: str
    so_lop: int
    to_hop_song: str | None = None
    # Mỗi lớp: mã ký hiệu đồng cấp + định lượng (g/m²)
    mat: str | None = None
    mat_dl: float | None = None
    song_1: str | None = None
    song_1_dl: float | None = None
    mat_1: str | None = None
    mat_1_dl: float | None = None
    song_2: str | None = None
    song_2_dl: float | None = None
    mat_2: str | None = None
    mat_2_dl: float | None = None
    song_3: str | None = None
    song_3_dl: float | None = None
    mat_3: str | None = None
    mat_3_dl: float | None = None
    ghi_chu: str | None = None
    thu_tu: int = 0
    trang_thai: bool = True


class CauTrucCreate(CauTrucBase):
    pass


class CauTrucUpdate(CauTrucBase):
    pass


class CauTrucResponse(CauTrucBase):
    id: int

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[CauTrucResponse])
def list_cau_truc(
    so_lop: int | None = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CauTrucThongDung)
    if active_only:
        q = q.filter(CauTrucThongDung.trang_thai == True)
    if so_lop:
        q = q.filter(CauTrucThongDung.so_lop == so_lop)
    return q.order_by(CauTrucThongDung.thu_tu, CauTrucThongDung.ten_cau_truc).all()


@router.post("", response_model=CauTrucResponse)
def create_cau_truc(
    body: CauTrucCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = CauTrucThongDung(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=CauTrucResponse)
def update_cau_truc(
    id: int,
    body: CauTrucUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(CauTrucThongDung).get(id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy kết cấu")
    for k, v in body.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_cau_truc(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(CauTrucThongDung).get(id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy kết cấu")
    db.delete(obj)
    db.commit()
    return {"ok": True}
