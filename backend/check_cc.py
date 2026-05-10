
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
    print("--- Data for Cu Chi (WH 21) ---")
    nhaps = db.query(PhieuNhapPhoiSongItem).join(PhieuNhapPhoiSong).filter(PhieuNhapPhoiSong.warehouse_id == 21).all()
    print(f"Nhập SX: {len(nhaps)} items")
    
    chuyens = db.query(PhieuChuyenKhoItem).join(PhieuChuyenKho).filter(PhieuChuyenKho.warehouse_nhap_id == 21).all()
    print(f"Chuyển đến: {len(chuyens)} items")
    for c in chuyens:
        print(f"  LSX: {c.production_order_id}, Qty: {c.so_luong}")

finally:
    db.close()
