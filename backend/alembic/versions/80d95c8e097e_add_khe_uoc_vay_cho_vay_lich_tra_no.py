"""add_khe_uoc_vay_cho_vay_lich_tra_no

Revision ID: 80d95c8e097e
Revises: ed927c473f2c
Create Date: 2026-06-15 20:33:15.146370

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '80d95c8e097e'
down_revision: Union[str, None] = 'ed927c473f2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('lich_tra_no',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('loai_khe_uoc', sa.String(length=10), nullable=False),
        sa.Column('khe_uoc_id', sa.Integer(), nullable=False),
        sa.Column('ky_so', sa.Integer(), nullable=False),
        sa.Column('ngay_den_han', sa.Date(), nullable=False),
        sa.Column('so_tien_goc', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('so_tien_lai', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('tong_cong', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('trang_thai', sa.String(length=20), nullable=False),
        sa.Column('ngay_tra_thuc', sa.Date(), nullable=True),
        sa.Column('so_tien_tra_thuc', sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lich_tra_no_khe_uoc_id'), 'lich_tra_no', ['khe_uoc_id'], unique=False)
    op.create_index(op.f('ix_lich_tra_no_loai_khe_uoc'), 'lich_tra_no', ['loai_khe_uoc'], unique=False)
    op.create_index(op.f('ix_lich_tra_no_ngay_den_han'), 'lich_tra_no', ['ngay_den_han'], unique=False)
    op.create_index(op.f('ix_lich_tra_no_trang_thai'), 'lich_tra_no', ['trang_thai'], unique=False)

    op.create_table('khe_uoc_vay',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_khe_uoc', sa.String(length=30), nullable=False),
        sa.Column('ngay_ky', sa.Date(), nullable=False),
        sa.Column('ngay_hieu_luc', sa.Date(), nullable=False),
        sa.Column('ngay_ket_thuc', sa.Date(), nullable=False),
        sa.Column('to_chuc_cho_vay', sa.String(length=200), nullable=False),
        sa.Column('so_tien_vay', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('lai_suat', sa.Numeric(precision=8, scale=4), nullable=False),
        sa.Column('ky_tinh_lai', sa.String(length=10), nullable=False),
        sa.Column('phuong_thuc_tra', sa.String(length=20), nullable=False),
        sa.Column('tai_khoan_nhan', sa.String(length=20), nullable=True),
        sa.Column('tai_san_the_chap', sa.Text(), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.String(length=20), nullable=False),
        sa.Column('phap_nhan_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['phap_nhan_id'], ['phap_nhan.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_khe_uoc_vay_phap_nhan_id'), 'khe_uoc_vay', ['phap_nhan_id'], unique=False)
    op.create_index(op.f('ix_khe_uoc_vay_so_khe_uoc'), 'khe_uoc_vay', ['so_khe_uoc'], unique=True)
    op.create_index(op.f('ix_khe_uoc_vay_trang_thai'), 'khe_uoc_vay', ['trang_thai'], unique=False)

    op.create_table('khe_uoc_cho_vay',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_khe_uoc', sa.String(length=30), nullable=False),
        sa.Column('ngay_ky', sa.Date(), nullable=False),
        sa.Column('ngay_hieu_luc', sa.Date(), nullable=False),
        sa.Column('ngay_ket_thuc', sa.Date(), nullable=False),
        sa.Column('to_chuc_di_vay', sa.String(length=200), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('so_tien_cho_vay', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('lai_suat', sa.Numeric(precision=8, scale=4), nullable=False),
        sa.Column('ky_tinh_lai', sa.String(length=10), nullable=False),
        sa.Column('phuong_thuc_tra', sa.String(length=20), nullable=False),
        sa.Column('tai_san_the_chap', sa.Text(), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('trang_thai', sa.String(length=20), nullable=False),
        sa.Column('phap_nhan_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
        sa.ForeignKeyConstraint(['phap_nhan_id'], ['phap_nhan.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_khe_uoc_cho_vay_customer_id'), 'khe_uoc_cho_vay', ['customer_id'], unique=False)
    op.create_index(op.f('ix_khe_uoc_cho_vay_phap_nhan_id'), 'khe_uoc_cho_vay', ['phap_nhan_id'], unique=False)
    op.create_index(op.f('ix_khe_uoc_cho_vay_so_khe_uoc'), 'khe_uoc_cho_vay', ['so_khe_uoc'], unique=True)
    op.create_index(op.f('ix_khe_uoc_cho_vay_trang_thai'), 'khe_uoc_cho_vay', ['trang_thai'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_khe_uoc_cho_vay_trang_thai'), table_name='khe_uoc_cho_vay')
    op.drop_index(op.f('ix_khe_uoc_cho_vay_so_khe_uoc'), table_name='khe_uoc_cho_vay')
    op.drop_index(op.f('ix_khe_uoc_cho_vay_phap_nhan_id'), table_name='khe_uoc_cho_vay')
    op.drop_index(op.f('ix_khe_uoc_cho_vay_customer_id'), table_name='khe_uoc_cho_vay')
    op.drop_table('khe_uoc_cho_vay')

    op.drop_index(op.f('ix_khe_uoc_vay_trang_thai'), table_name='khe_uoc_vay')
    op.drop_index(op.f('ix_khe_uoc_vay_so_khe_uoc'), table_name='khe_uoc_vay')
    op.drop_index(op.f('ix_khe_uoc_vay_phap_nhan_id'), table_name='khe_uoc_vay')
    op.drop_table('khe_uoc_vay')

    op.drop_index(op.f('ix_lich_tra_no_trang_thai'), table_name='lich_tra_no')
    op.drop_index(op.f('ix_lich_tra_no_ngay_den_han'), table_name='lich_tra_no')
    op.drop_index(op.f('ix_lich_tra_no_loai_khe_uoc'), table_name='lich_tra_no')
    op.drop_index(op.f('ix_lich_tra_no_khe_uoc_id'), table_name='lich_tra_no')
    op.drop_table('lich_tra_no')
