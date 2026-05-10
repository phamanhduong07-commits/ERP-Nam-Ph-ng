
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.master import Warehouse

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    whs = db.query(Warehouse).all()
    for w in whs:
        print(f"ID: {w.id}, Name: {w.ten_kho}, PX_ID: {w.phan_xuong_id}")
finally:
    db.close()
