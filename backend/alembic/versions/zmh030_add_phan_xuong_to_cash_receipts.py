"""add phan_xuong_id to cash_receipts

Revision ID: zmh030
Revises: zmh029
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh030'
down_revision = 'zmh029'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('cash_receipts', sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True))


def downgrade():
    op.drop_column('cash_receipts', 'phan_xuong_id')
