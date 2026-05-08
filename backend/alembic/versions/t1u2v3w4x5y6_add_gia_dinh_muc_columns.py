"""add gia_dinh_muc to paper_materials, other_materials, products

Revision ID: t1u2v3w4x5y6
Revises: s1t2u3v4w5x6
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = 't1u2v3w4x5y6'
down_revision = 's1t2u3v4w5x6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('paper_materials', sa.Column('gia_dinh_muc', sa.Numeric(18, 2), nullable=False, server_default='0'))
    op.add_column('other_materials', sa.Column('gia_dinh_muc', sa.Numeric(18, 2), nullable=False, server_default='0'))
    op.add_column('products', sa.Column('gia_dinh_muc', sa.Numeric(18, 2), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('products', 'gia_dinh_muc')
    op.drop_column('other_materials', 'gia_dinh_muc')
    op.drop_column('paper_materials', 'gia_dinh_muc')
