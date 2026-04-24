"""
routers/indirect_costs.py
=========================
Quản lý chi phí gián tiếp theo số lớp (3/5/7 lớp).

GET  /api/indirect-costs            — lấy toàn bộ danh sách
PUT  /api/indirect-costs/{id}       — cập nhật đơn giá
POST /api/indirect-costs/seed       — reset về giá trị mặc định
"""

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.indirect_cost import IndirectCostItem

router = APIRouter(prefix="/api/indirect-costs", tags=["indirect-costs"])

# ─── Mặc định (mirror của price_calculator._INDIRECT_BREAKDOWN) ───────────────

_DEFAULTS: dict[int, list[dict]] = {
    3: [
        {"ten": "Bột",                           "don_gia_m2": 137.0,   "thu_tu": 1},
        {"ten": "Gas / Củi",                     "don_gia_m2": 194.0,   "thu_tu": 2},
        {"ten": "Xút",                           "don_gia_m2": 14.0,    "thu_tu": 3},
        {"ten": "Điện",                          "don_gia_m2": 50.0,    "thu_tu": 4},
        {"ten": "Lương sóng",                    "don_gia_m2": 160.0,   "thu_tu": 5},
        {"ten": "Khấu hao nhà xưởng",            "don_gia_m2": 130.0,   "thu_tu": 6},
        {"ten": "Khấu hao máy móc",              "don_gia_m2": 100.0,   "thu_tu": 7},
        {"ten": "Chi phí gián tiếp (văn phòng)", "don_gia_m2": 113.0,   "thu_tu": 8},
    ],
    5: [
        {"ten": "Bột",                           "don_gia_m2": 274.0,   "thu_tu": 1},
        {"ten": "Gas / Củi",                     "don_gia_m2": 194.0,   "thu_tu": 2},
        {"ten": "Xút",                           "don_gia_m2": 28.0,    "thu_tu": 3},
        {"ten": "Điện",                          "don_gia_m2": 49.2,    "thu_tu": 4},
        {"ten": "Lương sóng",                    "don_gia_m2": 200.0,   "thu_tu": 5},
        {"ten": "Khấu hao nhà xưởng",            "don_gia_m2": 130.0,   "thu_tu": 6},
        {"ten": "Khấu hao máy móc",              "don_gia_m2": 150.0,   "thu_tu": 7},
        {"ten": "Chi phí gián tiếp (văn phòng)", "don_gia_m2": 153.0,   "thu_tu": 8},
    ],
    7: [
        {"ten": "Bột",                           "don_gia_m2": 274.0,   "thu_tu": 1},
        {"ten": "Gas / Củi",                     "don_gia_m2": 194.0,   "thu_tu": 2},
        {"ten": "Xút",                           "don_gia_m2": 28.0,    "thu_tu": 3},
        {"ten": "Điện",                          "don_gia_m2": 49.2,    "thu_tu": 4},
        {"ten": "Lương sóng",                    "don_gia_m2": 200.0,   "thu_tu": 5},
        {"ten": "Khấu hao nhà xưởng",            "don_gia_m2": 130.0,   "thu_tu": 6},
        {"ten": "Khấu hao máy móc",              "don_gia_m2": 150.0,   "thu_tu": 7},
        {"ten": "Chi phí gián tiếp (văn phòng)", "don_gia_m2": 775.0,   "thu_tu": 8},
    ],
}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class IndirectCostItemResponse(BaseModel):
    id: int
    so_lop: int
    ten: str
    don_gia_m2: Decimal
    thu_tu: int
    ghi_chu: str | None

    class Config:
        from_attributes = True


class IndirectCostItemUpdate(BaseModel):
    ten: str | None = None
    don_gia_m2: Decimal | None = None
    thu_tu: int | None = None
    ghi_chu: str | None = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[IndirectCostItemResponse])
def list_items(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lấy tất cả khoản mục chi phí gián tiếp, sắp xếp theo số lớp và thứ tự."""
    return (
        db.query(IndirectCostItem)
        .order_by(IndirectCostItem.so_lop, IndirectCostItem.thu_tu)
        .all()
    )


@router.put("/{item_id}", response_model=IndirectCostItemResponse)
def update_item(
    item_id: int,
    data: IndirectCostItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.query(IndirectCostItem).filter(IndirectCostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản mục")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/seed", status_code=201)
def seed_defaults(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Reset toàn bộ chi phí gián tiếp về giá trị mặc định."""
    db.query(IndirectCostItem).delete()
    for so_lop, items in _DEFAULTS.items():
        for row in items:
            db.add(IndirectCostItem(
                so_lop=so_lop,
                ten=row["ten"],
                don_gia_m2=Decimal(str(row["don_gia_m2"])),
                thu_tu=row["thu_tu"],
            ))
    db.commit()
    total = db.query(IndirectCostItem).count()
    return {"message": f"Đã reset về mặc định ({total} khoản mục)"}


def get_indirect_breakdown_from_db(so_lop: int, db: Session) -> list[dict] | None:
    """Lấy bảng chi phí gián tiếp từ DB cho số lớp nhất định. None nếu chưa seed."""
    items = (
        db.query(IndirectCostItem)
        .filter(IndirectCostItem.so_lop == so_lop)
        .order_by(IndirectCostItem.thu_tu)
        .all()
    )
    if not items:
        return None
    return [{"ten": i.ten, "don_gia_m2": float(i.don_gia_m2)} for i in items]
