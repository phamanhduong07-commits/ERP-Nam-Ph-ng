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


@router.post("/seed", response_model=list[CauTrucResponse])
def seed_cau_truc(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tạo các kết cấu giấy mặc định nếu bảng đang trống.
    Mã ký hiệu sử dụng giá trị thông dụng — cập nhật lại theo bảng giá giấy thực tế."""
    existing = db.query(CauTrucThongDung).count()
    if existing > 0:
        return db.query(CauTrucThongDung).order_by(CauTrucThongDung.thu_tu).all()

    defaults = [
        # 3 lớp — Sóng B
        dict(ten_cau_truc="3 lớp Sóng B (thông dụng)", so_lop=3, to_hop_song="B",
             mat="K175", mat_dl=175, song_1="C125", song_1_dl=125, mat_1="K125", mat_1_dl=125,
             thu_tu=1, ghi_chu="Cập nhật mã ký hiệu theo bảng giá giấy thực tế"),
        # 3 lớp — Sóng C
        dict(ten_cau_truc="3 lớp Sóng C", so_lop=3, to_hop_song="C",
             mat="K175", mat_dl=175, song_1="C150", song_1_dl=150, mat_1="K125", mat_1_dl=125,
             thu_tu=2, ghi_chu="Cập nhật mã ký hiệu theo bảng giá giấy thực tế"),
        # 5 lớp — CB
        dict(ten_cau_truc="5 lớp CB (thông dụng)", so_lop=5, to_hop_song="CB",
             mat="K175", mat_dl=175,
             song_1="C125", song_1_dl=125, mat_1="K125", mat_1_dl=125,
             song_2="B125", song_2_dl=125, mat_2="K125", mat_2_dl=125,
             thu_tu=3, ghi_chu="Cập nhật mã ký hiệu theo bảng giá giấy thực tế"),
        # 5 lớp — BC
        dict(ten_cau_truc="5 lớp BC", so_lop=5, to_hop_song="BC",
             mat="K175", mat_dl=175,
             song_1="B125", song_1_dl=125, mat_1="K125", mat_1_dl=125,
             song_2="C125", song_2_dl=125, mat_2="K125", mat_2_dl=125,
             thu_tu=4, ghi_chu="Cập nhật mã ký hiệu theo bảng giá giấy thực tế"),
        # 7 lớp — CBC
        dict(ten_cau_truc="7 lớp CBC (thông dụng)", so_lop=7, to_hop_song="CBC",
             mat="K175", mat_dl=175,
             song_1="C150", song_1_dl=150, mat_1="K125", mat_1_dl=125,
             song_2="B125", song_2_dl=125, mat_2="K125", mat_2_dl=125,
             song_3="C150", song_3_dl=150, mat_3="K125", mat_3_dl=125,
             thu_tu=5, ghi_chu="Cập nhật mã ký hiệu theo bảng giá giấy thực tế"),
    ]
    objs = [CauTrucThongDung(**d) for d in defaults]
    db.add_all(objs)
    db.commit()
    return db.query(CauTrucThongDung).order_by(CauTrucThongDung.thu_tu).all()


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
