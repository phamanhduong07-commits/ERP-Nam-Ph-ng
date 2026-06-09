"""
Seed gia_mua cho other_materials tu SQL Server HTCPH.

Lay DonGia moi nhat tu DT42 (kho KVT01/KVT02/KNVL01) theo tung MaNL,
khop voi other_materials.ma_chinh, cap nhat gia_mua.

Chay:
    cd backend
    python seed_gia_nvl_khac_from_htcph.py            # dry-run (mac dinh)
    python seed_gia_nvl_khac_from_htcph.py --commit   # ghi thuc su
    python seed_gia_nvl_khac_from_htcph.py --from-date 2026-01-01  # chi lay gia tu ngay nay
"""

import argparse
import io
import sys
from datetime import date

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import pyodbc
from sqlalchemy import create_engine, text
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

TARGET_KHOS = ("KVT01", "KVT02", "KNVL01")


def get_erp_engine():
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
    try:
        from app.config import settings
        db_url = settings.DATABASE_URL
    except Exception:
        import os
        db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("Khong tim thay DATABASE_URL")
    return create_engine(db_url)


def fetch_latest_prices(htcph_conn, from_date: str) -> dict[str, dict]:
    """Lay gia mua moi nhat tung MaNL tu DT42."""
    kho_list = ", ".join(f"'{k}'" for k in TARGET_KHOS)
    cur = htcph_conn.cursor()
    cur.execute(f"""
        WITH LatestPrice AS (
            SELECT
                d.MaNL,
                d.TenHang,
                d.DVT,
                CAST(d.DonGia AS FLOAT)        AS DonGia,
                CAST(m.NgayCT AS DATE)          AS NgayCT,
                m.Makho,
                m.MaNCC,
                ROW_NUMBER() OVER (
                    PARTITION BY d.MaNL
                    ORDER BY m.NgayCT DESC
                ) AS rn
            FROM DT42 d
            JOIN MT42 m ON d.MT42ID = m.MT42ID
            WHERE m.Makho IN ({kho_list})
              AND d.MaNL NOT LIKE '%.%'
              AND d.MaNL != ''
              AND d.DonGia > 0
              AND m.NgayCT >= '{from_date}'
        )
        SELECT MaNL, TenHang, DVT, DonGia, NgayCT, Makho, MaNCC
        FROM LatestPrice
        WHERE rn = 1
    """)
    cols = [c[0] for c in cur.description]
    result = {}
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        result[d["MaNL"]] = d
    return result


def main():
    parser = argparse.ArgumentParser(description="Seed gia_mua NVL khac tu HTCPH")
    parser.add_argument("--commit", action="store_true", help="Ghi vao DB (mac dinh: dry-run)")
    parser.add_argument(
        "--from-date",
        default="2024-01-01",
        help="Chi lay gia tu ngay nay tro di (YYYY-MM-DD), mac dinh 2024-01-01",
    )
    args = parser.parse_args()
    dry_run = not args.commit

    print(f"[Config] from_date={args.from_date}  dry_run={dry_run}")

    # --- Ket noi SQL Server ---
    print("[HTCPH] Connecting to SQL Server...")
    htcph = pyodbc.connect(HTCPH_DSN, timeout=15)
    ss_prices = fetch_latest_prices(htcph, args.from_date)
    htcph.close()
    print(f"[HTCPH] Found {len(ss_prices)} MaNL co gia trong DT42 (tu {args.from_date})")

    if not ss_prices:
        print("Khong co du lieu tu SQL Server.")
        return

    # --- Ket noi ERP ---
    engine = get_erp_engine()

    with Session(engine) as db:
        erp_rows = db.execute(
            text("SELECT id, ma_chinh, ten, gia_mua FROM other_materials")
        ).fetchall()
        erp_map = {r.ma_chinh: r for r in erp_rows}
        print(f"[ERP] other_materials hien tai: {len(erp_map)} records")

        matched = []
        unmatched_ss = []

        for ma_nl, ss_row in ss_prices.items():
            if ma_nl in erp_map:
                erp_row = erp_map[ma_nl]
                gia_erp = float(erp_row.gia_mua or 0)
                gia_ss = ss_row["DonGia"]
                matched.append({
                    "id": erp_row.id,
                    "ma_chinh": ma_nl,
                    "ten": erp_row.ten,
                    "gia_cu": gia_erp,
                    "gia_moi": gia_ss,
                    "ngay_ss": ss_row["NgayCT"],
                    "kho": ss_row["Makho"],
                })
            else:
                unmatched_ss.append(ma_nl)

        print(f"\n[Summary]")
        print(f"  Matched (se update gia_mua): {len(matched)}")
        print(f"  SQL Server ko khop ERP:      {len(unmatched_ss)}")
        print(f"  ERP ko co gia tu SS:         {len(erp_map) - len(matched)}")

        if unmatched_ss:
            print(f"\n[Unmatched SS -> ERP] ({len(unmatched_ss)} codes):")
            for code in sorted(unmatched_ss)[:20]:
                print(f"  {code}")
            if len(unmatched_ss) > 20:
                print(f"  ... va {len(unmatched_ss) - 20} codes nua")

        changed = [m for m in matched if abs(m["gia_cu"] - m["gia_moi"]) >= 1]
        same = [m for m in matched if abs(m["gia_cu"] - m["gia_moi"]) < 1]
        print(f"\n  Gia thay doi: {len(changed)}")
        print(f"  Gia khong doi: {len(same)}")

        if dry_run:
            print(f"\n[DRY RUN] Se update {len(changed)} records (gia thay doi):")
            for m in sorted(changed, key=lambda x: x["ma_chinh"])[:50]:
                print(
                    f"  {m['ma_chinh']:25s} | {m['ten'][:35]:35s} | "
                    f"{m['gia_cu']:>12,.0f} -> {m['gia_moi']:>12,.0f} | {m['ngay_ss']}"
                )
            if len(changed) > 50:
                print(f"  ... va {len(changed) - 50} records nua")
            print("\nChay lai voi --commit de ghi vao DB.")
            return

        # --- Ghi vao DB ---
        if not changed:
            print("\nKhong co gia nao thay doi. Ket thuc.")
            return

        updated = 0
        for m in changed:
            db.execute(
                text("""
                    UPDATE other_materials
                    SET gia_mua = :gia_moi, updated_at = NOW()
                    WHERE id = :id
                """),
                {"gia_moi": m["gia_moi"], "id": m["id"]},
            )
            updated += 1

        db.commit()
        print(f"\n[Done] Da update gia_mua cho {updated} records.")
        for m in sorted(changed, key=lambda x: x["ma_chinh"]):
            print(
                f"  {m['ma_chinh']:25s} | {m['ten'][:35]:35s} | "
                f"{m['gia_cu']:>12,.0f} -> {m['gia_moi']:>12,.0f}"
            )


if __name__ == "__main__":
    main()
