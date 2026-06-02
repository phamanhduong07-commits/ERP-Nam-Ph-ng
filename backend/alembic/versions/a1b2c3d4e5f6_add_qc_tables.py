"""add qc_sheets and qc_defects tables

Revision ID: qc001
Revises: z1a2b3c4d5e6
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'qc001'
down_revision = 'z1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'qc_sheets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('so_phieu', sa.String(30), unique=True, nullable=False),
        sa.Column('loai', sa.String(20), nullable=False),
        sa.Column('ref_type', sa.String(50), nullable=True),
        sa.Column('ref_id', sa.Integer(), nullable=True),
        sa.Column('ngay', sa.Date(), nullable=False),
        sa.Column('nguoi_kiem_tra', sa.String(100), nullable=True),
        sa.Column('ket_qua', sa.String(20), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True),
        sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        'qc_defects',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('qc_sheet_id', sa.Integer(), sa.ForeignKey('qc_sheets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('loai_loi', sa.String(100), nullable=False),
        sa.Column('mo_ta', sa.Text(), nullable=True),
        sa.Column('so_luong_loi', sa.Integer(), default=0),
        sa.Column('hinh_anh_path', sa.String(500), nullable=True),
    )


def downgrade():
    op.drop_table('qc_defects')
    op.drop_table('qc_sheets')
