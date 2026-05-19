"""add depreciation_entries table for TSCĐ module

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    # fixed_assets table already exists (created in s1t2u3v4w5x6 migration)
    op.create_table(
        'depreciation_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('asset_id', sa.Integer(), sa.ForeignKey('fixed_assets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ky', sa.String(7), nullable=False),
        sa.Column('so_tien_kh', sa.Numeric(18, 2), nullable=False),
        sa.Column('gia_tri_da_kh_sau', sa.Numeric(18, 2), nullable=False),
        sa.Column('journal_entry_id', sa.Integer(), sa.ForeignKey('journal_entries.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('asset_id', 'ky', name='uq_depreciation_asset_ky'),
    )


def downgrade():
    op.drop_table('depreciation_entries')
