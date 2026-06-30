"""add production spec and offset tem fields to products

Revision ID: zmh050
Revises: so002
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh050'
down_revision = 'so002'
branch_labels = None
depends_on = None


def upgrade():
    # Đặc tính sản xuất
    op.add_column('products', sa.Column('to_hop_song',   sa.String(10),    nullable=True))
    op.add_column('products', sa.Column('loai_be',       sa.String(30),    nullable=True))
    op.add_column('products', sa.Column('be_hai_manh',   sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('co_be',         sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('be_lo',         sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('do_kho',        sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('do_phu',        sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('may_in',        sa.String(20),    nullable=True))
    op.add_column('products', sa.Column('ban_ve_kt',     sa.String(200),   nullable=True))
    op.add_column('products', sa.Column('nhom_san_pham', sa.String(50),    nullable=True))
    # Tem offset
    op.add_column('products', sa.Column('co_tem_offset',     sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_loai_giay',     sa.String(30),    nullable=True))
    op.add_column('products', sa.Column('tem_gsm',           sa.Numeric(6, 2), nullable=True))
    op.add_column('products', sa.Column('tem_dai_to',        sa.Numeric(8, 2), nullable=True))
    op.add_column('products', sa.Column('tem_rong_to',       sa.Numeric(8, 2), nullable=True))
    op.add_column('products', sa.Column('tem_sp_per_to',     sa.Integer(),     nullable=True, server_default='1'))
    op.add_column('products', sa.Column('tem_waste_to',      sa.Integer(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_so_mau',        sa.Integer(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_co_can_mang',   sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_co_khuon_be',   sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_co_uv',         sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_co_suppo',      sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_co_luoi',       sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_hai_manh',      sa.Boolean(),     nullable=True, server_default='0'))
    op.add_column('products', sa.Column('tem_khac_thiet_ke', sa.Boolean(),     nullable=True, server_default='0'))


def downgrade():
    for col in [
        'to_hop_song', 'loai_be', 'be_hai_manh', 'co_be', 'be_lo',
        'do_kho', 'do_phu', 'may_in', 'ban_ve_kt', 'nhom_san_pham',
        'co_tem_offset', 'tem_loai_giay', 'tem_gsm', 'tem_dai_to',
        'tem_rong_to', 'tem_sp_per_to', 'tem_waste_to', 'tem_so_mau',
        'tem_co_can_mang', 'tem_co_khuon_be', 'tem_co_uv', 'tem_co_suppo',
        'tem_co_luoi', 'tem_hai_manh', 'tem_khac_thiet_ke',
    ]:
        op.drop_column('products', col)
