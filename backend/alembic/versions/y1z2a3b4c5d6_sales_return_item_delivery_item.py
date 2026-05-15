"""sales_return_item_delivery_item

Revision ID: y1z2a3b4c5d6
Revises: x1y2z3a4b5c6
Create Date: 2026-05-12 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "y1z2a3b4c5d6"
down_revision: Union[str, None] = "x1y2z3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sales_return_items",
        sa.Column("delivery_order_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_sales_return_items_delivery_order_item_id",
        "sales_return_items",
        "delivery_order_items",
        ["delivery_order_item_id"],
        ["id"],
    )
    op.create_index(
        "ix_sales_return_items_delivery_order_item_id",
        "sales_return_items",
        ["delivery_order_item_id"],
    )

    op.execute(
        """
        UPDATE sales_return_items sri
        SET delivery_order_item_id = doi.id
        FROM sales_returns sr, delivery_order_items doi
        WHERE sri.sales_return_id = sr.id
          AND sri.delivery_order_item_id IS NULL
          AND sr.delivery_order_id IS NOT NULL
          AND doi.delivery_id = sr.delivery_order_id
          AND doi.sales_order_item_id = sri.sales_order_item_id
          AND NOT EXISTS (
              SELECT 1
              FROM delivery_order_items doi2
              WHERE doi2.delivery_id = sr.delivery_order_id
                AND doi2.sales_order_item_id = sri.sales_order_item_id
                AND doi2.id <> doi.id
          )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_sales_return_items_delivery_order_item_id", table_name="sales_return_items")
    op.drop_constraint(
        "fk_sales_return_items_delivery_order_item_id",
        "sales_return_items",
        type_="foreignkey",
    )
    op.drop_column("sales_return_items", "delivery_order_item_id")
