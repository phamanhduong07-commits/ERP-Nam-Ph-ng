
import sys
import os
import io
import json
from decimal import Decimal
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.routers.phieu_phoi import ton_kho_lsx

def default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    res = ton_kho_lsx(db)
    print(json.dumps(res, indent=2, ensure_ascii=False, default=default))
finally:
    db.close()
