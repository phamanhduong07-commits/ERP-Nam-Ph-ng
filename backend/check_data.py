
import sys
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.master import PhanXuong, Warehouse

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()
try:
    pxs = db.query(PhanXuong).all()
    print("--- Workshops ---")
    for p in pxs:
        print(f"ID: {p.id}, Name: {p.ten_xuong}, Cong Doan: {p.cong_doan}")
        
    whs = db.query(Warehouse).filter(Warehouse.loai_kho == 'PHOI').all()
    print("\n--- PHOI Warehouses ---")
    for w in whs:
        print(f"ID: {w.id}, Name: {w.ten_kho}, Workshop: {w.phan_xuong_id}")
finally:
    db.close()
