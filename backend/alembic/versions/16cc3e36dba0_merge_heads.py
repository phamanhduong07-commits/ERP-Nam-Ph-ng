"""merge_heads

Revision ID: 16cc3e36dba0
Revises: 061de93d4bd0, qv003
Create Date: 2026-06-29 20:31:20.267652

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '16cc3e36dba0'
down_revision: Union[str, None] = ('061de93d4bd0', 'qv003')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
