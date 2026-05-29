"""add tan_dung to production_orders, sl_tam to production_order_items

Revision ID: td001
Revises: ppo001
Create Date: 2026-05-29
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "td001"
down_revision: Union[str, None] = "ppo001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE production_orders "
        "ADD COLUMN IF NOT EXISTS tan_dung BOOLEAN NOT NULL DEFAULT false"
    )
    op.execute(
        "ALTER TABLE production_order_items "
        "ADD COLUMN IF NOT EXISTS sl_tam INTEGER"
    )


def downgrade() -> None:
    op.drop_column("production_orders", "tan_dung")
    op.drop_column("production_order_items", "sl_tam")
