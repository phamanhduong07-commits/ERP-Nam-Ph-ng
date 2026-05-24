"""add bo_qua_hach_toan to sales_orders

Revision ID: so001
Revises: ymh001_add_ly_do_tu_choi
Create Date: 2026-05-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'so001'
down_revision: Union[str, None] = 'ymh001_add_ly_do_tu_choi'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS bo_qua_hach_toan BOOLEAN NOT NULL DEFAULT false"
    )


def downgrade() -> None:
    op.drop_column('sales_orders', 'bo_qua_hach_toan')
