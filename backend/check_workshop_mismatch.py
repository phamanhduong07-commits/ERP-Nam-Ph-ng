
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.production import ProductionOrder
from app.models.sales import SalesOrder
from app.models.master import PhanXuong

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    orders = db.query(ProductionOrder).filter(ProductionOrder.id.in_([18, 19, 20, 21])).all()
    for o in orders:
        so = db.query(SalesOrder).get(o.sales_order_id)
        px_order = db.query(PhanXuong).get(o.phan_xuong_id)
        px_so = db.query(PhanXuong).get(so.phan_xuong_id) if so else None
        print(f"LSX: {o.so_lenh}, Order PX: {px_order.ten_xuong if px_order else 'N/A'}, Sales PX: {px_so.ten_xuong if px_so else 'N/A'}")
finally:
    db.close()
