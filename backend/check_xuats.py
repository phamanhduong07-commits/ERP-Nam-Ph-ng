
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.phieu_xuat_phoi import PhieuXuatPhoiItem

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    xuats = db.query(PhieuXuatPhoiItem).all()
    for x in xuats:
        print(f"LSX Item ID: {x.production_order_item_id}, Qty: {x.so_luong}")
finally:
    db.close()
