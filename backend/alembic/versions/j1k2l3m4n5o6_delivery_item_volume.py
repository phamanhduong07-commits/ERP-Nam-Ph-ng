"""Add delivery item volume

Revision ID: j1k2l3m4n5o6
Revises: i1j2k3l4m5n6
Create Date: 2026-05-05
"""
from alembic import op
import sqlalchemy as sa

revision = "j1k2l3m4n5o6"
down_revision = "i1j2k3l4m5n6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "delivery_order_items",
        sa.Column("the_tich", sa.Numeric(12, 4), nullable=True),
    )


def downgrade():
    op.drop_column("delivery_order_items", "the_tich")
