"""add da_xac_nhan_giao and confirmation fields to delivery_orders

Revision ID: del001
Revises: gps001_sprint3
Create Date: 2026-05-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'del001'
down_revision = 'gps001_sprint3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('delivery_orders', sa.Column('da_xac_nhan_giao', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('delivery_orders', sa.Column('ngay_giao_thuc_te', sa.Date(), nullable=True))
    op.add_column('delivery_orders', sa.Column('ten_nguoi_nhan_thuc_te', sa.String(150), nullable=True))


def downgrade() -> None:
    op.drop_column('delivery_orders', 'ten_nguoi_nhan_thuc_te')
    op.drop_column('delivery_orders', 'ngay_giao_thuc_te')
    op.drop_column('delivery_orders', 'da_xac_nhan_giao')
