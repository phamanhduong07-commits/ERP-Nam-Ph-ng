"""add internal_transfers table

Revision ID: zmh029
Revises: kuv001
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh029'
down_revision = 'kuv001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'internal_transfers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_phieu', sa.String(length=30), nullable=False),
        sa.Column('ngay_phieu', sa.Date(), nullable=False),
        sa.Column('tu_phap_nhan_id', sa.Integer(), nullable=True),
        sa.Column('den_phap_nhan_id', sa.Integer(), nullable=True),
        sa.Column('tu_tai_khoan', sa.String(length=100), nullable=True),
        sa.Column('den_tai_khoan', sa.String(length=100), nullable=True),
        sa.Column('so_tien', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('hinh_thuc_tt', sa.String(length=20), nullable=True),
        sa.Column('so_tham_chieu', sa.String(length=100), nullable=True),
        sa.Column('dien_giai', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.String(length=20), nullable=True),
        sa.Column('tk_no', sa.String(length=20), nullable=True),
        sa.Column('tk_co', sa.String(length=20), nullable=True),
        sa.Column('nguoi_duyet_id', sa.Integer(), nullable=True),
        sa.Column('ngay_duyet', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tu_phap_nhan_id'], ['phap_nhan.id']),
        sa.ForeignKeyConstraint(['den_phap_nhan_id'], ['phap_nhan.id']),
        sa.ForeignKeyConstraint(['nguoi_duyet_id'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('so_phieu'),
    )
    op.create_index('ix_internal_transfers_ngay_phieu', 'internal_transfers', ['ngay_phieu'])
    op.create_index('ix_internal_transfers_trang_thai', 'internal_transfers', ['trang_thai'])
    op.create_index('ix_internal_transfers_tu_phap_nhan_id', 'internal_transfers', ['tu_phap_nhan_id'])
    op.create_index('ix_internal_transfers_den_phap_nhan_id', 'internal_transfers', ['den_phap_nhan_id'])


def downgrade() -> None:
    op.drop_index('ix_internal_transfers_den_phap_nhan_id', table_name='internal_transfers')
    op.drop_index('ix_internal_transfers_tu_phap_nhan_id', table_name='internal_transfers')
    op.drop_index('ix_internal_transfers_trang_thai', table_name='internal_transfers')
    op.drop_index('ix_internal_transfers_ngay_phieu', table_name='internal_transfers')
    op.drop_table('internal_transfers')
