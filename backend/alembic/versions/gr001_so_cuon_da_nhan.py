"""add so_cuon_da_nhan to purchase_order_items

Revision ID: gr001
Revises:
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'gr001'
down_revision = 'push001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'purchase_order_items',
        sa.Column('so_cuon_da_nhan', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade():
    op.drop_column('purchase_order_items', 'so_cuon_da_nhan')
