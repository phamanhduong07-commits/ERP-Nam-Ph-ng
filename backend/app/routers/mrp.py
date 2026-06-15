from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_any_permission
from app.models.auth import User
from app.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
from app.services.mrp_service import calculate_mrp

router = APIRouter(
    prefix="/api/mrp",
    dependencies=[Depends(require_any_permission("production_order.view"))],
    tags=["MRP Lite"],
)


class MRPRequest(BaseModel):
    production_order_ids: list[int]


class MRPRow(BaseModel):
    paper_material_id: int
    ten_nguyen_lieu: str
    ma_ky_hieu: str
    can_thiet_kg: float
    ton_kho_kg: float
    thieu_hut_kg: float


class CreateYMHRequest(BaseModel):
    production_order_ids: list[int]
    chi_tinh_thieu_hut: bool = True     # nếu True: chỉ tạo item cho vật liệu thiếu
    ngay_can: date | None = None


class CreateYMHResponse(BaseModel):
    so_ymh: str
    ymh_id: int
    so_vat_lieu: int


def _next_so_ymh(db: Session) -> str:
    from datetime import date as _date
    ym = _date.today().strftime("%Y%m")
    prefix = f"YMH-MRP-{ym}-"
    last = (
        db.query(PurchaseRequisition)
        .filter(PurchaseRequisition.so_ymh.like(f"{prefix}%"))
        .order_by(PurchaseRequisition.id.desc())
        .first()
    )
    seq = int(last.so_ymh.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{seq:03d}"


@router.post("/calculate", response_model=list[MRPRow])
def mrp_calculate(
    data: MRPRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Tính nhu cầu nguyên liệu từ danh sách lệnh sản xuất."""
    if not data.production_order_ids:
        raise HTTPException(400, "Cần ít nhất 1 lệnh sản xuất")
    rows = calculate_mrp(data.production_order_ids, db)
    return rows


@router.post("/create-ymh", response_model=CreateYMHResponse, status_code=201)
def mrp_create_ymh(
    data: CreateYMHRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo YMH từ kết quả MRP — chỉ tạo item cho vật liệu thiếu hụt."""
    if not data.production_order_ids:
        raise HTTPException(400, "Cần ít nhất 1 lệnh sản xuất")

    rows = calculate_mrp(data.production_order_ids, db)
    if data.chi_tinh_thieu_hut:
        rows = [r for r in rows if r["thieu_hut_kg"] > 0]

    if not rows:
        raise HTTPException(400, "Không có nguyên liệu nào cần đặt mua")

    so_ymh = _next_so_ymh(db)
    ymh = PurchaseRequisition(
        so_ymh=so_ymh,
        ngay_yeu_cau=date.today(),
        trang_thai="nhap",
        nguoi_yeu_cau_id=current_user.id,
        ghi_chu=f"Tạo tự động từ MRP — {len(data.production_order_ids)} lệnh SX",
    )
    db.add(ymh)
    db.flush()

    for r in rows:
        so_luong = r["thieu_hut_kg"] if data.chi_tinh_thieu_hut else r["can_thiet_kg"]
        item = PurchaseRequisitionItem(
            ymh_id=ymh.id,
            paper_material_id=r["paper_material_id"],
            ten_hang=r["ten_nguyen_lieu"],
            so_luong=so_luong,
            dvt="Kg",
            ngay_can=data.ngay_can,
            ghi_chu=f"Cần: {r['can_thiet_kg']:.1f}kg | Tồn: {r['ton_kho_kg']:.1f}kg",
        )
        db.add(item)

    db.commit()
    return CreateYMHResponse(so_ymh=so_ymh, ymh_id=ymh.id, so_vat_lieu=len(rows))
