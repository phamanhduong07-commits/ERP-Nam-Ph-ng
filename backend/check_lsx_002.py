
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSongItem, PhieuNhapPhoiSong

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("--- Transactions for LSX 002 (ID 19) ---")
    nhaps = db.query(PhieuNhapPhoiSongItem).join(PhieuNhapPhoiSong).filter(PhieuNhapPhoiSong.production_order_id == 19).all()
    for n in nhaps:
        print(f"Nhap ID: {n.id}, Qty: {n.so_tam}, Warehouse: {n.phieu.warehouse_id}")
finally:
    db.close()
