"""create tem_paper_prices table

Revision ID: zmh007
Revises: zmh006
Create Date: 2026-05-29
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'zmh007'
down_revision: Union[str, None] = 'zmh006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tem_paper_prices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('loai_giay', sa.String(30), nullable=False),
        sa.Column('ten', sa.String(100), nullable=False),
        sa.Column('gsm', sa.Numeric(8, 2), nullable=True),
        sa.Column('don_gia_kg', sa.Numeric(18, 4), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
    )
    op.create_index('ix_tem_paper_prices_loai_gsm', 'tem_paper_prices', ['loai_giay', 'gsm'])


def downgrade() -> None:
    op.drop_index('ix_tem_paper_prices_loai_gsm', 'tem_paper_prices')
    op.drop_table('tem_paper_prices')
