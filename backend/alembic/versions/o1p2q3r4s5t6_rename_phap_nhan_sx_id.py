"""rename phap_nhan_sx_id to phap_nhan_id in production_orders

Revision ID: o1p2q3r4s5t6
Revises: n1o2p3q4r5s6
Create Date: 2026-05-08
"""
from alembic import op

revision = 'o1p2q3r4s5t6'
down_revision = 'n1o2p3q4r5s6'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('production_orders', 'phap_nhan_sx_id', new_column_name='phap_nhan_id')


def downgrade():
    op.alter_column('production_orders', 'phap_nhan_id', new_column_name='phap_nhan_sx_id')
