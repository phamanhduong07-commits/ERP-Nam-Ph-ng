"""
routers/addon_rates.py
======================
Quản lý đơn giá phí gia công (addon rates).

GET  /api/addon-rates            — lấy toàn bộ danh sách
PUT  /api/addon-rates/{id}       — cập nhật đơn giá
POST /api/addon-rates/seed       — reset về giá trị mặc định
"""

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.addon_rate import AddonRate

router = APIRouter(prefix="/api/addon-rates", tags=["addon-rates"])

# ─── Mặc định ────────────────────────────────────────────────────────────────

_DEFAULTS = [
    {"ma_chi_phi": "d1_1_mat",      "nhom": "d1", "ten": "Chống thấm 1 mặt",              "don_vi": "m2",  "don_gia": 500,   "thu_tu": 1,  "ghi_chu": ""},
    {"ma_chi_phi": "d1_2_mat",      "nhom": "d1", "ten": "Chống thấm 2 mặt",              "don_vi": "m2",  "don_gia": 1000,  "thu_tu": 2,  "ghi_chu": ""},
    {"ma_chi_phi": "d2_base",       "nhom": "d2", "ten": "In Flexo — 1 màu (giá cơ bản)", "don_vi": "m2",  "don_gia": 300,   "thu_tu": 3,  "ghi_chu": "Giá cho màu đầu tiên"},
    {"ma_chi_phi": "d2_them_mau",   "nhom": "d2", "ten": "In Flexo — mỗi màu thêm",       "don_vi": "m2",  "don_gia": 50,    "thu_tu": 4,  "ghi_chu": "+50 đ/m² cho mỗi màu thêm từ màu 2"},
    {"ma_chi_phi": "d2_phu_nen",    "nhom": "d2", "ten": "In Flexo — phủ nền",             "don_vi": "m2",  "don_gia": 100,   "thu_tu": 5,  "ghi_chu": "Cộng thêm nếu có phủ nền"},
    {"ma_chi_phi": "d3_in_kts",     "nhom": "d3", "ten": "In kỹ thuật số",                 "don_vi": "pcs", "don_gia": 2233,  "thu_tu": 6,  "ghi_chu": ""},
    {"ma_chi_phi": "d4_chap_xa",    "nhom": "d4", "ten": "Chạp / Xả",                     "don_vi": "pcs", "don_gia": 150,   "thu_tu": 7,  "ghi_chu": ""},
    {"ma_chi_phi": "d5_boi",        "nhom": "d5", "ten": "Bồi",                            "don_vi": "m2",  "don_gia": 187,   "thu_tu": 8,  "ghi_chu": ""},
    {"ma_chi_phi": "d6_1_con",      "nhom": "d6", "ten": "Bế — 1 con/khuôn",              "don_vi": "pcs", "don_gia": 400,   "thu_tu": 9,  "ghi_chu": ""},
    {"ma_chi_phi": "d6_2_con",      "nhom": "d6", "ten": "Bế — 2 con/khuôn",              "don_vi": "pcs", "don_gia": 300,   "thu_tu": 10, "ghi_chu": ""},
    {"ma_chi_phi": "d6_4_con",      "nhom": "d6", "ten": "Bế — 4 con/khuôn",              "don_vi": "pcs", "don_gia": 200,   "thu_tu": 11, "ghi_chu": ""},
    {"ma_chi_phi": "d6_6_con",      "nhom": "d6", "ten": "Bế — 6 con/khuôn",              "don_vi": "pcs", "don_gia": 150,   "thu_tu": 12, "ghi_chu": ""},
    {"ma_chi_phi": "d6_8_con",      "nhom": "d6", "ten": "Bế — 8 con/khuôn",              "don_vi": "pcs", "don_gia": 100,   "thu_tu": 13, "ghi_chu": ""},
    {"ma_chi_phi": "d7_dan",        "nhom": "d7", "ten": "Dán",                            "don_vi": "pcs", "don_gia": 0,     "thu_tu": 14, "ghi_chu": "Giá cần cập nhật"},
    {"ma_chi_phi": "d7_ghim",       "nhom": "d7", "ten": "Ghim",                           "don_vi": "pcs", "don_gia": 0,     "thu_tu": 15, "ghi_chu": "Giá cần cập nhật"},
    {"ma_chi_phi": "d8_1_mat",      "nhom": "d8", "ten": "Cán màng 1 mặt",                "don_vi": "m2",  "don_gia": 1800,  "thu_tu": 16, "ghi_chu": ""},
    {"ma_chi_phi": "d8_2_mat",      "nhom": "d8", "ten": "Cán màng 2 mặt",                "don_vi": "m2",  "don_gia": 3600,  "thu_tu": 17, "ghi_chu": ""},
    {"ma_chi_phi": "d9_pct",        "nhom": "d9", "ten": "Sản phẩm khó (% của A+B+E)",    "don_vi": "pct", "don_gia": 2,     "thu_tu": 18, "ghi_chu": "Tỷ lệ % nhân với (CP giấy + CP gián tiếp + CP hao hụt)"},
]


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AddonRateResponse(BaseModel):
    id: int
    ma_chi_phi: str
    nhom: str
    ten: str
    don_vi: str
    don_gia: Decimal
    ghi_chu: str | None
    thu_tu: int

    class Config:
        from_attributes = True


class AddonRateUpdate(BaseModel):
    ten: str | None = None
    don_gia: Decimal | None = None
    ghi_chu: str | None = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AddonRateResponse])
def list_items(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lấy tất cả khoản mục phí gia công, sắp xếp theo thứ tự."""
    return (
        db.query(AddonRate)
        .order_by(AddonRate.thu_tu)
        .all()
    )


@router.put("/{item_id}", response_model=AddonRateResponse)
def update_item(
    item_id: int,
    data: AddonRateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.query(AddonRate).filter(AddonRate.id == item_id).first()
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
    """Reset toàn bộ phí gia công về giá trị mặc định."""
    db.query(AddonRate).delete()
    for row in _DEFAULTS:
        db.add(AddonRate(
            ma_chi_phi=row["ma_chi_phi"],
            nhom=row["nhom"],
            ten=row["ten"],
            don_vi=row["don_vi"],
            don_gia=Decimal(str(row["don_gia"])),
            thu_tu=row["thu_tu"],
            ghi_chu=row["ghi_chu"] or None,
        ))
    db.commit()
    total = db.query(AddonRate).count()
    return {"message": f"Đã reset về mặc định ({total} khoản mục)"}


def get_addon_rates_from_db(db: Session) -> dict | None:
    """Return dict of {ma_chi_phi: don_gia} or None if table is empty."""
    items = db.query(AddonRate).all()
    if not items:
        return None
    return {i.ma_chi_phi: float(i.don_gia) for i in items}
