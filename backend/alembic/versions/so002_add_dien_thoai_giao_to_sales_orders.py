"""add dien_thoai_giao to sales_orders

Revision ID: so002
Revises: 174b5ce65449
Create Date: 2026-06-30

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'so002'
down_revision: Union[str, None] = '174b5ce65449'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS dien_thoai_giao VARCHAR(50)"
    )


def downgrade() -> None:
    op.drop_column('sales_orders', 'dien_thoai_giao')
