"""add sai_so_pct to paper_materials

Revision ID: zmh011
Revises: zmh010
Create Date: 2026-06-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh011'
down_revision = 'zmh010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'paper_materials',
        sa.Column('sai_so_pct', sa.Numeric(5, 2), nullable=True, comment='% tolerance QC định lượng (vd: 5.00 = ±5%)')
    )


def downgrade() -> None:
    op.drop_column('paper_materials', 'sai_so_pct')
