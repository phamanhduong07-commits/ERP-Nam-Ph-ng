"""add phoi_phan_xuong_id to production_orders (override per-LSX)

Revision ID: ppo001
Revises: zmh004
Create Date: 2026-05-29
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "ppo001"
down_revision: Union[str, None] = "zmh004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE production_orders "
        "ADD COLUMN IF NOT EXISTS phoi_phan_xuong_id INTEGER "
        "REFERENCES phan_xuong(id)"
    )


def downgrade() -> None:
    op.drop_column("production_orders", "phoi_phan_xuong_id")
