
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem
from app.models.master import Warehouse

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("--- PhieuChuyenKho Records ---")
    recs = db.query(PhieuChuyenKho).all()
    for r in recs:
        wh_src = db.query(Warehouse).get(r.warehouse_xuat_id)
        wh_dst = db.query(Warehouse).get(r.warehouse_nhap_id)
        print(f"ID: {r.id}, So Phieu: {r.so_phieu}, From: {wh_src.ten_kho if wh_src else 'N/A'}, To: {wh_dst.ten_kho if wh_dst else 'N/A'}")
        
        items = db.query(PhieuChuyenKhoItem).filter(PhieuChuyenKhoItem.phieu_chuyen_kho_id == r.id).all()
        for it in items:
            print(f"  Item LSX: {it.production_order_id}, Qty: {it.so_luong}")
finally:
    db.close()
