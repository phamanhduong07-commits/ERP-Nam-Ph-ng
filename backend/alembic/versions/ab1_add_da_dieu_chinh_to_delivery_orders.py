"""add da_dieu_chinh to delivery_orders

Revision ID: ab1_add_da_dieu_chinh
Revises: aa_quote_item_ma_ky_hieu_sale_admin_roles
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'ab1_add_da_dieu_chinh'
down_revision = 'aa_quote_item_ma_ky_hieu_sale_admin_roles'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('delivery_orders', sa.Column('da_dieu_chinh', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('delivery_orders', 'da_dieu_chinh')
