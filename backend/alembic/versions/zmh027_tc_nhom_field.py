"""Add nhom_id to tieu_chuan_ky_thuat

Revision ID: zmh027
Revises: zmh026
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh027'
down_revision = 'zmh026'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tieu_chuan_ky_thuat', sa.Column(
        'nhom_id', sa.Integer(),
        sa.ForeignKey('material_groups.id', ondelete='SET NULL'),
        nullable=True
    ))


def downgrade():
    op.drop_column('tieu_chuan_ky_thuat', 'nhom_id')
