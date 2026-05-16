"""Merge heads

Revision ID: 859ce463ead7
Revises: bb2cc3dd4ee5, h1r2s3t4u5v8
Create Date: 2026-05-15 19:40:55.807274

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '859ce463ead7'
down_revision: Union[str, None] = ('bb2cc3dd4ee5', 'h1r2s3t4u5v8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
