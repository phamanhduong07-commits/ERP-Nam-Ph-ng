"""add_ngan_hang_table

Revision ID: e7b4cdc2f98c
Revises: zmh027
Create Date: 2026-06-14 21:27:57.882464

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e7b4cdc2f98c'
down_revision: Union[str, None] = 'zmh027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ngan_hang',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ma_ngan_hang', sa.String(length=50), nullable=False),
        sa.Column('ten_day_du', sa.String(length=300), nullable=False),
        sa.Column('trang_thai', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ma_ngan_hang'),
    )


def downgrade() -> None:
    op.drop_table('ngan_hang')
