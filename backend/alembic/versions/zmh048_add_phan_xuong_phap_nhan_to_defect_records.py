"""Add phan_xuong_id and phap_nhan_id to defect_records

Revision ID: zmh048
Revises: zmh047
Create Date: 2026-06-27

"""
import sqlalchemy as sa
from alembic import op

revision = "zmh048"
down_revision = "zmh047"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("defect_records", sa.Column("phan_xuong_id", sa.Integer(), nullable=True))
    op.add_column("defect_records", sa.Column("phap_nhan_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_defect_records_phan_xuong", "defect_records", "phan_xuong", ["phan_xuong_id"], ["id"])
    op.create_foreign_key("fk_defect_records_phap_nhan", "defect_records", "phap_nhan", ["phap_nhan_id"], ["id"])
    op.create_index("ix_defect_records_phan_xuong_id", "defect_records", ["phan_xuong_id"])
    op.create_index("ix_defect_records_phap_nhan_id", "defect_records", ["phap_nhan_id"])

    # Backfill: cập nhật phan_xuong_id/phap_nhan_id từ nguồn cho các record hiện có
    conn = op.get_bind()

    # --- TP lỗi (ref_type='production_output') ---
    conn.execute(sa.text("""
        UPDATE defect_records AS dr
        SET
            phan_xuong_id = po.phan_xuong_id,
            phap_nhan_id  = po.phap_nhan_id
        FROM production_outputs AS out
        JOIN production_orders AS po ON po.id = out.production_order_id
        WHERE dr.ref_type = 'production_output'
          AND dr.ref_id = out.id
    """))

    # --- Phôi lỗi CD1 (ref_type='phieu_nhap_phoi_song_item') ---
    conn.execute(sa.text("""
        UPDATE defect_records AS dr
        SET
            phan_xuong_id = po.phan_xuong_id,
            phap_nhan_id  = po.phap_nhan_id
        FROM phieu_nhap_phoi_song_items AS item
        JOIN phieu_nhap_phoi_song AS phieu ON phieu.id = item.phieu_id
        JOIN production_orders AS po ON po.id = phieu.production_order_id
        WHERE dr.ref_type = 'phieu_nhap_phoi_song_item'
          AND dr.ref_id = item.id
    """))

    # --- Hàng trả về (ref_type='sales_return_item') ---
    # SalesReturnItem → SalesOrderItem → ProductionOrderItem → ProductionOrder
    conn.execute(sa.text("""
        UPDATE defect_records AS dr
        SET
            phan_xuong_id = po.phan_xuong_id,
            phap_nhan_id  = po.phap_nhan_id
        FROM sales_return_items AS sri
        JOIN sales_order_items AS soi ON soi.id = sri.sales_order_item_id
        JOIN production_order_items AS poi ON poi.sales_order_item_id = soi.id
        JOIN production_orders AS po ON po.id = poi.production_order_id
        WHERE dr.ref_type = 'sales_return_item'
          AND dr.ref_id = sri.id
          AND po.phan_xuong_id IS NOT NULL
    """))


def downgrade():
    op.drop_index("ix_defect_records_phap_nhan_id", table_name="defect_records")
    op.drop_index("ix_defect_records_phan_xuong_id", table_name="defect_records")
    op.drop_constraint("fk_defect_records_phap_nhan", "defect_records", type_="foreignkey")
    op.drop_constraint("fk_defect_records_phan_xuong", "defect_records", type_="foreignkey")
    op.drop_column("defect_records", "phap_nhan_id")
    op.drop_column("defect_records", "phan_xuong_id")
