"""add ly_do_tu_choi to purchase_requisitions

Revision ID: ymh001_add_ly_do_tu_choi
Revises: del001
Create Date: 2026-05-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'ymh001_add_ly_do_tu_choi'
down_revision: Union[str, None] = 'dnb001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'purchase_requisitions',
        sa.Column('ly_do_tu_choi', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('purchase_requisitions', 'ly_do_tu_choi')
