
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem, Warehouse

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("--- PhieuNhapPhoiSong for HG (WH 11) ---")
    nhaps = db.query(PhieuNhapPhoiSong).filter(PhieuNhapPhoiSong.warehouse_id == 11).all()
    for n in nhaps:
        print(f"ID: {n.id}, So Phieu: {n.so_phieu}, Order: {n.production_order_id}")
        
    print("\n--- PhieuChuyenKho (Inbound to HG WH 11) ---")
    chuyens = db.query(PhieuChuyenKho).filter(PhieuChuyenKho.warehouse_nhap_id == 11).all()
    for c in chuyens:
        print(f"ID: {c.id}, So Phieu: {c.so_phieu}")

    print("\n--- PhieuChuyenKho (Outbound from HG WH 11) ---")
    chuyens_out = db.query(PhieuChuyenKho).filter(PhieuChuyenKho.warehouse_xuat_id == 11).all()
    for c in chuyens_out:
        print(f"ID: {c.id}, So Phieu: {c.so_phieu}")

finally:
    db.close()
