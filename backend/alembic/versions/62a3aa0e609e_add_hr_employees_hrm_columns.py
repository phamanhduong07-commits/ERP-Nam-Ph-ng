"""add hr_employees HRM columns (extended employee profile fields)

Revision ID: 62a3aa0e609e
Revises: 89c20c22d5b9
Create Date: 2026-06-12

Adds all new columns introduced by the HRM branch to hr_employees.
New HR tables (hr_teams, hr_family_relations, hr_checkin_locations, etc.)
were created directly via create_all() — this migration only handles
the column additions to the pre-existing hr_employees table.
"""
from alembic import op
import sqlalchemy as sa


revision = '62a3aa0e609e'
down_revision = '89c20c22d5b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Personal name breakdown
    op.add_column('hr_employees', sa.Column('ho_dem', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('ten', sa.String(50), nullable=True))
    op.add_column('hr_employees', sa.Column('ten_bi_danh', sa.String(100), nullable=True))

    # Demographics
    op.add_column('hr_employees', sa.Column('quoc_tich', sa.String(50), nullable=True))
    op.add_column('hr_employees', sa.Column('dan_toc', sa.String(50), nullable=True))
    op.add_column('hr_employees', sa.Column('ton_giao', sa.String(50), nullable=True))

    # Birthplace
    op.add_column('hr_employees', sa.Column('noi_sinh_tinh', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('noi_sinh_dia_chi', sa.Text(), nullable=True))

    # Hometown (que quan — detailed)
    op.add_column('hr_employees', sa.Column('tinh_que_quan', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('huyen_que_quan', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('phuong_que_quan', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('dia_chi_que_quan', sa.Text(), nullable=True))

    # Household registration (ho khau — detailed)
    op.add_column('hr_employees', sa.Column('tinh_ho_khau', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('huyen_ho_khau', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('phuong_ho_khau', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('dia_chi_ho_khau', sa.Text(), nullable=True))

    # Current address and contact
    op.add_column('hr_employees', sa.Column('dia_chi_hien_tai', sa.Text(), nullable=True))
    op.add_column('hr_employees', sa.Column('dien_thoai_ban', sa.String(20), nullable=True))

    # Profile
    op.add_column('hr_employees', sa.Column('avatar_url', sa.String(500), nullable=True))

    # Education
    op.add_column('hr_employees', sa.Column('trinh_do_hoc_van', sa.String(100), nullable=True))
    op.add_column('hr_employees', sa.Column('chuyen_nganh', sa.String(150), nullable=True))
    op.add_column('hr_employees', sa.Column('truong_dao_tao', sa.String(255), nullable=True))
    op.add_column('hr_employees', sa.Column('nam_tot_nghiep', sa.Integer(), nullable=True))
    op.add_column('hr_employees', sa.Column('ngoai_ngu', sa.String(150), nullable=True))
    op.add_column('hr_employees', sa.Column('tin_hoc', sa.String(150), nullable=True))
    op.add_column('hr_employees', sa.Column('ky_nang_khac', sa.Text(), nullable=True))
    op.add_column('hr_employees', sa.Column('so_yeu_tom_tat', sa.Text(), nullable=True))

    # Social insurance
    op.add_column('hr_employees', sa.Column('so_so_bhxh', sa.String(30), nullable=True))
    op.add_column('hr_employees', sa.Column('ngay_tham_gia_bhxh', sa.Date(), nullable=True))
    op.add_column('hr_employees', sa.Column('ma_bhyt', sa.String(30), nullable=True))
    op.add_column('hr_employees', sa.Column('noi_kham_chua_benh', sa.String(255), nullable=True))
    op.add_column('hr_employees', sa.Column('muc_dong_bhxh', sa.Numeric(precision=18, scale=2), nullable=True))

    # Team (to) FK
    op.add_column('hr_employees', sa.Column('to_id', sa.Integer(), nullable=True))

    # Indexes
    op.create_index('ix_hr_employees_so_so_bhxh', 'hr_employees', ['so_so_bhxh'])


def downgrade() -> None:
    op.drop_index('ix_hr_employees_so_so_bhxh', table_name='hr_employees')
    op.drop_column('hr_employees', 'to_id')
    op.drop_column('hr_employees', 'muc_dong_bhxh')
    op.drop_column('hr_employees', 'noi_kham_chua_benh')
    op.drop_column('hr_employees', 'ma_bhyt')
    op.drop_column('hr_employees', 'ngay_tham_gia_bhxh')
    op.drop_column('hr_employees', 'so_so_bhxh')
    op.drop_column('hr_employees', 'so_yeu_tom_tat')
    op.drop_column('hr_employees', 'ky_nang_khac')
    op.drop_column('hr_employees', 'tin_hoc')
    op.drop_column('hr_employees', 'ngoai_ngu')
    op.drop_column('hr_employees', 'nam_tot_nghiep')
    op.drop_column('hr_employees', 'truong_dao_tao')
    op.drop_column('hr_employees', 'chuyen_nganh')
    op.drop_column('hr_employees', 'trinh_do_hoc_van')
    op.drop_column('hr_employees', 'avatar_url')
    op.drop_column('hr_employees', 'dien_thoai_ban')
    op.drop_column('hr_employees', 'dia_chi_hien_tai')
    op.drop_column('hr_employees', 'dia_chi_ho_khau')
    op.drop_column('hr_employees', 'phuong_ho_khau')
    op.drop_column('hr_employees', 'huyen_ho_khau')
    op.drop_column('hr_employees', 'tinh_ho_khau')
    op.drop_column('hr_employees', 'dia_chi_que_quan')
    op.drop_column('hr_employees', 'phuong_que_quan')
    op.drop_column('hr_employees', 'huyen_que_quan')
    op.drop_column('hr_employees', 'tinh_que_quan')
    op.drop_column('hr_employees', 'noi_sinh_dia_chi')
    op.drop_column('hr_employees', 'noi_sinh_tinh')
    op.drop_column('hr_employees', 'ton_giao')
    op.drop_column('hr_employees', 'dan_toc')
    op.drop_column('hr_employees', 'quoc_tich')
    op.drop_column('hr_employees', 'ten_bi_danh')
    op.drop_column('hr_employees', 'ten')
    op.drop_column('hr_employees', 'ho_dem')
