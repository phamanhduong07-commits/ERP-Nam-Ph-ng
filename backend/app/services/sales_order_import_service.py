from decimal import Decimal
from io import BytesIO
from typing import Any
import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.models.auth import User
from app.models.master import Customer, Product
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.import_log import ImportLog
from app.services.excel_import_service import parse_decimal, parse_date


async def import_sales_orders_excel(
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

    # Chuan hoa ten cot
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    
    required_cols = ["so_don", "ngay_don", "ma_kh", "ma_amis", "so_luong", "don_gia"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Thieu cot: {', '.join(missing)}")

    results = []
    orders_data = {} # {so_don: {header_info, items: []}}
    errors = []

    # 1. Thu thap du lieu
    for idx, row in df.iterrows():
        row_num = idx + 2
        so_don = str(row["so_don"]).strip()
        if not so_don or pd.isna(row["so_don"]):
            errors.append(f"Dong {row_num}: Thieu so don hang")
            continue

        if so_don not in orders_data:
            # Check khach hang
            ma_kh = str(row["ma_kh"]).strip()
            customer = db.query(Customer).filter(Customer.ma_kh == ma_kh).first()
            if not customer:
                errors.append(f"Dong {row_num}: Khach hang '{ma_kh}' khong ton tai")
                continue
            
            orders_data[so_don] = {
                "ngay_don": parse_date(row.get("ngay_don")),
                "customer_id": customer.id,
                "ten_khach": customer.ten_viet_tat,
                "dia_chi_giao": str(row.get("dia_chi_giao", "")) if not pd.isna(row.get("dia_chi_giao")) else customer.dia_chi_giao_hang,
                "items": []
            }

        # Check san pham
        ma_amis = str(row["ma_amis"]).strip()
        product = db.query(Product).filter(Product.ma_amis == ma_amis).first()
        if not product:
            errors.append(f"Dong {row_num}: San pham '{ma_amis}' khong ton tai")
            continue

        try:
            orders_data[so_don]["items"].append({
                "product_id": product.id,
                "ten_hang": str(row.get("ten_hang", "")) if not pd.isna(row.get("ten_hang")) else product.ten_hang,
                "so_luong": parse_decimal(row["so_luong"]),
                "don_gia": parse_decimal(row["don_gia"]),
                "dvt": str(row.get("dvt", "")) if not pd.isna(row.get("dvt")) else product.dvt,
                "ngay_giao": parse_date(row.get("ngay_giao")),
            })
        except Exception as e:
            errors.append(f"Dong {row_num}: Loi du lieu so luong/don gia - {e}")

    # 2. Thuc thi
    created = 0
    updated = 0
    if commit and not errors:
        for so_don, data in orders_data.items():
            existing = db.query(SalesOrder).filter(SalesOrder.so_don == so_don).first()
            if existing:
                # Neu ton tai, xoa items cu va ghi lai (hoac skip tuy logic, o day la update)
                db.query(SalesOrderItem).filter(SalesOrderItem.sales_order_id == existing.id).delete()
                order = existing
                updated += 1
            else:
                order = SalesOrder(so_don=so_don)
                db.add(order)
                created += 1
            
            order.ngay_don = data["ngay_don"]
            order.customer_id = data["customer_id"]
            order.dia_chi_giao = data["dia_chi_giao"]
            order.trang_thai = "moi"
            order.created_by = user.id
            
            tong_tien = 0
            for item_data in data["items"]:
                item = SalesOrderItem(**item_data)
                order.items.append(item)
                tong_tien += (item_data["so_luong"] * item_data["don_gia"])
            
            order.tong_tien = tong_tien
            order.tong_tien_sau_giam = tong_tien
        
        db.commit()

        # Luu log
        log = ImportLog(
            user_id=user.id,
            ten_nguoi_import=user.full_name or user.username,
            loai_du_lieu="don_hang",
            ten_file=file.filename,
            so_dong_thanh_cong=created + updated,
            so_dong_loi=0,
            trang_thai='success'
        )
        db.add(log)
        db.commit()

    elif commit and errors:
        # Luu log failed
        log = ImportLog(
            user_id=user.id,
            ten_nguoi_import=user.full_name or user.username,
            loai_du_lieu="don_hang",
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
        "total_orders": len(orders_data),
        "created": created,
        "updated": updated,
        "errors": errors,
        "commit": commit
    }
