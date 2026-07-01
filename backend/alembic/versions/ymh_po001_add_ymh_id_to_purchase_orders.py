"""ymh_po001 add ymh_id to purchase_orders

Revision ID: ymh_po001
Revises: zmh053
Create Date: 2026-07-01

"""
from alembic import op
import sqlalchemy as sa

revision = 'ymh_po001'
down_revision = 'zmh053'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('purchase_orders', sa.Column(
        'ymh_id', sa.Integer(),
        sa.ForeignKey('purchase_requisitions.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_po_ymh_id', 'purchase_orders', ['ymh_id'])


def downgrade():
    op.drop_index('ix_po_ymh_id', table_name='purchase_orders')
    op.drop_column('purchase_orders', 'ymh_id')
