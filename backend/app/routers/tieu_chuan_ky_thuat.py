from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import TieuChuanKyThuat
from app.models.media import ErpMedia
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/tieu-chuan-ky-thuat", tags=["tieu-chuan-ky-thuat"])


class TieuChuanCreate(BaseModel):
    ma_tc: str
    ten: str
    mo_ta: str | None = None
    ap_dung_cho: str = "tat_ca"  # giay | nvl | tat_ca


class TieuChuanUpdate(BaseModel):
    ten: str | None = None
    mo_ta: str | None = None
    ap_dung_cho: str | None = None


class TieuChuanResponse(BaseModel):
    id: int
    ma_tc: str
    ten: str
    mo_ta: str | None = None
    ap_dung_cho: str
    file_count: int = 0
    files: list[dict] = []
    created_at: datetime

    class Config:
        from_attributes = True


def _to_response(obj: TieuChuanKyThuat, db: Session, include_files: bool = False) -> TieuChuanResponse:
    files = []
    if include_files:
        media_rows = (
            db.query(ErpMedia)
            .filter(ErpMedia.module == "tieu_chuan", ErpMedia.record_id == str(obj.id))
            .order_by(ErpMedia.created_at.asc())
            .all()
        )
        files = [
            {
                "id": m.id,
                "url": f"/uploads/{m.filepath}",
                "filename": m.filename,
                "mime_type": m.mime_type,
                "size_bytes": m.size_bytes,
                "note": m.note,
            }
            for m in media_rows
        ]

    file_count_q = db.query(ErpMedia).filter(
        ErpMedia.module == "tieu_chuan", ErpMedia.record_id == str(obj.id)
    ).count()

    data = TieuChuanResponse.model_validate(obj)
    data.file_count = file_count_q
    data.files = files
    return data


@router.get("", response_model=PagedResponse)
def list_tieu_chuan(
    search: str = Query(default=""),
    ap_dung_cho: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(TieuChuanKyThuat)
    if search:
        like = f"%{search}%"
        q = q.filter(
            TieuChuanKyThuat.ma_tc.ilike(like) | TieuChuanKyThuat.ten.ilike(like)
        )
    if ap_dung_cho:
        q = q.filter(
            (TieuChuanKyThuat.ap_dung_cho == ap_dung_cho) | (TieuChuanKyThuat.ap_dung_cho == "tat_ca")
        )
    total = q.count()
    items = q.order_by(TieuChuanKyThuat.ma_tc).offset((page - 1) * page_size).limit(page_size).all()
    return PagedResponse(
        items=[_to_response(o, db, include_files=True) for o in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/search")
def search_tieu_chuan(
    q: str = Query(default=""),
    ap_dung_cho: str | None = Query(default=None),
    limit: int = Query(default=30, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Quick search cho autocomplete trong form sản phẩm."""
    query = db.query(TieuChuanKyThuat)
    if q:
        like = f"%{q}%"
        query = query.filter(TieuChuanKyThuat.ma_tc.ilike(like) | TieuChuanKyThuat.ten.ilike(like))
    if ap_dung_cho:
        query = query.filter(
            (TieuChuanKyThuat.ap_dung_cho == ap_dung_cho) | (TieuChuanKyThuat.ap_dung_cho == "tat_ca")
        )
    items = query.order_by(TieuChuanKyThuat.ma_tc).limit(limit).all()
    return [{"value": o.id, "label": f"{o.ma_tc} — {o.ten}", "id": o.id, "ma_tc": o.ma_tc, "ten": o.ten} for o in items]


@router.get("/{id}", response_model=TieuChuanResponse)
def get_tieu_chuan(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.id == id).first()
    if not obj:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    return _to_response(obj, db, include_files=True)


@router.post("", response_model=TieuChuanResponse, status_code=201)
def create_tieu_chuan(
    data: TieuChuanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.ma_tc == data.ma_tc).first():
        raise HTTPException(400, f"Mã '{data.ma_tc}' đã tồn tại")
    obj = TieuChuanKyThuat(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_response(obj, db)


@router.put("/{id}", response_model=TieuChuanResponse)
def update_tieu_chuan(
    id: int,
    data: TieuChuanUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.id == id).first()
    if not obj:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return _to_response(obj, db, include_files=True)


@router.delete("/{id}")
def delete_tieu_chuan(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(TieuChuanKyThuat).filter(TieuChuanKyThuat.id == id).first()
    if not obj:
        raise HTTPException(404, "Không tìm thấy tiêu chuẩn")
    db.delete(obj)
    db.commit()
    return {"ok": True}
