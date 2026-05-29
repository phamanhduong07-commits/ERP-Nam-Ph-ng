from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, get_admin_user
from app.models.sales import OffsetAddonPrice

router = APIRouter(prefix="/offset-addon-prices", tags=["Giá addon offset"])

LOAI_ADDON_VALUES = ("can_mang", "uv", "suppo", "luoi", "in_offset")


class OffsetAddonPriceCreate(BaseModel):
    loai_addon: str
    ten: str
    don_gia_m2: Decimal
    active: bool = True
    ghi_chu: str | None = None


class OffsetAddonPriceUpdate(BaseModel):
    ten: str | None = None
    don_gia_m2: Decimal | None = None
    active: bool | None = None
    ghi_chu: str | None = None


class OffsetAddonPriceResponse(BaseModel):
    id: int
    loai_addon: str
    ten: str
    don_gia_m2: Decimal
    active: bool
    ghi_chu: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[OffsetAddonPriceResponse])
def list_prices(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    q = db.query(OffsetAddonPrice)
    if active_only:
        q = q.filter(OffsetAddonPrice.active == True)
    return q.order_by(OffsetAddonPrice.loai_addon).all()


@router.get("/lookup/{loai_addon}", response_model=OffsetAddonPriceResponse | None)
def lookup_price(
    loai_addon: str,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    return db.query(OffsetAddonPrice).filter(
        OffsetAddonPrice.loai_addon == loai_addon,
        OffsetAddonPrice.active == True,
    ).first()


@router.post("", response_model=OffsetAddonPriceResponse, status_code=201)
def create_price(
    body: OffsetAddonPriceCreate,
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
):
    if body.loai_addon not in LOAI_ADDON_VALUES:
        raise HTTPException(400, f"loai_addon phải là một trong: {', '.join(LOAI_ADDON_VALUES)}")
    obj = OffsetAddonPrice(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=OffsetAddonPriceResponse)
def update_price(
    id: int,
    body: OffsetAddonPriceUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
):
    obj = db.get(OffsetAddonPrice, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{id}", status_code=204)
def delete_price(
    id: int,
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
):
    obj = db.get(OffsetAddonPrice, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(obj)
    db.commit()
