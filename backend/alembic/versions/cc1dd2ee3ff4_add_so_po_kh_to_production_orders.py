"""add so_po_kh to production_orders

Revision ID: cc1dd2ee3ff4
Revises: d582a4fdbfc9
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "cc1dd2ee3ff4"
down_revision = "d582a4fdbfc9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "production_orders",
        sa.Column("so_po_kh", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("production_orders", "so_po_kh")
