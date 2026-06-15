"""add chi_tieu_list to tieu_chuan_ky_thuat and create qc_nvl_phieu

Revision ID: zmh025
Revises: zmh024
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh025'
down_revision = 'zmh024'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tieu_chuan_ky_thuat', sa.Column('chi_tieu_list', sa.JSON(), nullable=True))

    op.create_table(
        'qc_nvl_phieu',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_phieu', sa.String(40), nullable=False, unique=True),
        sa.Column('other_material_id', sa.Integer(), sa.ForeignKey('other_materials.id'), nullable=False),
        sa.Column('goods_receipt_id', sa.Integer(), sa.ForeignKey('goods_receipts.id'), nullable=True),
        sa.Column('ngay_kiem_tra', sa.Date(), nullable=False),
        sa.Column('nguoi_kiem_tra', sa.String(100), nullable=True),
        sa.Column('tieu_chuan_id', sa.Integer(), sa.ForeignKey('tieu_chuan_ky_thuat.id'), nullable=True),
        sa.Column('tc_snapshot_json', sa.JSON(), nullable=True),
        sa.Column('items_json', sa.JSON(), nullable=True),
        sa.Column('ket_qua', sa.String(20), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('qc_nvl_phieu')
    op.drop_column('tieu_chuan_ky_thuat', 'chi_tieu_list')
