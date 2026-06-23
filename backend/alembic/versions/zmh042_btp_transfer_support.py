"""BTP transfer support: product_id vào PhieuChuyenKhoItem, parent_production_order_id vào ProductionOrder

Revision ID: zmh042
Revises: zmh041
Create Date: 2026-06-23

"""
from alembic import op
import sqlalchemy as sa

revision: str = 'zmh042'
down_revision = 'zmh041'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE phieu_chuyen_kho_item "
        "ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id)"
    )
    op.execute(
        "ALTER TABLE production_orders "
        "ADD COLUMN IF NOT EXISTS parent_production_order_id INTEGER REFERENCES production_orders(id)"
    )


def downgrade() -> None:
    op.drop_column('phieu_chuyen_kho_item', 'product_id')
    op.drop_column('production_orders', 'parent_production_order_id')
