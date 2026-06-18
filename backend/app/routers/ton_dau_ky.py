from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import require_roles
from app.models.auth import User
from app.models.inventory import InventoryBalance
from app.models.master import Warehouse, PaperMaterial, OtherMaterial
from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    log_tx as _log_tx,
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


class TonDauKyItem(BaseModel):
    warehouse_id: int
    paper_material_id: Optional[int] = None
    other_material_id: Optional[int] = None
    so_luong: float
    don_gia: float
    ten_hang: Optional[str] = None
    don_vi: Optional[str] = None


class TonDauKyPayload(BaseModel):
    items: List[TonDauKyItem]


@router.get("/ton-dau-ky")
def get_ton_dau_ky(
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("KHO_TO_TRUONG", "KE_TOAN_TRUONG", "ADMIN")),
):
    q = db.query(InventoryBalance)
    if warehouse_id:
        q = q.filter(InventoryBalance.warehouse_id == warehouse_id)
    balances = q.all()

    result = []
    for b in balances:
        wh = db.get(Warehouse, b.warehouse_id)
        ten_hang = b.ten_hang or ""
        ma_hang = ""
        if b.paper_material_id:
            mat = db.get(PaperMaterial, b.paper_material_id)
            if mat:
                ten_hang = ten_hang or mat.ten
                ma_hang = mat.ma_chinh or ""
        elif b.other_material_id:
            mat = db.get(OtherMaterial, b.other_material_id)
            if mat:
                ten_hang = ten_hang or mat.ten
                ma_hang = mat.ma_chinh or ""
        result.append({
            "id": b.id,
            "warehouse_id": b.warehouse_id,
            "ten_kho": wh.ten_kho if wh else "",
            "paper_material_id": b.paper_material_id,
            "other_material_id": b.other_material_id,
            "product_id": b.product_id,
            "ma_hang": ma_hang,
            "ten_hang": ten_hang,
            "don_vi": b.don_vi or "Kg",
            "ton_luong": float(b.ton_luong or 0),
            "don_gia_binh_quan": float(b.don_gia_binh_quan or 0),
            "gia_tri_ton": float(b.gia_tri_ton or 0),
            "cap_nhat_luc": b.cap_nhat_luc.isoformat() if b.cap_nhat_luc else None,
        })
    return result


@router.post("/ton-dau-ky")
def post_ton_dau_ky(
    body: TonDauKyPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KHO_TO_TRUONG", "KE_TOAN_TRUONG", "ADMIN")),
):
    if not body.items:
        raise HTTPException(400, "Danh sách tồn đầu kỳ không được rỗng")

    success = 0
    failed = []

    for idx, item in enumerate(body.items):
        try:
            if not db.get(Warehouse, item.warehouse_id):
                raise ValueError(f"Không tìm thấy kho id={item.warehouse_id}")
            if item.so_luong <= 0:
                raise ValueError("Số lượng phải lớn hơn 0")
            if item.don_gia < 0:
                raise ValueError("Đơn giá không được âm")

            ten_hang = item.ten_hang or ""
            don_vi = item.don_vi or "Kg"

            if not ten_hang:
                if item.paper_material_id:
                    mat = db.get(PaperMaterial, item.paper_material_id)
                    ten_hang = mat.ten if mat else ""
                elif item.other_material_id:
                    mat = db.get(OtherMaterial, item.other_material_id)
                    ten_hang = mat.ten if mat else ""

            balance = _get_or_create_balance(
                db,
                item.warehouse_id,
                paper_material_id=item.paper_material_id,
                other_material_id=item.other_material_id,
                ten_hang=ten_hang,
                don_vi=don_vi,
            )

            loai_tx = "ton_dau_ky"
            if balance.ton_luong > 0:
                loai_tx = "ton_dau_ky_bo_sung"

            so_luong = Decimal(str(item.so_luong))
            don_gia = Decimal(str(item.don_gia))

            _nhap_balance(balance, so_luong, don_gia)
            _log_tx(
                db,
                item.warehouse_id,
                loai_tx,
                so_luong,
                don_gia,
                balance.ton_luong,
                "ton_dau_ky",
                0,
                current_user.id,
                paper_material_id=item.paper_material_id,
                other_material_id=item.other_material_id,
                ghi_chu="Nhập tồn đầu kỳ",
            )
            success += 1
        except Exception as e:
            db.rollback()
            failed.append({"index": idx, "error": str(e)})
            continue

    if success > 0:
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(500, f"Lỗi lưu dữ liệu: {str(e)}")

    return {"success": success, "failed": failed}
