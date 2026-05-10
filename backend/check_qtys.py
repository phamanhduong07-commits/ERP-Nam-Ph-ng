
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
    items = db.query(PhieuNhapPhoiSongItem).all()
    for it in items:
        p = db.query(PhieuNhapPhoiSong).get(it.phieu_id)
        print(f"LSX: {p.production_order_id}, WH: {p.warehouse_id}, Qty: {it.so_tam}")
finally:
    db.close()
