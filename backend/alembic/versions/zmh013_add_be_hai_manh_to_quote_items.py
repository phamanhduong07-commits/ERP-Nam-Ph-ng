"""add be_hai_manh to quote_items

Revision ID: zmh013
Revises: zmh012
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh013'
down_revision = 'zmh012'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('quote_items', sa.Column('be_hai_manh', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('quote_items', 'be_hai_manh')
