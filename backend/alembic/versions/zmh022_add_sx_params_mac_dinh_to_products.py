"""add sx_params_mac_dinh to products

Revision ID: zmh022
Revises: zmh021
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh022'
down_revision = 'zmh021'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE products "
        "ADD COLUMN IF NOT EXISTS sx_params_mac_dinh JSONB"
    )


def downgrade() -> None:
    op.drop_column('products', 'sx_params_mac_dinh')
