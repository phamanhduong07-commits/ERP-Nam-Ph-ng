"""add phoi_du_so_luong to phieu_nhap_phoi_song

Revision ID: pd001_add_phoi_du_so_luong
Revises:
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'pd001_add_phoi_du_so_luong'
down_revision = 'ms002_perf_idx'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'phieu_nhap_phoi_song',
        sa.Column('phoi_du_so_luong', sa.Numeric(12, 3), nullable=True),
    )


def downgrade():
    op.drop_column('phieu_nhap_phoi_song', 'phoi_du_so_luong')
