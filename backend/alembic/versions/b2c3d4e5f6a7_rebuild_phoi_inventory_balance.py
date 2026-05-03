"""Rebuild InventoryBalance for PHOI warehouses using so_tam + poi.ten_hang

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── 1. Xoá InventoryBalance + InventoryTransaction cũ cho kho PHOI ─────────
    conn.execute(text("""
        DELETE FROM inventory_transactions
        WHERE warehouse_id IN (
            SELECT id FROM warehouses WHERE loai_kho = 'PHOI'
        )
    """))

    conn.execute(text("""
        DELETE FROM inventory_balances
        WHERE warehouse_id IN (
            SELECT id FROM warehouses WHERE loai_kho = 'PHOI'
        )
        AND paper_material_id IS NULL
        AND other_material_id IS NULL
        AND product_id IS NULL
    """))

    # ── 2. Nhập từ PhieuNhapPhoiSong: sum(so_tam) theo (warehouse_id, poi.ten_hang) ─
    nhap_rows = conn.execute(text("""
        SELECT
            pnps.warehouse_id,
            poi.ten_hang,
            SUM(COALESCE(pnpsi.so_tam, 0)) AS tong_tam
        FROM phieu_nhap_phoi_song_items pnpsi
        JOIN phieu_nhap_phoi_song pnps ON pnps.id = pnpsi.phieu_id
        JOIN production_order_items poi ON poi.id = pnpsi.production_order_item_id
        WHERE pnps.warehouse_id IS NOT NULL
          AND COALESCE(pnpsi.so_tam, 0) > 0
        GROUP BY pnps.warehouse_id, poi.ten_hang
    """)).fetchall()

    # Tạo/cập nhật InventoryBalance nhap
    balance_map: dict[tuple, int] = {}  # (warehouse_id, ten_hang) → balance_id
    for row in nhap_rows:
        wh_id, ten_hang, tong_tam = row.warehouse_id, row.ten_hang, float(row.tong_tam)
        result = conn.execute(text("""
            INSERT INTO inventory_balances
                (warehouse_id, paper_material_id, other_material_id, product_id,
                 ten_hang, don_vi, ton_luong, gia_tri_ton, don_gia_binh_quan, cap_nhat_luc)
            VALUES
                (:wh_id, NULL, NULL, NULL,
                 :ten_hang, 'Tấm', :ton_luong, 0, 0, NOW())
            ON CONFLICT DO NOTHING
            RETURNING id
        """), {"wh_id": wh_id, "ten_hang": ten_hang, "ton_luong": tong_tam})
        inserted = result.fetchone()
        if inserted:
            balance_map[(wh_id, ten_hang)] = inserted.id
        else:
            # Đã tồn tại (do ON CONFLICT) — update và lấy id
            conn.execute(text("""
                UPDATE inventory_balances
                SET ton_luong = ton_luong + :delta, cap_nhat_luc = NOW()
                WHERE warehouse_id = :wh_id
                  AND ten_hang = :ten_hang
                  AND paper_material_id IS NULL
                  AND other_material_id IS NULL
                  AND product_id IS NULL
            """), {"delta": tong_tam, "wh_id": wh_id, "ten_hang": ten_hang})

    # ── 3. Xuất từ PhieuXuatPhoi: subtract theo (kho PHOI của xưởng, ten_hang) ──
    xuat_rows = conn.execute(text("""
        SELECT
            w.id AS warehouse_id,
            pxpi.ten_hang,
            SUM(pxpi.so_luong) AS tong_xuat
        FROM phieu_xuat_phoi_items pxpi
        JOIN production_order_items poi ON poi.id = pxpi.production_order_item_id
        JOIN production_orders po ON po.id = poi.production_order_id
        JOIN warehouses w ON w.phan_xuong_id = po.phan_xuong_id AND w.loai_kho = 'PHOI'
        WHERE pxpi.production_order_item_id IS NOT NULL
          AND po.phan_xuong_id IS NOT NULL
          AND pxpi.so_luong > 0
        GROUP BY w.id, pxpi.ten_hang
    """)).fetchall()

    for row in xuat_rows:
        conn.execute(text("""
            UPDATE inventory_balances
            SET ton_luong = GREATEST(0, ton_luong - :delta), cap_nhat_luc = NOW()
            WHERE warehouse_id = :wh_id
              AND ten_hang = :ten_hang
              AND paper_material_id IS NULL
              AND other_material_id IS NULL
              AND product_id IS NULL
        """), {"delta": float(row.tong_xuat), "wh_id": row.warehouse_id, "ten_hang": row.ten_hang})

    # ── 4. Chuyển kho đã thực hiện: cộng/trừ theo PhieuChuyenKho ────────────────
    # Trừ kho xuất
    chuyen_xuat = conn.execute(text("""
        SELECT
            pck.warehouse_xuat_id AS warehouse_id,
            pcki.ten_hang,
            SUM(pcki.so_luong) AS tong_chuyen
        FROM phieu_chuyen_kho_item pcki
        JOIN phieu_chuyen_kho pck ON pck.id = pcki.phieu_chuyen_kho_id
        JOIN warehouses w ON w.id = pck.warehouse_xuat_id AND w.loai_kho = 'PHOI'
        WHERE pcki.paper_material_id IS NULL
          AND pcki.other_material_id IS NULL
          AND pcki.so_luong > 0
        GROUP BY pck.warehouse_xuat_id, pcki.ten_hang
    """)).fetchall()

    for row in chuyen_xuat:
        conn.execute(text("""
            UPDATE inventory_balances
            SET ton_luong = GREATEST(0, ton_luong - :delta), cap_nhat_luc = NOW()
            WHERE warehouse_id = :wh_id
              AND ten_hang = :ten_hang
              AND paper_material_id IS NULL
              AND other_material_id IS NULL
              AND product_id IS NULL
        """), {"delta": float(row.tong_chuyen), "wh_id": row.warehouse_id, "ten_hang": row.ten_hang})

    # Cộng kho nhập
    chuyen_nhap = conn.execute(text("""
        SELECT
            pck.warehouse_nhap_id AS warehouse_id,
            pcki.ten_hang,
            SUM(pcki.so_luong) AS tong_chuyen
        FROM phieu_chuyen_kho_item pcki
        JOIN phieu_chuyen_kho pck ON pck.id = pcki.phieu_chuyen_kho_id
        JOIN warehouses w ON w.id = pck.warehouse_nhap_id AND w.loai_kho = 'PHOI'
        WHERE pcki.paper_material_id IS NULL
          AND pcki.other_material_id IS NULL
          AND pcki.so_luong > 0
        GROUP BY pck.warehouse_nhap_id, pcki.ten_hang
    """)).fetchall()

    for row in chuyen_nhap:
        # Upsert: kho nhập có thể chưa có record (nếu chưa nhập trực tiếp)
        conn.execute(text("""
            INSERT INTO inventory_balances
                (warehouse_id, paper_material_id, other_material_id, product_id,
                 ten_hang, don_vi, ton_luong, gia_tri_ton, don_gia_binh_quan, cap_nhat_luc)
            VALUES (:wh_id, NULL, NULL, NULL, :ten_hang, 'Tấm', :delta, 0, 0, NOW())
            ON CONFLICT DO NOTHING
        """), {"wh_id": row.warehouse_id, "ten_hang": row.ten_hang, "delta": float(row.tong_chuyen)})

        conn.execute(text("""
            UPDATE inventory_balances
            SET ton_luong = ton_luong + :delta, cap_nhat_luc = NOW()
            WHERE warehouse_id = :wh_id
              AND ten_hang = :ten_hang
              AND paper_material_id IS NULL
              AND other_material_id IS NULL
              AND product_id IS NULL
        """), {"delta": float(row.tong_chuyen), "wh_id": row.warehouse_id, "ten_hang": row.ten_hang})

    # ── 5. Đảm bảo không có ton_luong âm ─────────────────────────────────────────
    conn.execute(text("""
        UPDATE inventory_balances
        SET ton_luong = 0
        WHERE ton_luong < 0
          AND warehouse_id IN (SELECT id FROM warehouses WHERE loai_kho = 'PHOI')
    """))


def downgrade():
    # Không thể rollback data migration an toàn — chỉ xoá balance đã rebuild
    op.execute("""
        DELETE FROM inventory_balances
        WHERE warehouse_id IN (SELECT id FROM warehouses WHERE loai_kho = 'PHOI')
        AND paper_material_id IS NULL
        AND other_material_id IS NULL
        AND product_id IS NULL
    """)
