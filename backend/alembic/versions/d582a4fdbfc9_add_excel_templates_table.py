"""Add excel_templates table

Revision ID: d582a4fdbfc9
Revises: 859ce463ead7
Create Date: 2026-05-15 19:41:26.238212

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd582a4fdbfc9'
down_revision: Union[str, None] = '859ce463ead7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('excel_templates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ma_mau', sa.String(length=50), nullable=False),
    sa.Column('phap_nhan_id', sa.Integer(), nullable=True),
    sa.Column('ten_mau', sa.String(length=100), nullable=False),
    sa.Column('column_config', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('excel_templates')
