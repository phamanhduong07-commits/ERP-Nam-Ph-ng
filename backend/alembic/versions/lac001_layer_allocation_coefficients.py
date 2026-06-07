"""layer_allocation_coefficients

Revision ID: lac001
Revises:
Create Date: 2026-06-07

"""
from alembic import op
import sqlalchemy as sa

revision = "lac001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "layer_allocation_coefficients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("loai_lop", sa.String(10), nullable=False),
        sa.Column("flute_type", sa.String(5), nullable=True),
        sa.Column("he_so", sa.Numeric(8, 4), nullable=False, server_default="1.0"),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.UniqueConstraint("loai_lop", "flute_type", name="uq_lac_lop_flute"),
    )


def downgrade():
    op.drop_table("layer_allocation_coefficients")
