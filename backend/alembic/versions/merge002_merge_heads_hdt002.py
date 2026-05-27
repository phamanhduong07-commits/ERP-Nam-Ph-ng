"""merge heads including hdt002

Revision ID: merge002
Revises: c3d4e5f6a7b8, co001, hdt002, trip001
Create Date: 2026-05-25 00:00:00.000000
"""
from typing import Sequence, Union

revision: str = 'merge002'
down_revision: Union[str, None] = ('c3d4e5f6a7b8', 'co001', 'hdt002', 'trip001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
