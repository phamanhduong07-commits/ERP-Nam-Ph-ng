"""Them production permissions cho KE_TOAN_TRUONG de hien thi BOM va Phan tich chi phi."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from sqlalchemy import create_engine, text
from app.config import settings

PERMS = [
    "production_order.view",   # hien Dinh muc BOM (some check: chi can view)
    "production.cost_analysis", # hien Phan tich chi phi
]

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    role = conn.execute(text("SELECT id FROM roles WHERE ma_vai_tro = 'KE_TOAN_TRUONG'")).fetchone()
    role_id = role[0]

    for ma in PERMS:
        perm = conn.execute(text("SELECT id FROM permissions WHERE ma_quyen = :m"), {"m": ma}).fetchone()
        if not perm:
            # Permission chua ton tai, tao moi
            conn.execute(text("""
                INSERT INTO permissions (ma_quyen, ten_quyen, nhom, trang_thai, created_at)
                VALUES (:ma, :ten, 'San Xuat', true, now())
                ON CONFLICT (ma_quyen) DO NOTHING
            """), {"ma": ma, "ten": ma})
            perm = conn.execute(text("SELECT id FROM permissions WHERE ma_quyen = :m"), {"m": ma}).fetchone()
            print(f"  Tao moi permission: {ma}")

        conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id, created_at)
            VALUES (:rid, :pid, now()) ON CONFLICT DO NOTHING
        """), {"rid": role_id, "pid": perm[0]})
        print(f"  Assigned: {ma}")

    conn.commit()
    print("Done.")
