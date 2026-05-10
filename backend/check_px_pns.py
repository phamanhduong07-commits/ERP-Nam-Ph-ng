
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.master import PhanXuong, PhapNhan

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    pxs = db.query(PhanXuong).all()
    for px in pxs:
        pn = db.query(PhapNhan).get(px.phap_nhan_id)
        print(f"PX: {px.ten_xuong}, PN: {pn.ten_viet_tat if pn else 'N/A'}")
finally:
    db.close()
