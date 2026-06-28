"""merge_heads

Revision ID: 8bd5097644f7
Revises: cd3b9064650c, zmh049
Create Date: 2026-06-28 16:18:31.764883

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8bd5097644f7'
down_revision: Union[str, None] = ('cd3b9064650c', 'zmh049')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
