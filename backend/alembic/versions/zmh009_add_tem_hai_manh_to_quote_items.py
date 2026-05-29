"""add tem_hai_manh to quote_items

Revision ID: zmh009
Revises: zmh008
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh009'
down_revision = 'zmh008'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('quote_items', sa.Column('tem_hai_manh', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('quote_items', 'tem_hai_manh')
