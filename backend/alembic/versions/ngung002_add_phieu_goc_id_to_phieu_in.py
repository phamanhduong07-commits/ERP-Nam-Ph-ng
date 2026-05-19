"""add phieu_goc_id to phieu_in

Revision ID: ngung002_add_phieu_goc_id
Revises: 804edbd98542
Create Date: 2026-05-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'ngung002_add_phieu_goc_id'
down_revision: Union[str, None] = '804edbd98542'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('phieu_in', sa.Column('phieu_goc_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('phieu_in', 'phieu_goc_id')
