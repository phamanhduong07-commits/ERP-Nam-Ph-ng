from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import PhuongXa

router = APIRouter(prefix="/api/phuong-xa", tags=["phuong-xa"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class PhuongXaBase(BaseModel):
    ma_phuong: str
    ten_phuong: str
    tinh_id: int | None = None
    trang_thai: bool = True


class PhuongXaResponse(PhuongXaBase):
    id: int
    ten_tinh: str | None = None

    class Config:
        from_attributes = True


def _to_response(obj: PhuongXa) -> PhuongXaResponse:
    return PhuongXaResponse(
        id=obj.id,
        ma_phuong=obj.ma_phuong,
        ten_phuong=obj.ten_phuong,
        tinh_id=obj.tinh_id,
        trang_thai=obj.trang_thai,
        ten_tinh=obj.tinh.ten_tinh if obj.tinh else None,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[PhuongXaResponse])
def list_phuong_xa(
    tinh_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhuongXa)
    if tinh_id is not None:
        q = q.filter(PhuongXa.tinh_id == tinh_id)
    items = q.order_by(PhuongXa.ten_phuong).all()
    return [_to_response(o) for o in items]


@router.post("", response_model=PhuongXaResponse, status_code=201)
def create_phuong_xa(
    data: PhuongXaBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = PhuongXa(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.put("/{id}", response_model=PhuongXaResponse)
def update_phuong_xa(
    id: int,
    data: PhuongXaBase,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(PhuongXa).filter(PhuongXa.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phường/xã")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.delete("/{id}")
def delete_phuong_xa(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(PhuongXa).filter(PhuongXa.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy phường/xã")
    db.delete(obj)
    db.commit()
    return {"ok": True}
