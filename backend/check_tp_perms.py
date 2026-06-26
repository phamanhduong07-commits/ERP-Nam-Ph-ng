import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
os.chdir(os.path.dirname(__file__))
from dotenv import load_dotenv; load_dotenv()
from database import engine
from sqlalchemy import text

with engine.connect() as c:
    rows = c.execute(text("""
        SELECT p.ma_quyen FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.ma_vai_tro = 'TRUONG_PHONG_SALE_ADMIN'
        ORDER BY p.ma_quyen
    """)).fetchall()
    for r in rows:
        print(r[0])
