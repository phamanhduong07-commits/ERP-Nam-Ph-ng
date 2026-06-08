"""
Import địa chỉ giao hàng từ SQL Server HTCPH → ERP PostgreSQL

Nguồn:
  DMKH.DiaChi      → customers.dia_chi
  DMKH.GiaoHang   → customers.dia_chi_giao_hang

Điều kiện:
  - Chỉ update khi cột ERP đang NULL (không ghi đè data đã có)
  - Khớp theo ma_kh (case-insensitive trim)
  - Chạy lại an toàn (idempotent)
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "backend"))

from dotenv import load_dotenv
load_dotenv(".env")

import pyodbc
from sqlalchemy import create_engine, text
from app.config import settings

SS_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=20;"
)


def fetch_htcph() -> list[dict]:
    conn = pyodbc.connect(SS_CONN)
    cur = conn.cursor()
    cur.execute("""
        SELECT MaKH, DiaChi, GiaoHang
        FROM DMKH
        WHERE (DiaChi IS NOT NULL AND DiaChi != '')
           OR (GiaoHang IS NOT NULL AND GiaoHang != '')
    """)
    rows = []
    for r in cur.fetchall():
        rows.append({
            "ma_kh": (r[0] or "").strip(),
            "dia_chi": (r[1] or "").strip() or None,
            "giao_hang": (r[2] or "").strip() or None,
        })
    conn.close()
    return rows


def run():
    engine = create_engine(settings.DATABASE_URL)
    rows = fetch_htcph()
    print(f"HTCPH: {len(rows)} khách có địa chỉ")

    updated_dc = 0
    updated_gh = 0
    not_found = 0

    with engine.begin() as conn:
        for row in rows:
            # Tìm customer theo ma_kh (exact match — ma_kh là unique)
            result = conn.execute(
                text("SELECT id, dia_chi, dia_chi_giao_hang FROM customers WHERE UPPER(TRIM(ma_kh)) = UPPER(TRIM(:mk))"),
                {"mk": row["ma_kh"]},
            ).fetchone()

            if not result:
                not_found += 1
                print(f"  [SKIP] {row['ma_kh']} — không tìm thấy trong ERP")
                continue

            cust_id, cur_dc, cur_gh = result

            updates = {}
            if row["dia_chi"] and not cur_dc:
                updates["dia_chi"] = row["dia_chi"]
                updated_dc += 1
            if row["giao_hang"] and not cur_gh:
                updates["dia_chi_giao_hang"] = row["giao_hang"]
                updated_gh += 1

            if updates:
                set_clause = ", ".join(f"{k} = :{k}" for k in updates)
                updates["cust_id"] = cust_id
                conn.execute(
                    text(f"UPDATE customers SET {set_clause} WHERE id = :cust_id"),
                    updates,
                )
                label = row["ma_kh"]
                parts = []
                if "dia_chi" in updates:
                    parts.append(f"dia_chi={updates['dia_chi'][:40]}")
                if "dia_chi_giao_hang" in updates:
                    parts.append(f"giao_hang={updates['dia_chi_giao_hang'][:40]}")
                print(f"  [OK] {label:12s} → {' | '.join(parts)}")

    print()
    print(f"=== KẾT QUẢ ===")
    print(f"  Cập nhật dia_chi:           {updated_dc}")
    print(f"  Cập nhật dia_chi_giao_hang: {updated_gh}")
    print(f"  Không tìm thấy trong ERP:   {not_found}")
    print(f"  Tổng HTCPH rows:            {len(rows)}")


if __name__ == "__main__":
    run()
