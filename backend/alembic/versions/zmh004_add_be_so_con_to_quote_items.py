"""add be_so_con to quote_items

Revision ID: zmh004
Revises: zmh003
Create Date: 2026-05-28
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'zmh004'
down_revision: Union[str, None] = 'zmh003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quote_items',
        sa.Column('be_so_con', sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('quote_items', 'be_so_con')
