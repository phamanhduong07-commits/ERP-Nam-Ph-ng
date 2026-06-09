"""
Seed GiayRoll từ inventory_balances — nguồn chính xác cho tồn kho giấy cuộn ERP.

Mỗi row trong inventory_balances (paper_material_id + warehouse_id + ton_luong > 0)
tương ứng 1 virtual GiayRoll. Sau khi seed, KhoGiayCuonPage sẽ hiển thị đúng
số lượng loại + tổng kg khớp với inventory_balances.

Đồng thời dọn dẹp các roll đã seed sai warehouse (seeded từ HTCPH vào wh=1 Long An
nhưng inventory thực tế ở wh=9 Hoàng Gia).

Chạy:
    cd backend
    python seed_giay_rolls_from_inventory.py [--dry-run] [--clean-htcph-seeds]
"""

import sys
import io
import argparse

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session


def get_erp_engine():
    import pathlib
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    try:
        from app.config import settings
        db_url = settings.DATABASE_URL
    except Exception:
        import os
        db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("Khong tim thay DATABASE_URL")
    print(f"[ERP] Connecting to: {db_url[:60]}...")
    return create_engine(db_url)


def main():
    parser = argparse.ArgumentParser(description="Seed GiayRoll tu inventory_balances")
    parser.add_argument("--dry-run", action="store_true", help="Chi in ra, khong ghi DB")
    parser.add_argument("--clean-htcph-seeds", action="store_true",
                        help="Xoa cac roll da seed tu HTCPH (goods_receipt_id IS NULL, wh=1)")
    args = parser.parse_args()

    print(f"[Config] dry_run={args.dry_run}  clean_htcph_seeds={args.clean_htcph_seeds}")

    engine = get_erp_engine()

    with Session(engine) as db:
        # --- 1. Doc inventory_balances (nguon chinh xac) ----------------------
        ib_rows = db.execute(text("""
            SELECT ib.id, ib.paper_material_id, ib.warehouse_id,
                   ib.ton_luong, ib.don_gia_binh_quan,
                   pm.ma_chinh, w.ten_kho
            FROM inventory_balances ib
            JOIN paper_materials pm ON pm.id = ib.paper_material_id
            JOIN warehouses w ON w.id = ib.warehouse_id
            WHERE ib.paper_material_id IS NOT NULL
              AND ib.ton_luong > 0
            ORDER BY ib.warehouse_id, pm.ma_chinh
        """)).fetchall()
        print(f"[IB] inventory_balances co ton_luong > 0: {len(ib_rows)} entries")

        # --- 2. Doc existing giay_rolls ----------------------------------------
        existing = db.execute(text("""
            SELECT paper_material_id, warehouse_id, barcode, goods_receipt_id
            FROM giay_rolls
        """)).fetchall()
        print(f"[GR] Existing giay_rolls: {len(existing)}")

        # Key: (pm_id, wh_id) -> list of barcodes
        existing_map: dict[tuple, list] = {}
        htcph_seeds: list[str] = []  # barcodes seeded from HTCPH (no GR link)
        for e in existing:
            key = (e.paper_material_id, e.warehouse_id)
            existing_map.setdefault(key, []).append(e.barcode)
            if e.goods_receipt_id is None and e.warehouse_id == 1:
                htcph_seeds.append(e.barcode)

        print(f"[GR]   - HTCPH seeds at wh=1 (to clean): {len(htcph_seeds)}")

        # --- 3. Tinh toan to_insert -------------------------------------------
        to_insert = []
        skipped_exists = 0

        for ib in ib_rows:
            key = (ib.paper_material_id, ib.warehouse_id)
            if key in existing_map:
                skipped_exists += 1
                continue

            barcode = f"IB-{ib.paper_material_id}-{ib.warehouse_id}"
            to_insert.append({
                "barcode":              barcode,
                "goods_receipt_id":     None,
                "goods_receipt_item_id": None,
                "paper_material_id":    ib.paper_material_id,
                "warehouse_id":         ib.warehouse_id,
                "so_phieu_nhap":        "SEED-IB",
                "ngay_nhap":            None,
                "trong_luong_ban_dau":  float(ib.ton_luong),
                "trong_luong_con_lai":  float(ib.ton_luong),
                "trang_thai":           "trong_kho",
            })

        print(f"\n[Summary]")
        print(f"  To insert from IB: {len(to_insert)}")
        print(f"  Skip (already covered): {skipped_exists}")
        if args.clean_htcph_seeds:
            print(f"  HTCPH seeds to delete: {len(htcph_seeds)}")

        if args.dry_run:
            print("\n[DRY RUN] Sample (first 5 to insert):")
            for r in to_insert[:5]:
                print(f"  {r['barcode']} | pm={r['paper_material_id']} | wh={r['warehouse_id']} | {r['trong_luong_ban_dau']:.0f} kg")
            return

        # --- 4. Xoa HTCPH seeds sai warehouse (neu co flag) ------------------
        if args.clean_htcph_seeds and htcph_seeds:
            db.execute(text("""
                DELETE FROM giay_rolls
                WHERE goods_receipt_id IS NULL
                  AND warehouse_id = 1
                  AND barcode NOT LIKE 'IB-%'
            """))
            print(f"[Clean] Deleted {len(htcph_seeds)} HTCPH seeds at wh=1")

        # --- 5. Batch insert --------------------------------------------------
        if not to_insert:
            print("Khong co gi de insert.")
            db.commit()
            return

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
        print(f"\n[Done] Inserted {len(to_insert)} GiayRoll records from inventory_balances.")

        # --- 6. Verify --------------------------------------------------------
        result = db.execute(text("""
            SELECT COUNT(*), SUM(trong_luong_con_lai)
            FROM giay_rolls
            WHERE trang_thai IN ('trong_kho', 'dang_dung')
        """)).fetchone()
        print(f"[Verify] giay_rolls active: {result[0]} rolls, {result[1]:.0f} kg")


if __name__ == "__main__":
    main()
