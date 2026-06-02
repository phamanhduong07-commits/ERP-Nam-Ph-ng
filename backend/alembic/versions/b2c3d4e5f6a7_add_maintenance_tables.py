"""add maintenance tables (machines, schedules, logs)

Revision ID: maint001
Revises: qc001
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'maint001'
down_revision = 'qc001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'machines_maintenance',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ma_may', sa.String(50), unique=True, nullable=False),
        sa.Column('ten_may', sa.String(200), nullable=False),
        sa.Column('hang_sx', sa.String(100), nullable=True),
        sa.Column('nam_sx', sa.Integer(), nullable=True),
        sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True),
        sa.Column('trang_thai', sa.String(20), server_default='dang_dung'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        'maintenance_schedules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('machine_id', sa.Integer(), sa.ForeignKey('machines_maintenance.id', ondelete='CASCADE'), nullable=False),
        sa.Column('loai_bao_tri', sa.String(100), nullable=False),
        sa.Column('chu_ky_ngay', sa.Integer(), nullable=False),
        sa.Column('ngay_bao_tri_gan_nhat', sa.Date(), nullable=True),
        sa.Column('ngay_bao_tri_tiep_theo', sa.Date(), nullable=True),
        sa.Column('trang_thai', sa.String(20), server_default='dung_han'),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        'maintenance_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('machine_id', sa.Integer(), sa.ForeignKey('machines_maintenance.id', ondelete='CASCADE'), nullable=False),
        sa.Column('schedule_id', sa.Integer(), sa.ForeignKey('maintenance_schedules.id', ondelete='SET NULL'), nullable=True),
        sa.Column('loai', sa.String(20), nullable=False),
        sa.Column('ngay_bat_dau', sa.Date(), nullable=False),
        sa.Column('ngay_ket_thuc', sa.Date(), nullable=True),
        sa.Column('downtime_phut', sa.Integer(), server_default='0'),
        sa.Column('mo_ta_su_co', sa.Text(), nullable=True),
        sa.Column('bien_phap_xu_ly', sa.Text(), nullable=True),
        sa.Column('chi_phi_vat_tu', sa.Numeric(18, 2), server_default='0'),
        sa.Column('chi_phi_nhan_cong', sa.Numeric(18, 2), server_default='0'),
        sa.Column('tong_chi_phi', sa.Numeric(18, 2), server_default='0'),
        sa.Column('phieu_chi_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('maintenance_logs')
    op.drop_table('maintenance_schedules')
    op.drop_table('machines_maintenance')
