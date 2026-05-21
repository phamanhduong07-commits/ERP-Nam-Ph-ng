"""add trip cost fields to delivery_orders

Revision ID: trip001
Revises: gr001
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'trip001'
down_revision = 'gr001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('delivery_orders', sa.Column('cau_duong', sa.Numeric(14, 2), nullable=True, server_default='0'))
    op.add_column('delivery_orders', sa.Column('sua_chua', sa.Numeric(14, 2), nullable=True, server_default='0'))
    op.add_column('delivery_orders', sa.Column('tien_com', sa.Numeric(14, 2), nullable=True, server_default='0'))
    op.add_column('delivery_orders', sa.Column('phi_khac', sa.Numeric(14, 2), nullable=True, server_default='0'))


def downgrade() -> None:
    op.drop_column('delivery_orders', 'phi_khac')
    op.drop_column('delivery_orders', 'tien_com')
    op.drop_column('delivery_orders', 'sua_chua')
    op.drop_column('delivery_orders', 'cau_duong')
