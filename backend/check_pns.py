
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.phap_nhan import PhapNhan

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    pns = db.query(PhapNhan).all()
    for p in pns:
        print(f"ID: {p.id}, Ma: {p.ma_phap_nhan}, Ten: {p.ten_phap_nhan}, Viet tat: {p.ten_viet_tat}")
finally:
    db.close()
