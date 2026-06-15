"""
Fix permissions san xuat cho KE_TOAN_TRUONG:
- Tao permission production.bom
- Assign production.bom + production.cost_analysis (da co)
- Revoke production_order.view (qua rong)
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from sqlalchemy import create_engine, text
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    role = conn.execute(text("SELECT id FROM roles WHERE ma_vai_tro = 'KE_TOAN_TRUONG'")).fetchone()
    role_id = role[0]

    # 1. Tao permission production.bom neu chua co
    conn.execute(text("""
        INSERT INTO permissions (ma_quyen, ten_quyen, nhom, trang_thai, created_at)
        VALUES ('production.bom', 'Xem Dinh muc (BOM)', 'San Xuat', true, now())
        ON CONFLICT (ma_quyen) DO NOTHING
    """))
    bom_perm = conn.execute(text("SELECT id FROM permissions WHERE ma_quyen = 'production.bom'")).fetchone()
    print(f"permission production.bom id={bom_perm[0]}")

    # 2. Assign production.bom cho KE_TOAN_TRUONG
    conn.execute(text("""
        INSERT INTO role_permissions (role_id, permission_id, created_at)
        VALUES (:rid, :pid, now()) ON CONFLICT DO NOTHING
    """), {"rid": role_id, "pid": bom_perm[0]})
    print("Assigned production.bom")

    # 3. Revoke production_order.view khoi KE_TOAN_TRUONG
    view_perm = conn.execute(text("SELECT id FROM permissions WHERE ma_quyen = 'production_order.view'")).fetchone()
    if view_perm:
        conn.execute(text("""
            DELETE FROM role_permissions WHERE role_id = :rid AND permission_id = :pid
        """), {"rid": role_id, "pid": view_perm[0]})
        print("Revoked production_order.view")

    conn.commit()

    # Verify
    perms = conn.execute(text("""
        SELECT p.ma_quyen FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = :rid AND p.ma_quyen LIKE 'production%'
        ORDER BY p.ma_quyen
    """), {"rid": role_id}).fetchall()
    print("Production perms KE_TOAN_TRUONG:", [r[0] for r in perms])
