"""merge ib004 and pur_idx001 branches

Revision ID: merge001
Revises: ib004, pur_idx001
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = "merge001"
down_revision = ("ib004", "pur_idx001")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
