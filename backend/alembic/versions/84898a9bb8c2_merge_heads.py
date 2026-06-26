"""merge heads

Revision ID: 84898a9bb8c2
Revises: emp001, zmh047
Create Date: 2026-06-26 20:54:04.008493

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84898a9bb8c2'
down_revision: Union[str, None] = ('emp001', 'zmh047')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
