"""
Seed GiayRoll từ SQL Server HTCPH — nhập cuộn giấy đang tồn kho vào ERP mới.

Chỉ seed rolls:
- Makho = 'KNVL01' (Kho NVL Long An — kho giấy cuộn chính)
- MaNL có format NCC.GROUP.CODE.DL.KHO (có dấu chấm)
- Chưa bị xuất kho (không có DT43 record)
- MaCuon chưa tồn tại trong giay_rolls.barcode

Chạy:
    cd backend
    python seed_htcph_giay_rolls.py [--dry-run] [--from-date YYYY-MM-DD]
"""

import sys
import io
import argparse
from datetime import date, datetime

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import pyodbc
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# ── Config ────────────────────────────────────────────────────────────────────
HTCPH_DSN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "Encrypt=no;"
    "TrustServerCertificate=yes;"
)
TARGET_KHO = "KNVL01"  # Kho NVL Long An (giấy cuộn chính)


def get_erp_engine():
    import sys
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
    try:
        from app.config import settings
        db_url = settings.DATABASE_URL
    except Exception:
        import os
        db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("Không tìm thấy DATABASE_URL")
    print(f"[ERP] Connecting to: {db_url[:60]}...")
    return create_engine(db_url)


def fetch_in_stock_rolls(htcph_conn, from_date: str) -> list[dict]:
    """Lấy danh sách cuộn giấy đang tồn kho từ HTCPH."""
    cur = htcph_conn.cursor()
    cur.execute(f"""
        SELECT
            d42.MaCuon,
            d42.MaNL,
            CAST(ISNULL(d42.SoLuong, 0) AS FLOAT) AS SoLuong,
            m.Makho,
            CAST(m.NgayCT AS DATE)                 AS NgayCT,
            m.SoCT
        FROM DT42 d42
        JOIN MT42 m ON d42.MT42ID = m.MT42ID
        WHERE
            d42.MaCuon IS NOT NULL
            AND d42.MaCuon != ''
            AND d42.MaNL   LIKE '%.%'
            AND m.Makho     = '{TARGET_KHO}'
            AND m.NgayCT   >= '{from_date}'
            AND NOT EXISTS (
                SELECT 1 FROM DT43 d43
                WHERE d43.MaCuon = d42.MaCuon
            )
        ORDER BY m.NgayCT DESC
    """)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def main():
    parser = argparse.ArgumentParser(description="Seed GiayRoll từ SQL Server HTCPH")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ in ra, không ghi vào DB")
    parser.add_argument("--from-date", default="2026-01-01", help="Chỉ seed từ ngày này (YYYY-MM-DD)")
    args = parser.parse_args()

    print(f"[Config] from_date={args.from_date}  dry_run={args.dry_run}")

    # ── Kết nối SQL Server ───────────────────────────────────────────────────
    print("[HTCPH] Connecting to SQL Server...")
    htcph = pyodbc.connect(HTCPH_DSN, timeout=15)
    rolls = fetch_in_stock_rolls(htcph, args.from_date)
    print(f"[HTCPH] Found {len(rolls)} in-stock rolls from {args.from_date}")
    htcph.close()

    if not rolls:
        print("Không có cuộn nào cần seed.")
        return

    # ── Kết nối ERP ─────────────────────────────────────────────────────────
    engine = get_erp_engine()

    with Session(engine) as db:
        # Lấy mapping PaperMaterial: ma_chinh → id
        pm_rows = db.execute(text("SELECT id, ma_chinh FROM paper_materials WHERE ma_chinh IS NOT NULL")).fetchall()
        pm_map: dict[str, int] = {r.ma_chinh: r.id for r in pm_rows}
        print(f"[ERP] PaperMaterial map: {len(pm_map)} entries")

        # Lấy warehouse id cho KNVL01 (tìm theo ten_kho)
        wh_row = db.execute(text(
            "SELECT id, ten_kho FROM warehouses WHERE ten_kho LIKE '%NVL%' AND ten_kho LIKE '%Long%' LIMIT 1"
        )).fetchone()

        if not wh_row:
            # Fallback: lấy kho đầu tiên
            wh_row = db.execute(text("SELECT id, ten_kho FROM warehouses LIMIT 1")).fetchone()

        if not wh_row:
            print("[ERROR] Không tìm thấy warehouse trong ERP. Kiểm tra bảng warehouses.")
            sys.exit(1)

        warehouse_id = wh_row.id
        print(f"[ERP] Mapping KNVL01 -> warehouse id={warehouse_id} ({wh_row.ten_kho})")

        # Lấy barcode đã tồn tại để skip
        existing_barcodes: set[str] = {
            r[0] for r in db.execute(text("SELECT barcode FROM giay_rolls")).fetchall()
        }
        print(f"[ERP] Existing GiayRoll barcodes: {len(existing_barcodes)}")

        inserted = skipped_no_pm = skipped_exists = 0
        to_insert = []

        for r in rolls:
            barcode: str = r["MaCuon"]
            ma_nl: str   = r["MaNL"]
            so_luong: float = r["SoLuong"]
            ngay_ct        = r["NgayCT"]
            so_ct: str     = r["SoCT"] or ""

            if barcode in existing_barcodes:
                skipped_exists += 1
                continue

            pm_id = pm_map.get(ma_nl)
            if not pm_id:
                skipped_no_pm += 1
                if skipped_no_pm <= 5:
                    print(f"  [SKIP] MaNL '{ma_nl}' không khớp PaperMaterial")
                continue

            to_insert.append({
                "barcode":              barcode,
                "goods_receipt_id":     None,
                "goods_receipt_item_id": None,
                "paper_material_id":    pm_id,
                "warehouse_id":         warehouse_id,
                "so_phieu_nhap":        so_ct,
                "ngay_nhap":            ngay_ct.isoformat() if hasattr(ngay_ct, "isoformat") else str(ngay_ct),
                "trong_luong_ban_dau":  so_luong,
                "trong_luong_con_lai":  so_luong,
                "trang_thai":           "trong_kho",
            })

        print(f"\n[Summary]")
        print(f"  To insert:          {len(to_insert)}")
        print(f"  Skip (exists):      {skipped_exists}")
        print(f"  Skip (no PM match): {skipped_no_pm}")

        if args.dry_run:
            print("\n[DRY RUN] Không ghi DB. Sample (first 5):")
            for row in to_insert[:5]:
                print(f"  {row['barcode']} | pm={row['paper_material_id']} | {row['trong_luong_ban_dau']}kg | {row['ngay_nhap']}")
            return

        if not to_insert:
            print("Không có gì để insert.")
            return

        # Batch insert
        db.execute(
            text("""
                INSERT INTO giay_rolls
                    (barcode, goods_receipt_id, goods_receipt_item_id,
                     paper_material_id, warehouse_id, so_phieu_nhap,
                     ngay_nhap, trong_luong_ban_dau, trong_luong_con_lai,
                     trang_thai, created_at)
                VALUES
                    (:barcode, :goods_receipt_id, :goods_receipt_item_id,
                     :paper_material_id, :warehouse_id, :so_phieu_nhap,
                     :ngay_nhap, :trong_luong_ban_dau, :trong_luong_con_lai,
                     :trang_thai, CURRENT_TIMESTAMP)
            """),
            to_insert,
        )
        db.commit()
        inserted = len(to_insert)
        print(f"\n[Done] Inserted {inserted} GiayRoll records.")


if __name__ == "__main__":
    main()
