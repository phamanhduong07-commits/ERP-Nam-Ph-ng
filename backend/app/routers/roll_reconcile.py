"""
Roll reconcile router — so sánh tồn kho PaperRoll vật lý vs InventoryBalance sổ sách.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_any_permission
from app.models.auth import User
from app.models.inventory import InventoryBalance, PaperRoll
from app.models.master import Warehouse, PaperMaterial
from app.services.inventory_service import get_or_create_balance, nhap_balance, xuat_balance, log_tx

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


@router.get("/doi-soat-cuon")
def get_doi_soat_cuon(
    show_all: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    roll_agg = (
        db.query(
            PaperRoll.paper_material_id,
            PaperRoll.warehouse_id,
            func.sum(PaperRoll.trong_luong_hien_tai).label("paper_roll_ton"),
            func.count(PaperRoll.id).label("so_cuon"),
        )
        .filter(PaperRoll.trang_thai == "kho")
        .group_by(PaperRoll.paper_material_id, PaperRoll.warehouse_id)
        .all()
    )

    balance_map: dict[tuple[int, int], InventoryBalance] = {}
    if roll_agg:
        pm_ids = {r.paper_material_id for r in roll_agg}
        wh_ids = {r.warehouse_id for r in roll_agg}
        balances = (
            db.query(InventoryBalance)
            .filter(
                InventoryBalance.paper_material_id.in_(pm_ids),
                InventoryBalance.warehouse_id.in_(wh_ids),
            )
            .all()
        )
        for b in balances:
            if b.paper_material_id:
                balance_map[(b.paper_material_id, b.warehouse_id)] = b

    pm_ids_all = {r.paper_material_id for r in roll_agg}
    wh_ids_all = {r.warehouse_id for r in roll_agg}

    pm_map: dict[int, PaperMaterial] = {}
    if pm_ids_all:
        for pm in db.query(PaperMaterial).filter(PaperMaterial.id.in_(pm_ids_all)).all():
            pm_map[pm.id] = pm

    wh_map: dict[int, Warehouse] = {}
    if wh_ids_all:
        for wh in db.query(Warehouse).filter(Warehouse.id.in_(wh_ids_all)).all():
            wh_map[wh.id] = wh

    results = []
    for row in roll_agg:
        pm = pm_map.get(row.paper_material_id)
        wh = wh_map.get(row.warehouse_id)
        balance = balance_map.get((row.paper_material_id, row.warehouse_id))

        paper_roll_ton = Decimal(str(row.paper_roll_ton or 0))
        balance_ton = balance.ton_luong if balance else Decimal("0")
        chenh_lech = paper_roll_ton - balance_ton

        if not show_all and abs(chenh_lech) <= Decimal("0.001"):
            continue

        if balance_ton != 0:
            chenh_lech_phan_tram = float(chenh_lech / balance_ton * 100)
        else:
            chenh_lech_phan_tram = None

        results.append({
            "paper_material_id": row.paper_material_id,
            "warehouse_id": row.warehouse_id,
            "warehouse_name": wh.ten_kho if wh else None,
            "ma_giay": pm.ma_chinh if pm else None,
            "ten": pm.ten if pm else None,
            "kho_mm": float(pm.kho) if pm and pm.kho else None,
            "dinh_luong": float(pm.dinh_luong) if pm and pm.dinh_luong else None,
            "so_cuon": row.so_cuon,
            "paper_roll_ton": float(paper_roll_ton),
            "balance_ton": float(balance_ton),
            "chenh_lech": float(chenh_lech),
            "chenh_lech_phan_tram": chenh_lech_phan_tram,
        })

    results.sort(key=lambda x: abs(x["chenh_lech"]), reverse=True)
    return results


@router.post("/doi-soat-cuon/sync/{paper_material_id}/{warehouse_id}")
def sync_doi_soat_cuon(
    paper_material_id: int,
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("inventory.adjust")),
):
    paper_roll_ton = (
        db.query(func.sum(PaperRoll.trong_luong_hien_tai))
        .filter(
            PaperRoll.trang_thai == "kho",
            PaperRoll.paper_material_id == paper_material_id,
            PaperRoll.warehouse_id == warehouse_id,
        )
        .scalar()
    ) or Decimal("0")
    paper_roll_ton = Decimal(str(paper_roll_ton))

    pm = db.query(PaperMaterial).filter(PaperMaterial.id == paper_material_id).first()
    ten_hang = pm.ten if pm else f"Giấy #{paper_material_id}"

    balance = get_or_create_balance(
        db,
        warehouse_id=warehouse_id,
        paper_material_id=paper_material_id,
        ten_hang=ten_hang,
        don_vi="Kg",
        lock=True,
    )

    old_ton = balance.ton_luong
    chenh_lech = paper_roll_ton - old_ton

    if abs(chenh_lech) > Decimal("0.001"):
        don_gia = balance.don_gia_binh_quan or Decimal("0")
        if chenh_lech > 0:
            nhap_balance(balance, chenh_lech, don_gia)
            log_tx(
                db,
                warehouse_id=warehouse_id,
                loai="dieu_chinh_tang",
                so_luong=chenh_lech,
                don_gia=don_gia,
                ton_sau=balance.ton_luong,
                chung_tu_loai="roll_reconcile",
                chung_tu_id=paper_material_id,
                created_by=current_user.id,
                paper_material_id=paper_material_id,
                ghi_chu="Đồng bộ kiểm kê cuộn giấy",
            )
        else:
            abs_chenh = abs(chenh_lech)
            xuat_balance(balance, abs_chenh, ten_hang)
            log_tx(
                db,
                warehouse_id=warehouse_id,
                loai="dieu_chinh_giam",
                so_luong=abs_chenh,
                don_gia=don_gia,
                ton_sau=balance.ton_luong,
                chung_tu_loai="roll_reconcile",
                chung_tu_id=paper_material_id,
                created_by=current_user.id,
                paper_material_id=paper_material_id,
                ghi_chu="Đồng bộ kiểm kê cuộn giấy",
            )

    db.commit()
    db.refresh(balance)

    return {
        "paper_material_id": paper_material_id,
        "warehouse_id": warehouse_id,
        "old_ton": float(old_ton),
        "new_ton": float(balance.ton_luong),
        "chenh_lech": float(chenh_lech),
    }
