"""add tem_khac_thiet_ke to quote_items

Revision ID: zmh010
Revises: zmh009
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh010'
down_revision = 'zmh009'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('quote_items', sa.Column('tem_khac_thiet_ke', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('quote_items', 'tem_khac_thiet_ke')
