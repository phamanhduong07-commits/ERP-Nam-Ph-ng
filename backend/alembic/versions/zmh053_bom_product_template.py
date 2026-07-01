"""add product_id and la_mau_san_pham to production_boms

Revision ID: zmh053
Revises: zmh052
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh053'
down_revision = 'tsi001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('production_boms',
        sa.Column('product_id', sa.Integer(),
                  sa.ForeignKey('products.id', ondelete='SET NULL'),
                  nullable=True))

    op.add_column('production_boms',
        sa.Column('la_mau_san_pham', sa.Boolean(),
                  nullable=False, server_default='false'))

    op.create_index('ix_production_boms_product_template',
        'production_boms', ['product_id', 'la_mau_san_pham'])


def downgrade():
    op.drop_index('ix_production_boms_product_template', table_name='production_boms')
    op.drop_column('production_boms', 'la_mau_san_pham')
    op.drop_column('production_boms', 'product_id')
