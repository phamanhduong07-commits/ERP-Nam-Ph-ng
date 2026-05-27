"""add ocr_extracted_data to goods_receipts for AI image reading

Revision ID: ocr001
Revises: gr002
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'ocr001'
down_revision = 'gr002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('goods_receipts') as batch_op:
        batch_op.add_column(sa.Column('ocr_extracted_data', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('goods_receipts') as batch_op:
        batch_op.drop_column('ocr_extracted_data')
