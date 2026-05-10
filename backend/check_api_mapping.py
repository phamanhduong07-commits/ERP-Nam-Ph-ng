
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.routers.phieu_phoi import ton_kho_lsx

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    res = ton_kho_lsx(db)
    for r in res:
        print(f"LSX: {r['so_lenh']}, Warehouse: {r['ten_kho']}, Workshop: {r['ten_phan_xuong']}")
finally:
    db.close()
