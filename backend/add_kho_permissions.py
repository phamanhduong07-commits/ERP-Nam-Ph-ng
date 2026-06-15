"""Them inventory permissions cho role KE_TOAN_TRUONG."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from sqlalchemy import create_engine, text
from app.config import settings

KHO_PERMISSIONS = [
    "inventory.view",
    "inventory.import",
    "inventory.export",
    "inventory.transfer",
    "inventory.adjust",
    "inventory.phoi_tp",
]

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    # Check existing
    existing = conn.execute(text("SELECT ma_quyen FROM permissions WHERE ma_quyen LIKE 'inventory.%'")).fetchall()
    print("Inventory perms in DB:", [r[0] for r in existing])

    role = conn.execute(text("SELECT id FROM roles WHERE ma_vai_tro = 'KE_TOAN_TRUONG'")).fetchone()
    role_id = role[0]

    added = 0
    for ma in KHO_PERMISSIONS:
        perm = conn.execute(text("SELECT id FROM permissions WHERE ma_quyen = :m"), {"m": ma}).fetchone()
        if not perm:
            print(f"  WARN: '{ma}' chua co trong DB")
            continue
        conn.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id, created_at)
            VALUES (:rid, :pid, now()) ON CONFLICT DO NOTHING
        """), {"rid": role_id, "pid": perm[0]})
        added += 1

    conn.commit()
    print(f"Them {added} inventory permissions cho KE_TOAN_TRUONG.")
