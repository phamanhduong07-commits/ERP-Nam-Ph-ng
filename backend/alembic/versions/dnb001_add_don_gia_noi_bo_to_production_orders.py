"""ensure don_gia_noi_bo on production_orders and verify phieu_chuyen_kho accounting

Revision ID: dnb001
Revises: del001
Create Date: 2026-05-24

Context: don_gia_noi_bo was already added via a0b1c2d3e4f5 (IF NOT EXISTS).
This migration is a no-op DDL guard — confirms the column exists so Alembic
history is explicit. The real work is in warehouse.py: auto-populate don_gia
on PhieuChuyenKhoItem from LSX.don_gia_noi_bo when client sends 0/null.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "dnb001"
down_revision: Union[str, None] = "del001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent — column was added in a0b1c2d3e4f5 via IF NOT EXISTS.
    # Re-assert here so Alembic history reflects the field explicitly.
    op.execute(
        "ALTER TABLE production_orders "
        "ADD COLUMN IF NOT EXISTS don_gia_noi_bo NUMERIC(14,2)"
    )


def downgrade() -> None:
    # Do NOT drop — this column is actively used for hach_toan chuyen_kho.
    pass
