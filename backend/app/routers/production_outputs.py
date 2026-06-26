"""Warehouse router — nhập thành phẩm từ sản xuất (ProductionOutput).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.master import Warehouse, Product, PhanXuong
from app.models.production import ProductionOrder
from app.models.warehouse_doc import (
    ProductionOutput, DeliveryOrder,
    DeliveryOrderItem,
)
from app.services.accounting_service import AccountingService
from app.services.defect_record_service import auto_defect_record
from app.utils.log import get_logger

logger = get_logger(__name__)

from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
    get_workshop_warehouse as _get_workshop_warehouse,
)

from app.routers.warehouse import (  # shared schemas + helpers
    ProductionOutputIn,
    _gen_so,
    _ensure_active_warehouse,
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


# ── Nhập thành phẩm từ sản xuất (ProductionOutput) ───────────────────────────

@router.get("/production-outputs")
def list_production_outputs(
    warehouse_id: Optional[int] = Query(None),
    production_order_id: Optional[int] = Query(None),
    phan_xuong_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ProductionOutput)
    if phan_xuong_id or phap_nhan_id:
        q = q.join(Warehouse, Warehouse.id == ProductionOutput.warehouse_id)
    if warehouse_id:
        q = q.filter(ProductionOutput.warehouse_id == warehouse_id)
    if production_order_id:
        q = q.filter(ProductionOutput.production_order_id == production_order_id)
    if phan_xuong_id:
        q = q.filter(Warehouse.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.join(PhanXuong, Warehouse.phan_xuong_id == PhanXuong.id).filter(PhanXuong.phap_nhan_id == phap_nhan_id)
    if tu_ngay:
        q = q.filter(ProductionOutput.ngay_nhap >= tu_ngay)
    if den_ngay:
        q = q.filter(ProductionOutput.ngay_nhap <= den_ngay)
    rows = q.options(joinedload(ProductionOutput.creator)).order_by(ProductionOutput.created_at.desc()).limit(200).all()
    return [_po_out_to_dict(r, db) for r in rows]


@router.get("/production-outputs/{out_id}")
def get_production_output(out_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.get(ProductionOutput, out_id)
    if not r:
        raise HTTPException(404, "Không tìm thấy phiếu nhập thành phẩm")
    return _po_out_to_dict(r, db)


@router.post("/production-outputs", status_code=201)
def create_production_output(
    body: ProductionOutputIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.get(ProductionOrder, body.production_order_id)
    if not order:
        raise HTTPException(404, "Không tìm thấy lệnh sản xuất")

    # Auto-fill kho THANH_PHAM của xưởng nếu chưa truyền
    warehouse_id = body.warehouse_id
    if not warehouse_id and order.phan_xuong_id:
        wh = _get_workshop_warehouse(db, order.phan_xuong_id, "THANH_PHAM",
                                     raise_if_missing=True)
        warehouse_id = wh.id if wh else None
    if not warehouse_id:
        raise HTTPException(400, "Cần truyền warehouse_id hoặc lệnh SX phải có xưởng có kho THANH_PHAM")
    if not _ensure_active_warehouse(db, warehouse_id, {"THANH_PHAM", "BTP"}):
        raise HTTPException(404, "Không tìm thấy kho")

    ten_hang = body.ten_hang
    dvt = body.dvt
    if body.product_id:
        prod = db.get(Product, body.product_id)
        if prod:
            ten_hang = ten_hang or prod.ten_san_pham
            dvt = dvt or getattr(prod, "dvt", "Thùng") or "Thùng"

    # Auto-fill don_gia_xuat_xuong từ phiên sản xuất nếu chưa nhập và có session
    don_gia = body.don_gia_xuat_xuong
    session_id = body.production_session_id
    if session_id and don_gia == 0:
        from app.models.production import ProductionSession
        import json as _json
        sess = db.get(ProductionSession, session_id)
        if sess and sess.allocation_detail:
            alloc = sess.allocation_detail if isinstance(sess.allocation_detail, list) else _json.loads(sess.allocation_detail)
            # Gộp chi_phi_tong của tất cả LSX item thuộc production_order_id này
            total_cost = sum(
                float(a.get("chi_phi_tong") or 0)
                for a in alloc
                if a.get("production_order_id") == body.production_order_id
            )
            if total_cost > 0 and body.so_luong_nhap > 0:
                don_gia = Decimal(str(round(total_cost / float(body.so_luong_nhap), 2)))

    out = ProductionOutput(
        so_phieu=_gen_so(db, "TP", ProductionOutput),
        ngay_nhap=body.ngay_nhap,
        production_order_id=body.production_order_id,
        warehouse_id=warehouse_id,
        product_id=body.product_id,
        ten_hang=ten_hang,
        so_luong_nhap=body.so_luong_nhap,
        so_luong_loi=body.so_luong_loi,
        trang_thai_loi='da_nhap_kho_ao' if body.so_luong_loi > 0 else None,
        dvt=dvt,
        don_gia_xuat_xuong=don_gia,
        production_session_id=session_id,
        ghi_chu=body.ghi_chu,
        created_by=current_user.id,
    )
    db.add(out)
    db.flush()

    bal = _get_or_create_balance(db, warehouse_id,
                                 product_id=body.product_id,
                                 ten_hang=ten_hang, don_vi=dvt)
    _nhap_balance(bal, body.so_luong_nhap, body.don_gia_xuat_xuong)
    _log_tx(db, warehouse_id, "NHAP_SX",
            body.so_luong_nhap, body.don_gia_xuat_xuong, bal.ton_luong,
            "production_outputs", out.id, current_user.id,
            product_id=body.product_id,
            ghi_chu=body.ghi_chu)

    # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
    acc_service = AccountingService(db)
    
    # Lấy thông tin pháp nhân và xưởng
    wh = db.get(Warehouse, warehouse_id)
    phap_nhan_id = wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None
    
    # Nhập kho thành phẩm: Nợ 155 (tại kho) / Có 154 (tại xưởng SX)
    if not out.bo_qua_hach_toan:
        # Lấy thông tin xưởng sản xuất từ Lệnh sản xuất
        producing_px_id = out.production_order.phan_xuong_id if out.production_order else None
        producing_pn_id = out.production_order.phap_nhan_id if out.production_order else None

        acc_service.post_inventory_journal(
            ngay=out.ngay_nhap,
            loai="NHAP_TP",
            chung_tu_loai="phieu_nhap_tp",
            chung_tu_id=out.id,
            phap_nhan_id=phap_nhan_id, # Default PN (from warehouse)
            phan_xuong_id=wh.phan_xuong_id if wh else None, # Default PX (storing)
            items=[{
                "ten_hang": out.production_order.items[0].ten_hang if out.production_order and out.production_order.items else "Thành phẩm",
                "so_luong": out.so_luong_nhap,
                "don_gia": out.don_gia_xuat_xuong or 0,
                "tk_no": "155",
                "tk_co": "154",
                "phan_xuong_id_no": wh.phan_xuong_id if wh else None, # Tăng tài sản tại Kho
                "phan_xuong_id_co": producing_px_id,                   # Giảm chi phí tại Xưởng SX
                "phap_nhan_id_no": phap_nhan_id,
                "phap_nhan_id_co": producing_pn_id
            }]
        )

    # Auto-create DefectRecord ngay khi có hàng lỗi — không cần nút "Nhập kho ảo"
    if out.so_luong_loi and out.so_luong_loi > 0:
        auto_defect_record(
            db,
            ref_id=out.id,
            ref_type="production_output",
            khau="tp",
            so_luong=out.so_luong_loi,
            created_by=current_user.id,
        )

    db.commit()
    db.refresh(out)
    return _po_out_to_dict(out, db)


@router.delete("/production-outputs/{out_id}")
def delete_production_output(out_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    out = db.get(ProductionOutput, out_id)
    if not out:
        raise HTTPException(404, "Không tìm thấy phiếu nhập thành phẩm")

    tong_nhap_lsx = db.query(
        func.coalesce(func.sum(ProductionOutput.so_luong_nhap), 0)
    ).filter(
        ProductionOutput.production_order_id == out.production_order_id,
        ProductionOutput.warehouse_id == out.warehouse_id,
    ).scalar() or Decimal("0")
    tong_xuat_lsx = db.query(
        func.coalesce(func.sum(DeliveryOrderItem.so_luong), 0)
    ).join(
        DeliveryOrder, DeliveryOrder.id == DeliveryOrderItem.delivery_id
    ).filter(
        DeliveryOrderItem.production_order_id == out.production_order_id,
        DeliveryOrder.warehouse_id == out.warehouse_id,
    ).scalar() or Decimal("0")
    if Decimal(str(tong_nhap_lsx)) - out.so_luong_nhap < Decimal(str(tong_xuat_lsx)):
        raise HTTPException(400, "Khong the xoa phieu nhap TP vi hang cua LSX da duoc xuat giao")

    bal = _get_or_create_balance(db, out.warehouse_id,
                                 product_id=out.product_id,
                                 ten_hang=out.ten_hang or "", don_vi=out.dvt)
    _xuat_balance(bal, out.so_luong_nhap, out.ten_hang or "")
    _log_tx(db, out.warehouse_id, "XOA_NHAP_SX",
            out.so_luong_nhap, out.don_gia_xuat_xuong or Decimal("0"), bal.ton_luong,
            "production_outputs", out.id, None,
            product_id=out.product_id,
            ghi_chu="Xoa phieu nhap thanh pham")

    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("phieu_nhap_tp", out.id)

    db.delete(out)
    db.commit()
    return {"ok": True}


def _po_out_to_dict(out: ProductionOutput, db: Session) -> dict:
    wh = db.get(Warehouse, out.warehouse_id)
    lsx = db.get(ProductionOrder, out.production_order_id)
    phap_nhan_id = lsx.phap_nhan_id if lsx and lsx.phap_nhan_id else (wh.phan_xuong_obj.phap_nhan_id if wh and wh.phan_xuong_obj else None)
    return {
        "id": out.id,
        "so_phieu": out.so_phieu,
        "ngay_nhap": str(out.ngay_nhap),
        "production_order_id": out.production_order_id,
        "so_lenh": lsx.so_lenh if lsx else "",
        "warehouse_id": out.warehouse_id,
        "ten_kho": wh.ten_kho if wh else "",
        "phap_nhan_id": phap_nhan_id,
        "product_id": out.product_id,
        "ten_hang": out.ten_hang,
        "so_luong_nhap": float(out.so_luong_nhap),
        "so_luong_loi": float(out.so_luong_loi),
        "trang_thai_loi": out.trang_thai_loi,
        "dvt": out.dvt,
        "don_gia_xuat_xuong": float(out.don_gia_xuat_xuong),
        "production_session_id": out.production_session_id,
        "ghi_chu": out.ghi_chu,
        "created_at": out.created_at.isoformat() if out.created_at else None,
        "created_by_name": out.creator.ho_ten if out.creator else None,
    }
