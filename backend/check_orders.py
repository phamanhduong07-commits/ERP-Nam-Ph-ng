
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.production import ProductionOrder

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    orders = db.query(ProductionOrder).all()
    print("--- All Production Orders ---")
    for o in orders:
        print(f"ID: {o.id}, So Lenh: {o.so_lenh}, Workshop: {o.phan_xuong_id}")
finally:
    db.close()
