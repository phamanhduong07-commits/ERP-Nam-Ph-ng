"""CRUD router cho ProductionKhauCost — chi phí gia công converting per m².

Routes:
  GET  /api/production/khau-costs?production_order_item_id=X
  POST /api/production/khau-costs
  PUT  /api/production/khau-costs/{id}
  DELETE /api/production/khau-costs/{id}
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.production import ProductionKhauCost, ProductionOrderItem

router = APIRouter(prefix="/api/production/khau-costs", tags=["production"])


class KhauCostIn(BaseModel):
    production_order_item_id: int
    addon_rate_id: Optional[int] = None
    khau: str = Field(..., max_length=50)
    don_gia_m2: Decimal = Field(..., ge=0)
    dien_tich: Decimal = Field(..., gt=0)
    ghi_chu: Optional[str] = None


class KhauCostUpdate(BaseModel):
    don_gia_m2: Optional[Decimal] = Field(None, ge=0)
    dien_tich: Optional[Decimal] = Field(None, gt=0)
    ghi_chu: Optional[str] = None


def _to_dict(kc: ProductionKhauCost) -> dict:
    return {
        "id": kc.id,
        "production_order_item_id": kc.production_order_item_id,
        "addon_rate_id": kc.addon_rate_id,
        "khau": kc.khau,
        "don_gia_m2": float(kc.don_gia_m2),
        "dien_tich": float(kc.dien_tich),
        "thanh_tien": float(kc.thanh_tien),
        "ghi_chu": kc.ghi_chu,
        "created_at": kc.created_at.isoformat() if kc.created_at else None,
    }


@router.get("")
def list_khau_costs(
    production_order_item_id: Optional[int] = None,
    production_order_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ProductionKhauCost)
    if production_order_item_id:
        q = q.filter(ProductionKhauCost.production_order_item_id == production_order_item_id)
    if production_order_id:
        q = q.join(ProductionOrderItem).filter(
            ProductionOrderItem.production_order_id == production_order_id
        )
    return [_to_dict(kc) for kc in q.order_by(ProductionKhauCost.id).all()]


@router.post("", status_code=201)
def create_khau_cost(
    body: KhauCostIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    poi = db.get(ProductionOrderItem, body.production_order_item_id)
    if not poi:
        raise HTTPException(404, "Không tìm thấy dòng lệnh sản xuất")

    thanh_tien = body.dien_tich * body.don_gia_m2
    kc = ProductionKhauCost(
        production_order_item_id=body.production_order_item_id,
        addon_rate_id=body.addon_rate_id,
        khau=body.khau,
        don_gia_m2=body.don_gia_m2,
        dien_tich=body.dien_tich,
        thanh_tien=thanh_tien,
        ghi_chu=body.ghi_chu,
        created_at=datetime.now(timezone.utc),
    )
    db.add(kc)
    db.commit()
    db.refresh(kc)
    return _to_dict(kc)


@router.put("/{kc_id}")
def update_khau_cost(
    kc_id: int,
    body: KhauCostUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    kc = db.get(ProductionKhauCost, kc_id)
    if not kc:
        raise HTTPException(404, "Không tìm thấy khâu cost")

    if body.don_gia_m2 is not None:
        kc.don_gia_m2 = body.don_gia_m2
    if body.dien_tich is not None:
        kc.dien_tich = body.dien_tich
    if body.ghi_chu is not None:
        kc.ghi_chu = body.ghi_chu

    kc.thanh_tien = kc.dien_tich * kc.don_gia_m2
    db.commit()
    db.refresh(kc)
    return _to_dict(kc)


@router.delete("/{kc_id}", status_code=204)
def delete_khau_cost(
    kc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    kc = db.get(ProductionKhauCost, kc_id)
    if not kc:
        raise HTTPException(404, "Không tìm thấy khâu cost")
    db.delete(kc)
    db.commit()
