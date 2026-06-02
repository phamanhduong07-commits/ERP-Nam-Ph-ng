"""add ton_luong_truoc to inventory_balances

Revision ID: ib001_add_ton_luong_truoc
Revises: a1b2c3d4e5f6, b2c3d4e5f6a7, d4e5f6a7b8c9, pm001_add_loai_giay, fa001
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'ib001_add_ton_luong_truoc'
down_revision = ('a1b2c3d4e5f6', 'b2c3d4e5f6a7', 'd4e5f6a7b8c9', 'pm001_add_loai_giay', 'fa001')
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('inventory_balances',
        sa.Column('ton_luong_truoc', sa.Numeric(14, 3), nullable=True)
    )


def downgrade():
    op.drop_column('inventory_balances', 'ton_luong_truoc')
