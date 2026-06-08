import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pyodbc

SS_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=20;"
)
conn = pyodbc.connect(SS_CONN)
cur = conn.cursor()

# Tất cả bảng DM + bảng nghiệp vụ chính
cur.execute("""
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE='BASE TABLE'
  AND (TABLE_NAME LIKE 'DM%' OR TABLE_NAME LIKE 'dm%')
ORDER BY TABLE_NAME
""")
tables = [r[0] for r in cur.fetchall()]

# Thêm một số bảng giao dịch quan trọng
extra = ['DTBaoGia', 'MTBaoGia', 'MTDonHang', 'MTLSX', 'doanhso2020']
all_tables = tables + [t for t in extra if t not in tables]

print(f"{'Bang':<35} {'Rows':>8}  Cot mau")
print('-' * 80)
for tbl in all_tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM [{tbl}]")
        cnt = cur.fetchone()[0]
        cur.execute(f"SELECT TOP 0 * FROM [{tbl}]")
        cols = [d[0] for d in cur.description][:7]
        print(f"{tbl:<35} {cnt:>8,}  {cols}")
    except Exception as e:
        print(f"{tbl:<35}  ERROR")

conn.close()
