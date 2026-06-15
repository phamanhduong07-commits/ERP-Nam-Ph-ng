"""Add NCC + paper TC fields to tieu_chuan_ky_thuat

Revision ID: zmh026
Revises: zmh025
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh026'
down_revision = 'zmh025'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tieu_chuan_ky_thuat', sa.Column('ncc_id', sa.Integer(), sa.ForeignKey('suppliers.id', ondelete='SET NULL'), nullable=True))
    op.add_column('tieu_chuan_ky_thuat', sa.Column('loai_giay', sa.String(20), nullable=True))
    op.add_column('tieu_chuan_ky_thuat', sa.Column('tc_sai_so_pct', sa.Numeric(5, 2), nullable=True))
    op.add_column('tieu_chuan_ky_thuat', sa.Column('tc_do_buc', sa.Numeric(8, 2), nullable=True))
    op.add_column('tieu_chuan_ky_thuat', sa.Column('tc_do_nen_vong', sa.Numeric(8, 2), nullable=True))


def downgrade():
    op.drop_column('tieu_chuan_ky_thuat', 'tc_do_nen_vong')
    op.drop_column('tieu_chuan_ky_thuat', 'tc_do_buc')
    op.drop_column('tieu_chuan_ky_thuat', 'tc_sai_so_pct')
    op.drop_column('tieu_chuan_ky_thuat', 'loai_giay')
    op.drop_column('tieu_chuan_ky_thuat', 'ncc_id')
