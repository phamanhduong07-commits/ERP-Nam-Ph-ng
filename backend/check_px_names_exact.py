
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.master import PhanXuong

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    pxs = db.query(PhanXuong).all()
    for px in pxs:
        print(f"ID: {px.id}, Name: '{px.ten_xuong}'")
finally:
    db.close()
