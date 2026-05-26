"""add_ocr_to_delivery_orders

Revision ID: del003
Revises: ocr002
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'del003'
down_revision = 'ocr002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('delivery_orders',
        sa.Column('ocr_extracted_data', sa.Text(), nullable=True)
    )


def downgrade():
    op.drop_column('delivery_orders', 'ocr_extracted_data')
