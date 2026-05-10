
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.master import Warehouse, PhanXuong

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    whs = db.query(Warehouse).all()
    print("--- All Warehouses ---")
    for w in whs:
        px = db.query(PhanXuong).get(w.phan_xuong_id) if w.phan_xuong_id else None
        print(f"ID: {w.id}, Name: {w.ten_kho}, Type: {w.loai_kho}, Workshop: {px.ten_xuong if px else 'None'} (ID: {w.phan_xuong_id})")
finally:
    db.close()
