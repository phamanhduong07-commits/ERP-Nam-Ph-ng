"""add_loai_tien

Revision ID: 51ae592a207f
Revises: c3d4be76b4ff
Create Date: 2026-06-09 22:15:42.300887

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '51ae592a207f'
down_revision: Union[str, None] = 'c3d4be76b4ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('loai_tien',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_loai_tien', sa.String(length=10), nullable=False),
        sa.Column('ten_loai_tien', sa.String(length=100), nullable=False),
        sa.Column('ty_gia', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('ty_gia_mua', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('ty_gia_ban', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('la_mac_dinh', sa.Boolean(), nullable=False),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_loai_tien'),
    )


def downgrade() -> None:
    op.drop_table('loai_tien')
