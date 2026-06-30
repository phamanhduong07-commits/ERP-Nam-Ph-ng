"""add ho_nap and ho_day to products

Revision ID: zmh051
Revises: zmh050
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh051'
down_revision = 'zmh050'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('ho_nap', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('products', sa.Column('ho_day', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('products', 'ho_nap')
    op.drop_column('products', 'ho_day')
