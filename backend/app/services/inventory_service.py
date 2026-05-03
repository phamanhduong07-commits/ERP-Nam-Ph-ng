"""
Shared inventory helpers — dùng chung cho warehouse.py, production_orders.py,
phieu_phoi.py, cd2.py. Tránh circular imports giữa các routers.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.master import Warehouse, PhanXuong, PhapNhan


# ── Balance helpers ───────────────────────────────────────────────────────────

def get_or_create_balance(
    db: Session,
    warehouse_id: int,
    paper_material_id: Optional[int] = None,
    other_material_id: Optional[int] = None,
    product_id: Optional[int] = None,
    ten_hang: str = "",
    don_vi: str = "Kg",
) -> InventoryBalance:
    q = db.query(InventoryBalance).filter(InventoryBalance.warehouse_id == warehouse_id)

    if paper_material_id:
        q = q.filter(InventoryBalance.paper_material_id == paper_material_id)
        balance = q.first()
    elif other_material_id:
        q = q.filter(InventoryBalance.other_material_id == other_material_id)
        balance = q.first()
    elif product_id:
        q = q.filter(InventoryBalance.product_id == product_id)
        balance = q.first()
    else:
        q = q.filter(
            InventoryBalance.paper_material_id.is_(None),
            InventoryBalance.other_material_id.is_(None),
            InventoryBalance.product_id.is_(None),
            InventoryBalance.ten_hang == ten_hang,
        )
        balance = q.first()

    if not balance:
        balance = InventoryBalance(
            warehouse_id=warehouse_id,
            paper_material_id=paper_material_id,
            other_material_id=other_material_id,
            product_id=product_id,
            ten_hang=ten_hang or None,
            don_vi=don_vi,
            ton_luong=Decimal("0"),
            gia_tri_ton=Decimal("0"),
            don_gia_binh_quan=Decimal("0"),
        )
        db.add(balance)
        db.flush()
    else:
        if ten_hang and not balance.ten_hang:
            balance.ten_hang = ten_hang
        if don_vi and not balance.don_vi:
            balance.don_vi = don_vi

    return balance


def nhap_balance(balance: InventoryBalance, so_luong: Decimal, don_gia: Decimal) -> None:
    thanh_tien = so_luong * don_gia
    gia_tri_cu = balance.ton_luong * balance.don_gia_binh_quan
    balance.ton_luong += so_luong
    if balance.ton_luong > 0:
        balance.don_gia_binh_quan = (gia_tri_cu + thanh_tien) / balance.ton_luong
    balance.gia_tri_ton = balance.ton_luong * balance.don_gia_binh_quan
    balance.cap_nhat_luc = datetime.utcnow()


def xuat_balance(balance: InventoryBalance, so_luong: Decimal, ten_hang: str) -> None:
    if balance.ton_luong < so_luong:
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ tồn kho: {ten_hang} — cần {float(so_luong):g}, còn {float(balance.ton_luong):g}"
        )
    balance.ton_luong -= so_luong
    balance.gia_tri_ton = balance.ton_luong * balance.don_gia_binh_quan
    balance.cap_nhat_luc = datetime.utcnow()


def log_tx(
    db: Session,
    warehouse_id: int,
    loai: str,
    so_luong: Decimal,
    don_gia: Decimal,
    ton_sau: Decimal,
    chung_tu_loai: str,
    chung_tu_id: int,
    created_by: Optional[int],
    paper_material_id: Optional[int] = None,
    other_material_id: Optional[int] = None,
    product_id: Optional[int] = None,
    ghi_chu: Optional[str] = None,
) -> None:
    db.add(InventoryTransaction(
        warehouse_id=warehouse_id,
        paper_material_id=paper_material_id,
        other_material_id=other_material_id,
        product_id=product_id,
        loai_giao_dich=loai,
        so_luong=so_luong,
        don_gia=don_gia,
        gia_tri=so_luong * don_gia,
        ton_sau_giao_dich=ton_sau,
        chung_tu_loai=chung_tu_loai,
        chung_tu_id=chung_tu_id,
        ghi_chu=ghi_chu,
        created_by=created_by,
    ))


# ── Workshop warehouse resolver ───────────────────────────────────────────────

def get_workshop_warehouse(
    db: Session,
    phan_xuong_id: int,
    loai_kho: str,
    raise_if_missing: bool = False,
) -> Optional[Warehouse]:
    """
    Trả về kho đang hoạt động của xưởng theo loại.
    Nếu raise_if_missing=True và không tìm thấy → raise HTTPException 400.
    """
    wh = db.query(Warehouse).filter(
        Warehouse.phan_xuong_id == phan_xuong_id,
        Warehouse.loai_kho == loai_kho,
        Warehouse.trang_thai == True,
    ).first()
    if wh is None and raise_if_missing:
        raise HTTPException(
            status_code=400,
            detail=f"Xưởng chưa có kho loại '{loai_kho}'. Vui lòng khởi tạo kho cho xưởng trước.",
        )
    return wh


def get_phoi_source_warehouse(
    db: Session,
    phan_xuong_id: Optional[int],
    phap_nhan_id: Optional[int] = None,
) -> Optional[Warehouse]:
    """
    Trả về kho PHOI nguồn để nhập phôi sóng.

    Ưu tiên: phap_nhan_id → PhapNhan.phoi_phan_xuong_id → kho PHOI của xưởng đó.
    Fallback: phan_xuong_id → kho PHOI của chính xưởng đó (nếu cd1_cd2)
              hoặc kho PHOI của xưởng cd1_cd2 đầu tiên tìm được.
    """
    # 1. Dùng cấu hình pháp nhân (ưu tiên nhất)
    if phap_nhan_id:
        pn = db.get(PhapNhan, phap_nhan_id)
        if pn and pn.phoi_phan_xuong_id:
            wh = get_workshop_warehouse(db, pn.phoi_phan_xuong_id, "PHOI")
            if wh:
                return wh

    # 2. Fallback: dùng phan_xuong_id
    if phan_xuong_id:
        px = db.get(PhanXuong, phan_xuong_id)
        if px:
            # CD1+CD2: dùng kho của chính xưởng
            if px.cong_doan == "cd1_cd2":
                return get_workshop_warehouse(db, phan_xuong_id, "PHOI")
            # CD2: dùng phoi_tu_phan_xuong_id nếu đã cấu hình
            if px.phoi_tu_phan_xuong_id:
                wh = get_workshop_warehouse(db, px.phoi_tu_phan_xuong_id, "PHOI")
                if wh:
                    return wh

    return None
