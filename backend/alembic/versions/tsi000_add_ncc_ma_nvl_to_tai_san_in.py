"""tsi000 add supplier_id and other_material_id to tai_san_in

Revision ID: tsi000
Revises: a18622fac251
Create Date: 2026-06-30

"""
from alembic import op
import sqlalchemy as sa

revision = 'tsi000'
down_revision = 'a18622fac251'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tai_san_in', sa.Column(
        'supplier_id', sa.Integer(),
        sa.ForeignKey('suppliers.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('tai_san_in', sa.Column(
        'other_material_id', sa.Integer(),
        sa.ForeignKey('other_materials.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_tai_san_in_supplier_id', 'tai_san_in', ['supplier_id'])


def downgrade():
    op.drop_index('ix_tai_san_in_supplier_id', table_name='tai_san_in')
    op.drop_column('tai_san_in', 'other_material_id')
    op.drop_column('tai_san_in', 'supplier_id')
