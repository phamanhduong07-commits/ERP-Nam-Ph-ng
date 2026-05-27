"""add sales_invoice_id to hoa_don_dien_tu

Revision ID: hdt002
Revises: hdt001
Create Date: 2026-05-25 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'hdt002'
down_revision: Union[str, None] = 'hdt001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'hoa_don_dien_tu',
        sa.Column('sales_invoice_id', sa.Integer(), sa.ForeignKey('sales_invoices.id'), nullable=True),
    )
    op.create_index('ix_hoa_don_dien_tu_sales_invoice_id', 'hoa_don_dien_tu', ['sales_invoice_id'])


def downgrade() -> None:
    op.drop_index('ix_hoa_don_dien_tu_sales_invoice_id', 'hoa_don_dien_tu')
    op.drop_column('hoa_don_dien_tu', 'sales_invoice_id')
