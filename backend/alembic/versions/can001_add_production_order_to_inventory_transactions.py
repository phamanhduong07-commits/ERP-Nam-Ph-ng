"""add production_order_id to inventory_transactions

Revision ID: can001
Revises: zmh023
Create Date: 2026-06-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "can001"
down_revision: Union[str, None] = "zmh023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inventory_transactions",
        sa.Column("production_order_id", sa.Integer(),
                  sa.ForeignKey("production_orders.id", ondelete="SET NULL"),
                  nullable=True),
    )
    op.create_index(
        "ix_inventory_transactions_production_order_id",
        "inventory_transactions",
        ["production_order_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_inventory_transactions_production_order_id", "inventory_transactions")
    op.drop_column("inventory_transactions", "production_order_id")
