"""add so_po_kh to sales_orders

Revision ID: so001_sales_po
Revises: del001
Create Date: 2026-06-03

"""
from alembic import op
import sqlalchemy as sa

revision = "so001_sales_po"
down_revision = "del001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column("so_po_kh", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sales_orders", "so_po_kh")
