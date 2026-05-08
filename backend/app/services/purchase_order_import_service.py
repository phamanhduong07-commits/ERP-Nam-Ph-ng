from decimal import Decimal
from io import BytesIO
from typing import Any
import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.models.auth import User
from app.models.master import Supplier, PaperMaterial, OtherMaterial
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.import_log import ImportLog

async def import_purchase_orders_excel(
    db: Session,
    file: UploadFile,
    user: User,
    commit: bool = False
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Chi chap nhan file Excel")

    raw = await file.read()
    df = pd.read_excel(BytesIO(raw), dtype=object)
    if df.empty:
        raise HTTPException(status_code=400, detail="File khong co du lieu")

    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    
    required_cols = ["so_po", "ngay_po", "ma_ncc", "ma_vt", "so_luong", "don_gia"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Thieu cot: {', '.join(missing)}")

    orders_data = {}
    errors = []

    for idx, row in df.iterrows():
        row_num = idx + 2
        so_po = str(row["so_po"]).strip()
        if not so_po or pd.isna(row["so_po"]):
            errors.append(f"Dong {row_num}: Thieu so PO")
            continue

        if so_po not in orders_data:
            ma_ncc = str(row["ma_ncc"]).strip()
            supplier = db.query(Supplier).filter(Supplier.ma_ncc == ma_ncc).first()
            if not supplier:
                errors.append(f"Dong {row_num}: Nha cung cap '{ma_ncc}' khong ton tai")
                continue
            
            orders_data[so_po] = {
                "ngay_po": pd.to_datetime(row["ngay_po"]).date() if not pd.isna(row["ngay_po"]) else None,
                "supplier_id": supplier.id,
                "items": []
            }

        # Tìm vật tư theo ma_vt (ma_chinh cho giay hoac ma_vt cho vat tu khac)
        ma_vt = str(row["ma_vt"]).strip()
        paper = db.query(PaperMaterial).filter(PaperMaterial.ma_chinh == ma_vt).first()
        other = None
        if not paper:
            other = db.query(OtherMaterial).filter(OtherMaterial.ma_vt == ma_vt).first()
        
        if not paper and not other:
            errors.append(f"Dong {row_num}: Vat tu '{ma_vt}' khong ton tai")
            continue

        try:
            orders_data[so_po]["items"].append({
                "paper_material_id": paper.id if paper else None,
                "other_material_id": other.id if other else None,
                "ten_hang": str(row.get("ten_hang", "")) or (paper.ten if paper else other.ten), # type: ignore
                "so_luong": Decimal(str(row["so_luong"])),
                "don_gia": Decimal(str(row["don_gia"])),
                "dvt": str(row.get("dvt", "")) or (paper.dvt if paper else other.dvt), # type: ignore
                "thanh_tien": Decimal(str(row["so_luong"])) * Decimal(str(row["don_gia"])),
                "ghi_chu": str(row.get("ghi_chu", ""))
            })
        except Exception as e:
            errors.append(f"Dong {row_num}: Loi du lieu so luong/don gia - {e}")

    created = 0
    updated = 0
    if commit and not errors:
        for so_po, data in orders_data.items():
            existing = db.query(PurchaseOrder).filter(PurchaseOrder.so_po == so_po).first()
            if existing:
                db.query(PurchaseOrderItem).filter(PurchaseOrderItem.po_id == existing.id).delete()
                order = existing
                updated += 1
            else:
                order = PurchaseOrder(so_po=so_po)
                db.add(order)
                created += 1
            
            order.ngay_po = data["ngay_po"]
            order.supplier_id = data["supplier_id"]
            order.trang_thai = "moi"
            
            tong_tien = 0
            for item_data in data["items"]:
                item = PurchaseOrderItem(**item_data)
                order.items.append(item)
                tong_tien += item_data["thanh_tien"]
            
            order.tong_tien = tong_tien
        
        db.commit()

        # Log
        log = ImportLog(
            user_id=user.id,
            ten_nguoi_import=user.full_name or user.username,
            loai_du_lieu="don_mua_hang",
            ten_file=file.filename,
            so_dong_thanh_cong=created + updated,
            so_dong_loi=0,
            trang_thai='success'
        )
        db.add(log)
        db.commit()

    elif commit and errors:
        log = ImportLog(
            user_id=user.id,
            ten_nguoi_import=user.full_name or user.username,
            loai_du_lieu="don_mua_hang",
            ten_file=file.filename,
            so_dong_thanh_cong=0,
            so_dong_loi=len(errors),
            trang_thai='failed',
            chi_tiet_loi="\n".join(errors[:500])
        )
        db.add(log)
        db.commit()
        raise HTTPException(status_code=400, detail="File co loi")

    return {
        "total_pos": len(orders_data),
        "created": created,
        "updated": updated,
        "errors": errors,
        "commit": commit
    }
