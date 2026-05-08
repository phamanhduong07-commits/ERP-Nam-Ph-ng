from decimal import Decimal
from io import BytesIO
from typing import Any
import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.models.auth import User
from app.models.master import Product, PaperMaterial, OtherMaterial, Warehouse
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.import_log import ImportLog
from app.services.excel_import_service import parse_decimal

async def import_inventory_excel(
    db: Session,
    file: UploadFile,
    user: User,
    warehouse_id: int,
    commit: bool = False
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Chi chap nhan file Excel")

    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=400, detail="Kho khong ton tai")

    raw = await file.read()
    df = pd.read_excel(BytesIO(raw), dtype=object)
    if df.empty:
        raise HTTPException(status_code=400, detail="File khong co du lieu")

    # Chuan hoa ten cot
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    
    required_cols = ["ma_hang", "ton_luong"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Thieu cot: {', '.join(missing)}")

    results = []
    errors = []
    
    # Cache mapping de tang toc
    products = {p.ma_amis: p.id for p in db.query(Product.id, Product.ma_amis).all()}
    papers = {p.ma_chinh: p.id for p in db.query(PaperMaterial.id, PaperMaterial.ma_chinh).all()}
    others = {o.ma_vt: o.id for o in db.query(OtherMaterial.id, OtherMaterial.ma_vt).all()}

    items_to_process = []

    for idx, row in df.iterrows():
        row_num = idx + 2
        ma_hang = str(row["ma_hang"]).strip()
        if not ma_hang or pd.isna(row["ma_hang"]):
            errors.append(f"Dong {row_num}: Thieu ma hang")
            continue

        ton_luong = parse_decimal(row["ton_luong"])
        don_gia = parse_decimal(row.get("don_gia", 0))

        # Tim loai hang hoa
        pid = products.get(ma_hang)
        paper_id = papers.get(ma_hang)
        other_id = others.get(ma_hang)

        if not any([pid, paper_id, other_id]):
            errors.append(f"Dong {row_num}: Ma '{ma_hang}' khong ton tai trong bat ky danh muc nao (SP/Giay/VT)")
            continue

        items_to_process.append({
            "product_id": pid,
            "paper_material_id": paper_id,
            "other_material_id": other_id,
            "ton_luong": ton_luong,
            "don_gia": don_gia,
            "ma_hang": ma_hang
        })

    created = 0
    updated = 0

    if commit and not errors:
        for item in items_to_process:
            # Check existing balance
            query = db.query(InventoryBalance).filter(InventoryBalance.warehouse_id == warehouse_id)
            if item["product_id"]:
                query = query.filter(InventoryBalance.product_id == item["product_id"])
            elif item["paper_material_id"]:
                query = query.filter(InventoryBalance.paper_material_id == item["paper_material_id"])
            else:
                query = query.filter(InventoryBalance.other_material_id == item["other_material_id"])
            
            balance = query.first()
            if not balance:
                balance = InventoryBalance(
                    warehouse_id=warehouse_id,
                    product_id=item["product_id"],
                    paper_material_id=item["paper_material_id"],
                    other_material_id=item["other_material_id"],
                    ton_luong=item["ton_luong"],
                    gia_tri_ton=item["ton_luong"] * item["don_gia"],
                    don_gia_binh_quan=item["don_gia"]
                )
                db.add(balance)
                created += 1
            else:
                # Ghi de so du dau ky
                balance.ton_luong = item["ton_luong"]
                balance.gia_tri_ton = item["ton_luong"] * item["don_gia"]
                balance.don_gia_binh_quan = item["don_gia"]
                updated += 1
            
            # Tao transaction de ghi vet
            tx = InventoryTransaction(
                warehouse_id=warehouse_id,
                product_id=item["product_id"],
                paper_material_id=item["paper_material_id"],
                other_material_id=item["other_material_id"],
                loai_giao_dich="ton_kho_dau_ky",
                so_luong=item["ton_luong"],
                don_gia=item["don_gia"],
                gia_tri=item["ton_luong"] * item["don_gia"],
                ton_sau_giao_dich=item["ton_luong"],
                ghi_chu="Import ton kho dau ky tu file Excel",
                created_by=user.id
            )
            db.add(tx)

        db.commit()

        # Luu log
        log = ImportLog(
            user_id=user.id,
            ten_nguoi_import=user.full_name or user.username,
            loai_du_lieu="ton_kho_dau_ky",
            ten_file=file.filename,
            so_dong_thanh_cong=len(items_to_process),
            so_dong_loi=0,
            trang_thai='success'
        )
        db.add(log)
        db.commit()

    elif commit and errors:
        log = ImportLog(
            user_id=user.id,
            ten_nguoi_import=user.full_name or user.username,
            loai_du_lieu="ton_kho_dau_ky",
            ten_file=file.filename,
            so_dong_thanh_cong=0,
            so_dong_loi=len(errors),
            trang_thai='failed',
            chi_tiet_loi="\n".join(errors[:500])
        )
        db.add(log)
        db.commit()
        raise HTTPException(status_code=400, detail="File co loi, khong the commit")

    return {
        "total": len(items_to_process),
        "created": created,
        "updated": updated,
        "errors": errors,
        "commit": commit
    }
