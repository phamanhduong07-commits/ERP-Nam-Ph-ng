"""add ho_nap ho_day to quote_items

Revision ID: qv003
Revises: qv002
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'qv003'
down_revision = 'qv002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quote_items', sa.Column('ho_mo', sa.Boolean(), nullable=True))
    op.add_column('quote_items', sa.Column('ho_nap', sa.Float(), nullable=True))
    op.add_column('quote_items', sa.Column('ho_day', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('quote_items', 'ho_day')
    op.drop_column('quote_items', 'ho_nap')
    op.drop_column('quote_items', 'ho_mo')
