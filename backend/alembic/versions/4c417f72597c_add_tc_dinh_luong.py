"""add_tc_dinh_luong

Revision ID: 4c417f72597c
Revises: e7b4cdc2f98c
Create Date: 2026-06-14 23:37:32.919187

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '4c417f72597c'
down_revision: Union[str, None] = 'e7b4cdc2f98c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tieu_chuan_ky_thuat',
        sa.Column('tc_dinh_luong', sa.Numeric(8, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tieu_chuan_ky_thuat', 'tc_dinh_luong')
