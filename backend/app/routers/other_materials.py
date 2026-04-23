from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import OtherMaterial
from app.schemas.sales import PagedResponse

router = APIRouter(prefix="/api/other-materials", tags=["other-materials"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class OtherMaterialCreate(BaseModel):
    ma_chinh: str
    ma_amis: str | None = None
    ten: str
    dvt: str = "Kg"
    ma_nhom_id: int
    gia_mua: Decimal = Decimal("0")
    ton_toi_thieu: Decimal = Decimal("0")
    ton_toi_da: Decimal | None = None
    phan_xuong: str | None = None
    ma_ncc_id: int | None = None
    ghi_chu: str | None = None
    trang_thai: bool = True


class OtherMaterialUpdate(BaseModel):
    ma_chinh: str | None = None
    ma_amis: str | None = None
    ten: str | None = None
    dvt: str | None = None
    ma_nhom_id: int | None = None
    gia_mua: Decimal | None = None
    ton_toi_thieu: Decimal | None = None
    ton_toi_da: Decimal | None = None
    phan_xuong: str | None = None
    ma_ncc_id: int | None = None
    ghi_chu: str | None = None
    trang_thai: bool | None = None


class OtherMaterialResponse(BaseModel):
    id: int
    ma_chinh: str
    ma_amis: str | None = None
    ten: str
    dvt: str
    ma_nhom_id: int
    ten_nhom: str | None = None
    gia_mua: Decimal
    ton_toi_thieu: Decimal
    ton_toi_da: Decimal | None = None
    phan_xuong: str | None = None
    ma_ncc_id: int | None = None
    ten_ncc: str | None = None
    ghi_chu: str | None = None
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


def _to_response(obj: OtherMaterial) -> OtherMaterialResponse:
    data = OtherMaterialResponse.model_validate(obj)
    data.ten_nhom = obj.nhom.ten_nhom if obj.nhom else None
    data.ten_ncc = obj.ncc.ten_viet_tat if obj.ncc else None
    return data


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=PagedResponse)
def list_other_materials(
    search: str = Query(default=""),
    ma_nhom_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(OtherMaterial)
    if search:
        like = f"%{search}%"
        q = q.filter(
            OtherMaterial.ma_chinh.ilike(like)
            | OtherMaterial.ten.ilike(like)
        )
    if ma_nhom_id is not None:
        q = q.filter(OtherMaterial.ma_nhom_id == ma_nhom_id)
    total = q.count()
    items = q.order_by(OtherMaterial.ten).offset((page - 1) * page_size).limit(page_size).all()
    return PagedResponse(
        items=[_to_response(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=OtherMaterialResponse, status_code=201)
def create_other_material(
    data: OtherMaterialCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(OtherMaterial).filter(OtherMaterial.ma_chinh == data.ma_chinh).first():
        raise HTTPException(status_code=400, detail=f"Mã '{data.ma_chinh}' đã tồn tại")
    obj = OtherMaterial(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)


@router.put("/{id}", response_model=OtherMaterialResponse)
def update_other_material(
    id: int,
    data: OtherMaterialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.query(OtherMaterial).filter(OtherMaterial.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy vật tư")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return _to_response(obj)
