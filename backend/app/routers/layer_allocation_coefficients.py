"""
routers/layer_allocation_coefficients.py
=========================================
Quản lý hệ số phân bổ giấy theo loại lớp (mặt/sóng).

GET  /api/layer-allocation-coefficients        — lấy danh sách
PUT  /api/layer-allocation-coefficients/{id}   — cập nhật hệ số
POST /api/layer-allocation-coefficients/seed   — reset về mặc định
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.layer_allocation_coefficient import LayerAllocationCoefficient

router = APIRouter(prefix="/api/layer-allocation-coefficients", tags=["layer-allocation-coefficients"])
_admin_required = require_roles("ADMIN", "GIAM_DOC")

_DEFAULTS = [
    {"loai_lop": "mat",  "flute_type": None,  "he_so": Decimal("1.00"), "ghi_chu": "Mặt (liner)"},
    {"loai_lop": "song", "flute_type": "A",   "he_so": Decimal("1.56"), "ghi_chu": "Sóng A"},
    {"loai_lop": "song", "flute_type": "C",   "he_so": Decimal("1.45"), "ghi_chu": "Sóng C"},
    {"loai_lop": "song", "flute_type": "B",   "he_so": Decimal("1.32"), "ghi_chu": "Sóng B"},
    {"loai_lop": "song", "flute_type": "E",   "he_so": Decimal("1.25"), "ghi_chu": "Sóng E"},
]


class LacResponse(BaseModel):
    id: int
    loai_lop: str
    flute_type: str | None
    he_so: Decimal
    ghi_chu: str | None

    class Config:
        from_attributes = True


class LacUpdate(BaseModel):
    he_so: Decimal | None = None
    ghi_chu: str | None = None


@router.get("", response_model=list[LacResponse])
def list_coefficients(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.query(LayerAllocationCoefficient)
        .order_by(LayerAllocationCoefficient.loai_lop, LayerAllocationCoefficient.flute_type)
        .all()
    )


@router.put("/{item_id}", response_model=LacResponse)
def update_coefficient(
    item_id: int,
    data: LacUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_admin_required),
):
    item = db.get(LayerAllocationCoefficient, item_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy hệ số phân bổ")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/seed", status_code=201)
def seed_defaults(
    db: Session = Depends(get_db),
    _: User = Depends(_admin_required),
):
    """Reset toàn bộ hệ số phân bổ về giá trị mặc định."""
    db.query(LayerAllocationCoefficient).delete()
    for row in _DEFAULTS:
        db.add(LayerAllocationCoefficient(
            loai_lop=row["loai_lop"],
            flute_type=row["flute_type"],
            he_so=row["he_so"],
            ghi_chu=row["ghi_chu"],
        ))
    db.commit()
    total = db.query(LayerAllocationCoefficient).count()
    return {"message": f"Đã seed {total} hệ số phân bổ mặc định"}
