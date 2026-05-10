import psycopg2, sys
sys.stdout.reconfigure(encoding='utf-8')

conn = psycopg2.connect("postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong")
cur = conn.cursor()

# Xem các ma_nsx_id trong paper_materials và tên supplier tương ứng
cur.execute("""
    SELECT pm.ma_nsx_id, s.ten_viet_tat, COUNT(*) as cnt
    FROM paper_materials pm
    LEFT JOIN suppliers s ON s.id = pm.ma_nsx_id
    GROUP BY pm.ma_nsx_id, s.ten_viet_tat
    ORDER BY cnt DESC
""")
print("paper_materials ma_nsx_id -> supplier:")
for r in cur.fetchall():
    print(f"  [{r[0]}] {r[1]} — {r[2]} records")

print()
# Xem các ma_ncc_id trong other_materials
cur.execute("""
    SELECT om.ma_ncc_id, s.ten_viet_tat, COUNT(*) as cnt
    FROM other_materials om
    LEFT JOIN suppliers s ON s.id = om.ma_ncc_id
    WHERE om.ma_ncc_id IS NOT NULL
    GROUP BY om.ma_ncc_id, s.ten_viet_tat
    ORDER BY cnt DESC
    LIMIT 10
""")
print("other_materials ma_ncc_id -> supplier (top 10):")
for r in cur.fetchall():
    print(f"  [{r[0]}] {r[1]} — {r[2]} records")

conn.close()
