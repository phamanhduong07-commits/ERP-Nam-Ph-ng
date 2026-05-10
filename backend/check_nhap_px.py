
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong
from app.models.master import Warehouse

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    recs = db.query(PhieuNhapPhoiSong).all()
    print("--- PhieuNhapPhoiSong -> Workshop ---")
    for r in recs:
        wh = db.query(Warehouse).get(r.warehouse_id)
        print(f"ID: {r.id}, So Phieu: {r.so_phieu}, WH: {wh.ten_kho if wh else 'N/A'}, PX_ID: {wh.phan_xuong_id if wh else 'N/A'}")
finally:
    db.close()
