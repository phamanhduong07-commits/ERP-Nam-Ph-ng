"""add loai_be kho_sx dai_sx to quote_items

Revision ID: zmh005
Revises: zmh004
Create Date: 2026-05-29
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'zmh005'
down_revision: Union[str, None] = 'zmh004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quote_items',
        sa.Column('loai_be', sa.String(30), nullable=True))
    op.add_column('quote_items',
        sa.Column('kho_sx', sa.Numeric(8, 2), nullable=True))
    op.add_column('quote_items',
        sa.Column('dai_sx', sa.Numeric(8, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('quote_items', 'loai_be')
    op.drop_column('quote_items', 'kho_sx')
    op.drop_column('quote_items', 'dai_sx')
