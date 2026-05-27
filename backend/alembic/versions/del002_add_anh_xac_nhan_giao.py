"""add anh_xac_nhan_giao to delivery_orders

Revision ID: del002
Revises: usr001
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'del002'
down_revision = 'usr001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('delivery_orders', sa.Column('anh_xac_nhan_giao', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('delivery_orders', 'anh_xac_nhan_giao')
