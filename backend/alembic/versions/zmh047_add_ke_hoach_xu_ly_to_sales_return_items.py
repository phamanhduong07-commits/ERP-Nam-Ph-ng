"""Add ke_hoach_xu_ly to sales_return_items

Revision ID: zmh047
Revises: zmh046
Create Date: 2026-06-26

"""
import sqlalchemy as sa
from alembic import op

revision = 'zmh047'
down_revision = 'zmh046'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'sales_return_items',
        sa.Column('ke_hoach_xu_ly', sa.String(20), nullable=True, server_default='nhap_kho')
    )


def downgrade():
    op.drop_column('sales_return_items', 'ke_hoach_xu_ly')
