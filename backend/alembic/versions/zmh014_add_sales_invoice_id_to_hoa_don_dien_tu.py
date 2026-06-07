"""add sales_invoice_id to hoa_don_dien_tu

Revision ID: zmh014
Revises: zmh013
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh014'
down_revision = 'zmh013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('hoa_don_dien_tu', sa.Column(
        'sales_invoice_id', sa.Integer(),
        sa.ForeignKey('sales_invoices.id'),
        nullable=True,
    ))
    op.create_index('ix_hoa_don_dien_tu_sales_invoice_id', 'hoa_don_dien_tu', ['sales_invoice_id'])


def downgrade() -> None:
    op.drop_index('ix_hoa_don_dien_tu_sales_invoice_id', table_name='hoa_don_dien_tu')
    op.drop_column('hoa_don_dien_tu', 'sales_invoice_id')
