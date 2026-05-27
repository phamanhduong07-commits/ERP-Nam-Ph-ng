"""merge_heads

Revision ID: f7630db419be
Revises: cashbank001, debtrec001, role001
Create Date: 2026-05-26 13:34:32.939139

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7630db419be'
down_revision: Union[str, None] = ('cashbank001', 'debtrec001', 'role001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
