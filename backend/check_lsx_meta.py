
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.production import ProductionOrder
from app.models.master import PhanXuong, PhapNhan

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    orders = db.query(ProductionOrder).filter(ProductionOrder.id.in_([18, 19, 20, 21])).all()
    print(f"{'LSX':<15} | {'PX_ID':<5} | {'PN_ID':<5} | {'PX Name':<20} | {'PN Name'}")
    print("-" * 70)
    for o in orders:
        px = db.query(PhanXuong).get(o.phan_xuong_id)
        pn = db.query(PhapNhan).get(o.phap_nhan_id)
        print(f"{o.so_lenh:<15} | {o.phan_xuong_id:<5} | {o.phap_nhan_id:<5} | {px.ten_xuong if px else 'N/A':<20} | {pn.ten_viet_tat if pn else 'N/A'}")
finally:
    db.close()
