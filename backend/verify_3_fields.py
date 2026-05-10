
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
    print(f"{'LSX':<15} | {'Pháp nhân':<15} | {'Nơi SX':<20} | {'Kho hiện tại':<25} | {'Tồn'}")
    print("-" * 85)
    for r in res:
        print(f"{r['so_lenh']:<15} | {str(r['ten_phap_nhan_sx']):<15} | {str(r['order_ten_phan_xuong']):<20} | {str(r['ten_phan_xuong']):<25} | {r['ton_kho']}")
finally:
    db.close()
