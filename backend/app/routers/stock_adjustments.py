"""Warehouse router — kiểm kê / điều chỉnh tồn kho (StockAdjustment).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.inventory import InventoryBalance
from app.models.master import Warehouse, PaperMaterial, OtherMaterial, Product, PhanXuong
from app.models.warehouse_doc import (
    StockAdjustment, StockAdjustmentItem,
)
from app.services.accounting_service import AccountingService
from app.utils.log import get_logger

logger = get_logger(__name__)

from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
)

from app.routers.warehouse import (  # shared schemas + helpers
    StockAdjustmentItemIn,
    StockAdjustmentIn,
    _gen_so,
    _tk_inventory,
    _ensure_active_warehouse,
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


# --- Kiem ke / dieu chinh ton kho -------------------------------------------------

@router.get("/stock-adjustments")
def list_stock_adjustments(
    warehouse_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(StockAdjustment)
    if phan_xuong_id or phap_nhan_id:
        q = q.join(Warehouse, Warehouse.id == StockAdjustment.warehouse_id)
    if warehouse_id:
        q = q.filter(StockAdjustment.warehouse_id == warehouse_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
    if tu_ngay:
        q = q.filter(StockAdjustment.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(StockAdjustment.ngay <= den_ngay)
    rows = q.options(joinedload(StockAdjustment.items)).order_by(StockAdjustment.created_at.desc()).all()
    return [_adj_to_dict(r, db) for r in rows]


@router.get("/stock-adjustments/{adj_id}")
def get_stock_adjustment(adj_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    adj = db.query(StockAdjustment).options(joinedload(StockAdjustment.items)).filter(StockAdjustment.id == adj_id).first()
    if not adj:
        raise HTTPException(404, "Khong tim thay phieu kiem ke")
    return _adj_to_dict(adj, db)


@router.post("/stock-adjustments", status_code=201)
def create_stock_adjustment(
    body: StockAdjustmentIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("KHO", "KHO_TO_TRUONG", "KE_TOAN", "ADMIN")),
):
    if not body.items:
        raise HTTPException(400, "Phieu kiem ke phai co it nhat 1 dong hang")
    if not db.get(Warehouse, body.warehouse_id):
        raise HTTPException(404, "Khong tim thay kho")

    balances: list[tuple[StockAdjustmentItemIn, InventoryBalance, Decimal]] = []
    seen_balance_ids: set[int] = set()
    for it in body.items:
        if it.inventory_balance_id in seen_balance_ids:
            raise HTTPException(400, "Mot mat hang chi duoc dieu chinh mot lan trong phieu")
        seen_balance_ids.add(it.inventory_balance_id)

        bal = db.get(InventoryBalance, it.inventory_balance_id)
        if not bal or bal.warehouse_id != body.warehouse_id:
            raise HTTPException(400, "Mat hang kiem ke khong thuoc kho da chon")
        if it.so_luong_thuc_te < 0:
            raise HTTPException(400, "So luong thuc te khong duoc am")

        diff = it.so_luong_thuc_te - bal.ton_luong
        balances.append((it, bal, diff))

    if all(diff == 0 for _, _, diff in balances):
        raise HTTPException(400, "Khong co chenh lech ton kho de dieu chinh")

    try:
        adj = StockAdjustment(
            so_phieu=_gen_so(db, "KK", StockAdjustment),
            warehouse_id=body.warehouse_id,
            ngay=body.ngay,
            ly_do=body.ly_do,
            ghi_chu=body.ghi_chu,
            created_by=current_user.id,
        )
        db.add(adj)
        db.flush()

        wh = _ensure_active_warehouse(db, body.warehouse_id)
        journal_items_adj = []
        for it, bal, diff in balances:
            ten_hang = _balance_item_name(db, bal)
            don_vi = bal.don_vi or _balance_item_unit(db, bal)
            don_gia = bal.don_gia_binh_quan or Decimal("0")

            db.add(StockAdjustmentItem(
                adjustment_id=adj.id,
                inventory_balance_id=bal.id,
                paper_material_id=bal.paper_material_id,
                other_material_id=bal.other_material_id,
                product_id=bal.product_id,
                ten_hang=ten_hang,
                don_vi=don_vi,
                so_luong_so_sach=bal.ton_luong,
                so_luong_thuc_te=it.so_luong_thuc_te,
                chenhlech=diff,
                don_gia=don_gia,
                ghi_chu=it.ghi_chu,
            ))

            if diff > 0:
                _nhap_balance(bal, diff, don_gia)
                loai = "DIEU_CHINH_TANG"
                so_luong_tx = diff
            else:
                _xuat_balance(bal, -diff, ten_hang)
                loai = "DIEU_CHINH_GIAM"
                so_luong_tx = -diff

            _log_tx(db, body.warehouse_id, loai,
                    so_luong_tx, don_gia, bal.ton_luong,
                    "stock_adjustment", adj.id, current_user.id,
                    paper_material_id=bal.paper_material_id,
                    other_material_id=bal.other_material_id,
                    product_id=bal.product_id,
                    ghi_chu=it.ghi_chu or body.ly_do)
            journal_items_adj.append({
                "ten_hang": ten_hang,
                "so_luong": abs(diff),
                "don_gia": don_gia,
                "tk_no": _tk_inventory(bal.paper_material_id, bal.other_material_id, bal.product_id, wh.loai_kho) if diff > 0 else "811",
                "tk_co": _tk_inventory(bal.paper_material_id, bal.other_material_id, bal.product_id, wh.loai_kho) if diff < 0 else "711",
            })

        # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
        acc_service = AccountingService(db)
        phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None

        if not adj.bo_qua_hach_toan:
            acc_service.post_inventory_journal(
                ngay=adj.ngay,
                loai="DIEU_CHINH",
                chung_tu_loai="stock_adjustment",
                chung_tu_id=adj.id,
                phap_nhan_id=phap_nhan_id,
                phan_xuong_id=wh.phan_xuong_id if wh else None,
                items=journal_items_adj,
            )

        db.commit()
        db.refresh(adj)
        return _adj_to_dict(adj, db)
    except Exception:
        db.rollback()
        raise


@router.delete("/stock-adjustments/{adj_id}")
def delete_stock_adjustment(adj_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("KHO", "KHO_TO_TRUONG", "KE_TOAN", "ADMIN"))):
    adj = db.get(StockAdjustment, adj_id)
    if not adj:
        raise HTTPException(404, "Khong tim thay phieu kiem ke")
    if adj.trang_thai != "nhap":
        raise HTTPException(400, "Chi duoc xoa phieu o trang thai Nhap")

    for it in adj.items:
        bal = _get_or_create_balance(
            db, adj.warehouse_id,
            it.paper_material_id, it.other_material_id, it.product_id,
            ten_hang=it.ten_hang, don_vi=it.don_vi,
        )
        if it.chenhlech > 0:
            _xuat_balance(bal, it.chenhlech, it.ten_hang)
            _log_tx(db, adj.warehouse_id, "XOA_DIEU_CHINH_TANG",
                    it.chenhlech, it.don_gia, bal.ton_luong,
                    "stock_adjustment", adj.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    product_id=it.product_id,
                    ghi_chu=f"Xóa {adj.so_phieu}")
        elif it.chenhlech < 0:
            _nhap_balance(bal, -it.chenhlech, it.don_gia)
            _log_tx(db, adj.warehouse_id, "XOA_DIEU_CHINH_GIAM",
                    -it.chenhlech, it.don_gia, bal.ton_luong,
                    "stock_adjustment", adj.id, current_user.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    product_id=it.product_id,
                    ghi_chu=f"Xóa {adj.so_phieu}")

    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("stock_adjustment", adj_id)

    db.delete(adj)
    db.commit()
    return {"ok": True}


def _balance_item_name(db: Session, bal: InventoryBalance) -> str:
    if bal.paper_material_id:
        mat = db.get(PaperMaterial, bal.paper_material_id)
        if mat:
            return mat.ten
    if bal.other_material_id:
        mat = db.get(OtherMaterial, bal.other_material_id)
        if mat:
            return mat.ten
    if bal.product_id:
        prod = db.get(Product, bal.product_id)
        if prod:
            return prod.ten_san_pham
    return bal.ten_hang or ""


def _balance_item_unit(db: Session, bal: InventoryBalance) -> str:
    if bal.paper_material_id:
        mat = db.get(PaperMaterial, bal.paper_material_id)
        if mat:
            return mat.dvt
    if bal.other_material_id:
        mat = db.get(OtherMaterial, bal.other_material_id)
        if mat:
            return mat.dvt
    if bal.product_id:
        prod = db.get(Product, bal.product_id)
        if prod:
            return getattr(prod, "dvt", "Thung") or "Thung"
    return bal.don_vi or "Kg"


def _adj_to_dict(adj: StockAdjustment, db: Session) -> dict:
    wh = db.get(Warehouse, adj.warehouse_id)
    phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None
    return {
        "id": adj.id,
        "so_phieu": adj.so_phieu,
        "warehouse_id": adj.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "phap_nhan_id": phap_nhan_id,
        "ngay": str(adj.ngay),
        "ly_do": adj.ly_do,
        "ghi_chu": adj.ghi_chu,
        "trang_thai": adj.trang_thai,
        "created_at": adj.created_at.isoformat() if adj.created_at else None,
        "items": [{
            "id": it.id,
            "inventory_balance_id": it.inventory_balance_id,
            "paper_material_id": it.paper_material_id,
            "other_material_id": it.other_material_id,
            "product_id": it.product_id,
            "ten_hang": it.ten_hang,
            "don_vi": it.don_vi,
            "so_luong_so_sach": float(it.so_luong_so_sach),
            "so_luong_thuc_te": float(it.so_luong_thuc_te),
            "chenhlech": float(it.chenhlech),
            "don_gia": float(it.don_gia),
            "ghi_chu": it.ghi_chu,
        } for it in adj.items],
    }
