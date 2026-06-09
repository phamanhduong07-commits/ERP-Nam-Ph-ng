"""
Thay thế virtual IB rolls bằng mã cuộn thực từ HTCPH ton_KNVL01.

Với mỗi material trong inventory_balances có MaNL khớp với ton_KNVL01:
  - Xóa virtual IB-{pm_id}-{wh_id} roll
  - Thêm các cuộn thực từ ton_KNVL01 (MaCuon là barcode, RemainQty là trọng lượng còn lại)

34 materials không có trong HTCPH giữ nguyên virtual IB roll.

Chạy:
    cd backend
    python seed_macuon_from_htcph.py [--dry-run]
"""

import sys
import io
import argparse

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import pyodbc
from sqlalchemy import text
from sqlalchemy.orm import Session

HTCPH_DSN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "Encrypt=no;"
    "TrustServerCertificate=yes;"
)


def get_erp_engine():
    import pathlib
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    from app.config import settings
    print(f"[ERP] {settings.DATABASE_URL[:60]}...")
    from sqlalchemy import create_engine
    return create_engine(settings.DATABASE_URL)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(f"[Config] dry_run={args.dry_run}")

    engine = get_erp_engine()

    # --- Doc inventory_balances + ma_chinh ------------------------------------
    with engine.connect() as conn:
        ib_rows = conn.execute(text("""
            SELECT ib.paper_material_id, ib.warehouse_id, ib.ton_luong, pm.ma_chinh
            FROM inventory_balances ib
            JOIN paper_materials pm ON pm.id = ib.paper_material_id
            WHERE ib.ton_luong > 0 AND ib.paper_material_id IS NOT NULL
        """)).fetchall()

    # ma_chinh -> (pm_id, wh_id, ton_luong)
    ib_map = {r.ma_chinh: (r.paper_material_id, r.warehouse_id) for r in ib_rows}
    print(f"[IB] {len(ib_map)} materials")

    # --- Doc ton_KNVL01 -------------------------------------------------------
    print("[HTCPH] Connecting...")
    htcph = pyodbc.connect(HTCPH_DSN, timeout=15)
    cur = htcph.cursor()
    cur.execute("""
        SELECT MaCuon, MaNL,
               CAST(SoLuong   AS FLOAT) AS SoLuong,
               CAST(RemainQty AS FLOAT) AS RemainQty,
               SoCT, CAST(NgayCT AS DATE) AS NgayCT
        FROM ton_KNVL01
        WHERE RemainQty > 0
        ORDER BY MaNL, NgayCT
    """)
    htcph_rows = cur.fetchall()
    htcph.close()
    print(f"[HTCPH] ton_KNVL01: {len(htcph_rows)} rolls")

    # --- Match ----------------------------------------------------------------
    to_replace: dict[int, list[dict]] = {}   # pm_id -> list of roll dicts
    no_match_ma: set[str] = set()

    for row in htcph_rows:
        ma_nl = row.MaNL
        if ma_nl not in ib_map:
            no_match_ma.add(ma_nl)
            continue
        pm_id, wh_id = ib_map[ma_nl]
        to_replace.setdefault(pm_id, []).append({
            "barcode":             row.MaCuon,
            "paper_material_id":   pm_id,
            "warehouse_id":        wh_id,
            "so_phieu_nhap":       row.SoCT or "",
            "ngay_nhap":           row.NgayCT.isoformat() if row.NgayCT else None,
            "trong_luong_ban_dau": row.SoLuong,
            "trong_luong_con_lai": row.RemainQty,
            "trang_thai":          "trong_kho",
        })

    total_real_rolls = sum(len(v) for v in to_replace.values())
    print(f"\n[Match] {len(to_replace)} materials -> {total_real_rolls} cuon thuc")
    print(f"[NoMatch] {len(no_match_ma)} MaNL khong co trong IB (se bo qua)")

    if args.dry_run:
        # Sample
        sample_pm = next(iter(to_replace))
        rolls = to_replace[sample_pm]
        print(f"\n[DRY RUN] Sample pm={sample_pm} ({len(rolls)} cuon):")
        for r in rolls[:3]:
            print(f"  {r['barcode']} | {r['trong_luong_con_lai']:.0f}/{r['trong_luong_ban_dau']:.0f} kg | {r['ngay_nhap']}")
        return

    # --- Apply ----------------------------------------------------------------
    with Session(engine) as db:
        # Lay existing barcodes de skip duplicate
        existing_barcodes: set[str] = {
            r[0] for r in db.execute(text("SELECT barcode FROM giay_rolls")).fetchall()
        }

        deleted = 0
        inserted = 0
        skipped_dup = 0

        for pm_id, rolls in to_replace.items():
            # Tim wh_id tu roll dau tien
            wh_id = rolls[0]["warehouse_id"]

            # Xoa virtual IB roll cho combo nay (neu co)
            ib_barcode = f"IB-{pm_id}-{wh_id}"
            if ib_barcode in existing_barcodes:
                db.execute(text("DELETE FROM giay_rolls WHERE barcode = :bc"), {"bc": ib_barcode})
                existing_barcodes.discard(ib_barcode)
                deleted += 1

            # Insert cac cuon thuc
            for r in rolls:
                if r["barcode"] in existing_barcodes:
                    skipped_dup += 1
                    continue
                db.execute(text("""
                    INSERT INTO giay_rolls
                        (barcode, goods_receipt_id, goods_receipt_item_id,
                         paper_material_id, warehouse_id, so_phieu_nhap,
                         ngay_nhap, trong_luong_ban_dau, trong_luong_con_lai,
                         trang_thai, created_at)
                    VALUES
                        (:barcode, NULL, NULL,
                         :paper_material_id, :warehouse_id, :so_phieu_nhap,
                         :ngay_nhap, :trong_luong_ban_dau, :trong_luong_con_lai,
                         :trang_thai, CURRENT_TIMESTAMP)
                """), r)
                existing_barcodes.add(r["barcode"])
                inserted += 1

        db.commit()
        print(f"\n[Done] Deleted {deleted} virtual IB rolls, inserted {inserted} real rolls, skipped {skipped_dup} duplicates")

        # Verify
        result = db.execute(text("""
            SELECT COUNT(*) as rolls, COUNT(DISTINCT paper_material_id::text || '-' || warehouse_id::text) as combos,
                   SUM(trong_luong_con_lai) as kg
            FROM giay_rolls WHERE trang_thai IN ('trong_kho', 'dang_dung')
        """)).fetchone()
        print(f"[Verify] {result[0]} rolls | {result[1]} unique pm+wh | {result[2]:.0f} kg")


if __name__ == "__main__":
    main()
