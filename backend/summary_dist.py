
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
    counts = {}
    for r in res:
        px_id = r['phan_xuong_id']
        counts[px_id] = counts.get(px_id, 0) + 1
    
    print("--- Distribution by Phan Xuong ID ---")
    for px_id, count in counts.items():
        print(f"PX_ID {px_id}: {count} items")
        
    print("\n--- Detailed Rows ---")
    for r in res:
        print(f"LSX: {r['so_lenh']}, PX: {r['phan_xuong_id']}, Ton: {r['ton_kho']}, WH: {r['ten_kho']}")
finally:
    db.close()
