"""add nhom_san_pham and offset/tem fields to quote_items

Revision ID: zmh006
Revises: zmh005
Create Date: 2026-05-29
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'zmh006'
down_revision: Union[str, None] = 'zmh005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quote_items', sa.Column('nhom_san_pham', sa.String(20), nullable=True))
    op.add_column('quote_items', sa.Column('co_tem_offset', sa.Boolean(), nullable=False, server_default='false'))

    # Thông số giấy in
    op.add_column('quote_items', sa.Column('tem_loai_giay', sa.String(30), nullable=True))
    op.add_column('quote_items', sa.Column('tem_gsm', sa.Numeric(8, 2), nullable=True))
    op.add_column('quote_items', sa.Column('tem_don_gia_kg', sa.Numeric(18, 4), nullable=True))

    # Kích thước tờ in
    op.add_column('quote_items', sa.Column('tem_dai_to', sa.Numeric(8, 2), nullable=True))
    op.add_column('quote_items', sa.Column('tem_rong_to', sa.Numeric(8, 2), nullable=True))
    op.add_column('quote_items', sa.Column('tem_sp_per_to', sa.SmallInteger(), nullable=False, server_default='2'))
    op.add_column('quote_items', sa.Column('tem_waste_to', sa.SmallInteger(), nullable=False, server_default='150'))

    # In ấn offset
    op.add_column('quote_items', sa.Column('tem_so_mau', sa.SmallInteger(), nullable=False, server_default='0'))
    op.add_column('quote_items', sa.Column('tem_gia_kem_mau', sa.Numeric(18, 4), nullable=True))
    op.add_column('quote_items', sa.Column('tem_gia_in_1000to', sa.Numeric(18, 4), nullable=True))

    # Cán màng
    op.add_column('quote_items', sa.Column('tem_co_can_mang', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('quote_items', sa.Column('tem_gia_can_mang_m2', sa.Numeric(18, 4), nullable=True))

    # Khuôn bế
    op.add_column('quote_items', sa.Column('tem_co_khuon_be', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('quote_items', sa.Column('tem_gia_khuon_be', sa.Numeric(18, 4), nullable=True))
    op.add_column('quote_items', sa.Column('tem_khuon_be_phan_bo', sa.Integer(), nullable=False, server_default='10000'))


def downgrade() -> None:
    for col in [
        'tem_khuon_be_phan_bo', 'tem_gia_khuon_be', 'tem_co_khuon_be',
        'tem_gia_can_mang_m2', 'tem_co_can_mang',
        'tem_gia_in_1000to', 'tem_gia_kem_mau', 'tem_so_mau',
        'tem_waste_to', 'tem_sp_per_to', 'tem_rong_to', 'tem_dai_to',
        'tem_don_gia_kg', 'tem_gsm', 'tem_loai_giay',
        'co_tem_offset', 'nhom_san_pham',
    ]:
        op.drop_column('quote_items', col)
