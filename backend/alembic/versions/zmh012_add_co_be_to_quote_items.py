"""add co_be to quote_items

Revision ID: zmh011
Revises: zmh010
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh012'
down_revision = 'zmh011'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('quote_items', sa.Column('co_be', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('quote_items', 'co_be')
