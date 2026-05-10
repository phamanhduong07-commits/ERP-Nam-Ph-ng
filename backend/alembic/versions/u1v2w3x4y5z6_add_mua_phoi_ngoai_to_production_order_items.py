"""add mua_phoi_ngoai to production_order_items and mua_ngoai trang_thai to production_orders

Revision ID: u1v2w3x4y5z6
Revises: t1u2v3w4x5y6
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'u1v2w3x4y5z6'
down_revision = 't1u2v3w4x5y6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'production_order_items',
        sa.Column('mua_phoi_ngoai', sa.Boolean(), nullable=False, server_default='0')
    )


def downgrade():
    op.drop_column('production_order_items', 'mua_phoi_ngoai')
