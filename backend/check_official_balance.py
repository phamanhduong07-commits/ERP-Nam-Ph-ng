
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.inventory import InventoryBalance
from app.models.master import Warehouse

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("--- Official Inventory Balance (PHOI) ---")
    balances = db.query(InventoryBalance).join(Warehouse).filter(Warehouse.loai_kho == 'PHOI').all()
    for b in balances:
        wh = db.query(Warehouse).get(b.warehouse_id)
        print(f"WH: {wh.ten_kho}, Item: {b.ten_hang}, Qty: {b.ton_luong}")
finally:
    db.close()
