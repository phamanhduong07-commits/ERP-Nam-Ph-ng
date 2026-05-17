"""sync ensure_schema to alembic — catch-up migration

Chuyển toàn bộ DDL từ ensure_schema() (database.py) vào Alembic.
Tất cả thao tác dùng IF NOT EXISTS — an toàn cho DB đang chạy.

Revision ID: a0b1c2d3e4f5
Revises: cc1dd2ee3ff4, t1u2v3w4x5y7
Create Date: 2026-05-17
"""
from typing import Sequence, Union
from alembic import op

revision: str = "a0b1c2d3e4f5"
down_revision: Union[str, tuple] = ("cc1dd2ee3ff4", "t1u2v3w4x5y7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ──────────────────────────────────────────────────────────────────────
    # 1. TẠO BẢNG MỚI (chỉ tạo khi chưa có)
    # ──────────────────────────────────────────────────────────────────────

    # Máy móc dùng chung cho toàn nhà máy (Mobile Tracking)
    op.execute("""
        CREATE TABLE IF NOT EXISTS machines (
            id          SERIAL PRIMARY KEY,
            ten_may     VARCHAR(100) NOT NULL,
            ma_may      VARCHAR(50) UNIQUE,
            loai_may    VARCHAR(50) DEFAULT 'khac',
            sort_order  INTEGER DEFAULT 0,
            active      BOOLEAN DEFAULT TRUE,
            phan_xuong_id INTEGER REFERENCES phan_xuong(id),
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # Nhật ký sự kiện sản xuất tại máy (Start/Stop/Complete)
    op.execute("""
        CREATE TABLE IF NOT EXISTS production_logs (
            id                   SERIAL PRIMARY KEY,
            production_order_id  INTEGER NOT NULL REFERENCES production_orders(id),
            phieu_in_id          INTEGER REFERENCES phieu_in(id),
            machine_id           INTEGER NOT NULL REFERENCES machines(id),
            event_type           VARCHAR(20) NOT NULL,
            quantity_ok          NUMERIC(12,3),
            quantity_loi         NUMERIC(12,3),
            quantity_setup       NUMERIC(12,3),
            ghi_chu              TEXT,
            created_by           INTEGER REFERENCES users(id),
            created_at           TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # Lịch sử chat AI Agent (chuyển từ SQLite sang PostgreSQL)
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_sessions (
            session_id   TEXT PRIMARY KEY,
            user_id      INTEGER REFERENCES users(id),
            history_json JSONB NOT NULL DEFAULT '[]',
            last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ──────────────────────────────────────────────────────────────────────
    # 2. PURCHASE ORDERS — phân xưởng và loại PO
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS phan_xuong_id INTEGER REFERENCES phan_xuong(id)")
    op.execute("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS loai_po VARCHAR(20) DEFAULT 'chung'")
    op.execute("UPDATE purchase_orders SET loai_po = 'chung' WHERE loai_po IS NULL")

    # ──────────────────────────────────────────────────────────────────────
    # 3. PURCHASE ORDER ITEMS — thông tin cuộn giấy + phôi sóng mua ngoài
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS kho_mm NUMERIC(7,1)")
    op.execute("ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS so_cuon INTEGER")
    op.execute("ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS ky_hieu_cuon VARCHAR(50)")
    op.execute("ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS phoi_spec JSONB")
    op.execute(
        "ALTER TABLE purchase_order_items "
        "ADD COLUMN IF NOT EXISTS production_plan_line_id INTEGER REFERENCES production_plan_lines(id)"
    )

    # ──────────────────────────────────────────────────────────────────────
    # 4. PRODUCTION PLAN LINES — cờ mua phôi ngoài
    # ──────────────────────────────────────────────────────────────────────
    op.execute(
        "ALTER TABLE production_plan_lines "
        "ADD COLUMN IF NOT EXISTS mua_phoi_ngoai BOOLEAN NOT NULL DEFAULT FALSE"
    )

    # ──────────────────────────────────────────────────────────────────────
    # 5. PAPER MATERIALS — thông số kỹ thuật bổ sung
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE paper_materials ADD COLUMN IF NOT EXISTS ma_dong_cap VARCHAR(20)")
    op.execute("ALTER TABLE paper_materials ADD COLUMN IF NOT EXISTS do_buc_tb NUMERIC(8,2)")
    op.execute("ALTER TABLE paper_materials ADD COLUMN IF NOT EXISTS do_nen_vong_tb NUMERIC(8,2)")

    # ──────────────────────────────────────────────────────────────────────
    # 6. GOODS RECEIPTS — thông tin xe + hóa đơn + pháp nhân
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS so_xe VARCHAR(30)")
    op.execute("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS invoice_image TEXT")
    op.execute("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS hd_tong_kg NUMERIC(12,2)")
    op.execute("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS phap_nhan_id INTEGER REFERENCES phap_nhan(id)")

    # ──────────────────────────────────────────────────────────────────────
    # 7. GOODS RECEIPT ITEMS — thông tin cuộn giấy + phôi tấm
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS kho_mm NUMERIC(7,1)")
    op.execute("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS so_cuon INTEGER")
    op.execute("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS ky_hieu_cuon VARCHAR(50)")
    op.execute("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS dai_mm NUMERIC(7,1)")
    op.execute("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS so_lop INTEGER")

    # ──────────────────────────────────────────────────────────────────────
    # 8. PRINTER USER — liên kết với máy (Mobile Tracking)
    # ──────────────────────────────────────────────────────────────────────
    op.execute(
        "ALTER TABLE printer_user "
        "ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES machines(id)"
    )

    # ──────────────────────────────────────────────────────────────────────
    # 9. PRODUCTION ORDERS — giá nội bộ chuyển kho phôi
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS don_gia_noi_bo NUMERIC(14,2)")

    # ──────────────────────────────────────────────────────────────────────
    # 10. DELIVERY ORDERS — lơ xe, seal, pháp nhân
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS lo_xe_id INTEGER REFERENCES lo_xe(id)")
    op.execute("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS lo_xe_id_2 INTEGER REFERENCES lo_xe(id)")
    op.execute("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS lo_xe_2 VARCHAR(150)")
    op.execute("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS so_seal VARCHAR(50)")
    op.execute("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS gui_kem_theo TEXT")
    op.execute("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS phap_nhan_id INTEGER REFERENCES phap_nhan(id)")

    # ──────────────────────────────────────────────────────────────────────
    # 11. DON GIA VAN CHUYEN — đơn giá theo m²
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE don_gia_van_chuyen ADD COLUMN IF NOT EXISTS don_gia_m2 NUMERIC(18,2) DEFAULT 0")

    # ──────────────────────────────────────────────────────────────────────
    # 12. PRINT TEMPLATES — đa pháp nhân + xóa unique constraint cũ
    # ──────────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE print_templates ADD COLUMN IF NOT EXISTS phap_nhan_id INTEGER")
    # Xóa unique(ma_mau) cũ để cho phép trùng ma_mau nhưng khác phap_nhan_id
    op.execute("ALTER TABLE print_templates DROP CONSTRAINT IF EXISTS print_templates_ma_mau_key")


def downgrade() -> None:
    # Migration này là catch-up — không có downgrade hoàn chỉnh.
    # Các ADD COLUMN không bị drop vì có thể đã có dữ liệu production.
    # Để rollback: restore DB từ backup trước khi chạy migration này.
    pass
