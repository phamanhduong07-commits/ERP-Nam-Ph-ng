
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.master import Warehouse

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("--- PhieuNhapPhoiSong Records ---")
    recs = db.query(PhieuNhapPhoiSong).all()
    for r in recs:
        wh = db.query(Warehouse).get(r.warehouse_id)
        print(f"ID: {r.id}, So Phieu: {r.so_phieu}, Warehouse: {wh.ten_kho if wh else 'Unknown'} (ID: {r.warehouse_id})")
finally:
    db.close()
