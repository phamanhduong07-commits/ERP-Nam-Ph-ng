"""add be_so_con to production_order_items

Revision ID: zmh003
Revises: zmh002
Create Date: 2026-05-28
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'zmh003'
down_revision: Union[str, None] = 'zmh002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('production_order_items',
        sa.Column('be_so_con', sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('production_order_items', 'be_so_con')
