"""phieu_chuyen_kho_item: add production_order_id

Revision ID: a1b2c3d4e5f7
Revises: f2b3c4d5e6a7
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f7'
down_revision = 'f2b3c4d5e6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE phieu_chuyen_kho_item
        ADD COLUMN IF NOT EXISTS production_order_id INTEGER
        REFERENCES production_orders(id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_phieu_chuyen_kho_item_po_id
        ON phieu_chuyen_kho_item(production_order_id)
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_phieu_chuyen_kho_item_po_id")
    op.execute("ALTER TABLE phieu_chuyen_kho_item DROP COLUMN IF EXISTS production_order_id")
