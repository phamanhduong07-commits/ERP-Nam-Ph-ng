"""add loai_giay to paper_materials

Revision ID: pm001_add_loai_giay
Revises:
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'pm001_add_loai_giay'
down_revision = ('zmh011', 'px20260528', 'td001')
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('paper_materials',
        sa.Column('loai_giay', sa.String(20), nullable=True)
    )


def downgrade():
    op.drop_column('paper_materials', 'loai_giay')
