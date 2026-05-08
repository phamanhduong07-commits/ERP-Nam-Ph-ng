"""create workshop_payroll and fixed_assets tables

Revision ID: s1t2u3v4w5x6
Revises: r1s2t3u4v5w6
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 's1t2u3v4w5x6'
down_revision = 'r1s2t3u4v5w6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    insp = inspect(conn)
    existing_tables = set(insp.get_table_names())

    if 'workshop_payroll' not in existing_tables:
        op.create_table(
            'workshop_payroll',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('so_phieu', sa.String(30), unique=True, nullable=False),
            sa.Column('thang', sa.Date(), nullable=False),
            sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=False),
            sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True),
            sa.Column('tong_luong', sa.Numeric(18, 2), nullable=False, server_default='0'),
            sa.Column('tong_thuong', sa.Numeric(18, 2), nullable=False, server_default='0'),
            sa.Column('tong_bao_hiem', sa.Numeric(18, 2), nullable=False, server_default='0'),
            sa.Column('ghi_chu', sa.Text(), nullable=True),
            sa.Column('trang_thai', sa.String(20), nullable=False, server_default='nhap'),
            sa.Column('bo_qua_hach_toan', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('nguoi_duyet_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('ngay_duyet', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.text('NOW()')),
        )

    if 'fixed_assets' not in existing_tables:
        op.create_table(
            'fixed_assets',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('ma_ts', sa.String(50), unique=True, nullable=False),
            sa.Column('ten_ts', sa.String(255), nullable=False),
            sa.Column('ngay_mua', sa.Date(), nullable=False),
            sa.Column('nguyen_gia', sa.Numeric(18, 2), nullable=False),
            sa.Column('so_thang_khau_hao', sa.Integer(), nullable=False),
            sa.Column('da_khau_hao_thang', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('gia_tri_da_khau_hao', sa.Numeric(18, 2), nullable=False, server_default='0'),
            sa.Column('phan_xuong_id', sa.Integer(), sa.ForeignKey('phan_xuong.id'), nullable=True),
            sa.Column('phap_nhan_id', sa.Integer(), sa.ForeignKey('phap_nhan.id'), nullable=True),
            sa.Column('tk_nguyen_gia', sa.String(20), nullable=False, server_default='211'),
            sa.Column('tk_khau_hao', sa.String(20), nullable=False, server_default='214'),
            sa.Column('tk_chi_phi', sa.String(20), nullable=False, server_default='154'),
            sa.Column('trang_thai', sa.String(20), nullable=False, server_default='dang_su_dung'),
            sa.Column('bo_qua_hach_toan', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.text('NOW()')),
        )


def downgrade():
    conn = op.get_bind()
    insp = inspect(conn)
    existing_tables = set(insp.get_table_names())

    if 'fixed_assets' in existing_tables:
        op.drop_table('fixed_assets')

    if 'workshop_payroll' in existing_tables:
        op.drop_table('workshop_payroll')
