"""add_ocr_supplier_examples

Revision ID: ocr002
Revises: ocr001
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'ocr002'
down_revision = 'ocr001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ocr_supplier_examples',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ten_ncc', sa.String(255), nullable=False),
        sa.Column('ten_ncc_chuan', sa.String(255), nullable=False),
        sa.Column('img_path', sa.String(500), nullable=False),
        sa.Column('extracted_json', sa.Text(), nullable=False),
        sa.Column('ghi_chu', sa.String(255), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_ocr_supplier_examples_ten_ncc', 'ocr_supplier_examples', ['ten_ncc'])
    op.create_index('ix_ocr_supplier_examples_ten_ncc_chuan', 'ocr_supplier_examples', ['ten_ncc_chuan'])


def downgrade() -> None:
    op.drop_table('ocr_supplier_examples')
