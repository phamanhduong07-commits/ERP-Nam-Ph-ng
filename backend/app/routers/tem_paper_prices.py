from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user, get_admin_user
from app.models.sales import TemPaperPrice

router = APIRouter(prefix="/tem-paper-prices", tags=["Giá giấy tem"])


class TemPaperPriceCreate(BaseModel):
    loai_giay: str
    ten: str
    gsm: Decimal | None = None
    don_gia_kg: Decimal
    active: bool = True
    ghi_chu: str | None = None


class TemPaperPriceUpdate(BaseModel):
    ten: str | None = None
    gsm: Decimal | None = None
    don_gia_kg: Decimal | None = None
    active: bool | None = None
    ghi_chu: str | None = None


class TemPaperPriceResponse(BaseModel):
    id: int
    loai_giay: str
    ten: str
    gsm: Decimal | None
    don_gia_kg: Decimal
    active: bool
    ghi_chu: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[TemPaperPriceResponse])
def list_prices(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    q = db.query(TemPaperPrice)
    if active_only:
        q = q.filter(TemPaperPrice.active == True)
    return q.order_by(TemPaperPrice.loai_giay, TemPaperPrice.gsm).all()


@router.get("/lookup", response_model=TemPaperPriceResponse | None)
def lookup_price(
    loai_giay: str,
    gsm: float | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    """Tìm giá giấy tem: exact match loai_giay+gsm → fallback loai_giay only."""
    q = db.query(TemPaperPrice).filter(
        TemPaperPrice.loai_giay == loai_giay,
        TemPaperPrice.active == True,
    )
    if gsm is not None:
        exact = q.filter(TemPaperPrice.gsm == Decimal(str(gsm))).first()
        if exact:
            return exact
    return q.filter(TemPaperPrice.gsm == None).first()  # noqa: E711


@router.post("", response_model=TemPaperPriceResponse, status_code=201)
def create_price(
    body: TemPaperPriceCreate,
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
):
    obj = TemPaperPrice(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=TemPaperPriceResponse)
def update_price(
    id: int,
    body: TemPaperPriceUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(get_admin_user),
):
    obj = db.get(TemPaperPrice, id)
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
    obj = db.get(TemPaperPrice, id)
    if not obj:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(obj)
    db.commit()
