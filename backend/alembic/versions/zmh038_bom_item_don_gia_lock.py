"""bom_item: add don_gia_lock for price snapshot at BOM confirmation

Revision ID: zmh038
Revises: zmh037
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh038'
down_revision = 'zmh037'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'production_bom_items',
        sa.Column('don_gia_lock', sa.Numeric(18, 2), nullable=True),
    )


def downgrade():
    op.drop_column('production_bom_items', 'don_gia_lock')
