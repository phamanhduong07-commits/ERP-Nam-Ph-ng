"""add so_lan_cat to production_order_items

Revision ID: zmh002
Revises: z1a2b3c4d5e6
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'zmh002'
down_revision: Union[str, None] = 'z1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('production_order_items',
        sa.Column('so_lan_cat', sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('production_order_items', 'so_lan_cat')
