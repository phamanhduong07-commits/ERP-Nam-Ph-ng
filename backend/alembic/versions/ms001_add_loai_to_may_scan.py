"""add loai to may_scan

Revision ID: ms001_add_loai_to_may_scan
Revises: e966463514b4
Create Date: 2026-05-19

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'ms001_add_loai_to_may_scan'
down_revision: Union[str, None] = 'e966463514b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('may_scan', sa.Column('loai', sa.String(50), nullable=False, server_default='khac'))


def downgrade() -> None:
    op.drop_column('may_scan', 'loai')
