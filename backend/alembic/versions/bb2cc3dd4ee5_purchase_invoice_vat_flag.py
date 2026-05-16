"""purchase invoice VAT flag

Revision ID: bb2cc3dd4ee5
Revises: aa1bb2cc3dd4
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "bb2cc3dd4ee5"
down_revision = "aa1bb2cc3dd4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_invoices",
        sa.Column("co_vat", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("purchase_invoices", "co_vat")
