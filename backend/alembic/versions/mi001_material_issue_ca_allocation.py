"""add ca and allocation_detail to material_issues

Revision ID: mi001
Revises: lac001
Create Date: 2026-06-07

"""
from alembic import op
import sqlalchemy as sa

revision = "mi001"
down_revision = "lac001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("material_issues", sa.Column("ca", sa.String(10), nullable=True))
    op.add_column("material_issue_items", sa.Column("allocation_detail", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("material_issues", "ca")
    op.drop_column("material_issue_items", "allocation_detail")
