"""add phan_xuong_id to quote_items and sales_order_items

Revision ID: px20260528
Revises: banking001
Create Date: 2026-05-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'px20260528'
down_revision = 'banking001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quote_items',
        sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True)
    )
    op.add_column('sales_order_items',
        sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('sales_order_items', 'phan_xuong_id')
    op.drop_column('quote_items', 'phan_xuong_id')
