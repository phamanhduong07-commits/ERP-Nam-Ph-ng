"""add phieu_goc_id to production_orders (self-ref FK for lệnh bù)

Revision ID: zmh021
Revises: zmh020
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh021'
down_revision = 'zmh020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE production_orders "
        "ADD COLUMN IF NOT EXISTS phieu_goc_id INTEGER REFERENCES production_orders(id)"
    )


def downgrade() -> None:
    op.drop_column('production_orders', 'phieu_goc_id')
