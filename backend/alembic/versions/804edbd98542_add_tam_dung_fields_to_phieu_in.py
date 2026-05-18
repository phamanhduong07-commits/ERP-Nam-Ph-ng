"""add tam_dung fields to phieu_in

Revision ID: 804edbd98542
Revises: idx001_add_missing_hot_indexes
Create Date: 2026-05-18 08:24:32.113630

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '804edbd98542'
down_revision: Union[str, None] = 'idx001_add_missing_hot_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('phieu_in', sa.Column('tam_dung_luc', sa.DateTime(timezone=True), nullable=True))
    op.add_column('phieu_in', sa.Column('tam_dung_ly_do', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('phieu_in', 'tam_dung_ly_do')
    op.drop_column('phieu_in', 'tam_dung_luc')
