"""tsi001 add tai_san_in_id to purchase_requisition_items

Revision ID: tsi001
Revises: tsi000
Create Date: 2026-06-30

"""
from alembic import op
import sqlalchemy as sa

revision = 'tsi001'
down_revision = 'tsi000'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('purchase_requisition_items', sa.Column(
        'tai_san_in_id', sa.Integer(),
        sa.ForeignKey('tai_san_in.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_pri_tai_san_in_id', 'purchase_requisition_items', ['tai_san_in_id'])


def downgrade():
    op.drop_index('ix_pri_tai_san_in_id', table_name='purchase_requisition_items')
    op.drop_column('purchase_requisition_items', 'tai_san_in_id')
