"""add offset_addon_prices table and uv/suppo/luoi fields to quote_items

Revision ID: zmh008
Revises: zmh007
Create Date: 2026-05-29
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'zmh008'
down_revision: Union[str, None] = 'zmh007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'offset_addon_prices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('loai_addon', sa.String(30), nullable=False),
        sa.Column('ten', sa.String(100), nullable=False),
        sa.Column('don_gia_m2', sa.Numeric(18, 4), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
    )
    op.create_index('ix_offset_addon_prices_loai', 'offset_addon_prices', ['loai_addon'])

    op.add_column('quote_items', sa.Column('tem_co_uv', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('quote_items', sa.Column('tem_gia_uv_m2', sa.Numeric(18, 4), nullable=True))
    op.add_column('quote_items', sa.Column('tem_co_suppo', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('quote_items', sa.Column('tem_gia_suppo_m2', sa.Numeric(18, 4), nullable=True))
    op.add_column('quote_items', sa.Column('tem_co_luoi', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('quote_items', sa.Column('tem_gia_luoi_m2', sa.Numeric(18, 4), nullable=True))


def downgrade() -> None:
    op.drop_column('quote_items', 'tem_gia_luoi_m2')
    op.drop_column('quote_items', 'tem_co_luoi')
    op.drop_column('quote_items', 'tem_gia_suppo_m2')
    op.drop_column('quote_items', 'tem_co_suppo')
    op.drop_column('quote_items', 'tem_gia_uv_m2')
    op.drop_column('quote_items', 'tem_co_uv')
    op.drop_index('ix_offset_addon_prices_loai', 'offset_addon_prices')
    op.drop_table('offset_addon_prices')
