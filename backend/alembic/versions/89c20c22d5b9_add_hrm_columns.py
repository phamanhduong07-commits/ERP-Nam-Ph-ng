"""add HRM columns — must_change_password, leave request extras, payroll run extras

Revision ID: 89c20c22d5b9
Revises: can001
Create Date: 2026-06-12

Adds only the new columns introduced by the HRM (Human Resource Management) branch merge.
Skips table creation (handled by create_all on service startup) and FK/index changes
that are not required for application functionality.
"""
from alembic import op
import sqlalchemy as sa


revision = '89c20c22d5b9'
down_revision = 'can001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users — must_change_password (required: blocks all auth endpoints when missing)
    op.add_column('users', sa.Column(
        'must_change_password', sa.Boolean(),
        server_default=sa.text('false'), nullable=False,
    ))

    # hr_leave_requests — new optional fields from HRM
    op.add_column('hr_leave_requests', sa.Column(
        'da_xu_ly', sa.Boolean(),
        server_default=sa.text('false'), nullable=True,
    ))
    op.add_column('hr_leave_requests', sa.Column(
        'so_gio_ot', sa.Numeric(precision=5, scale=2), nullable=True,
    ))
    op.add_column('hr_leave_requests', sa.Column(
        'dia_diem', sa.String(length=255), nullable=True,
    ))
    op.add_column('hr_leave_requests', sa.Column(
        'file_dinh_kem_url', sa.String(length=500), nullable=True,
    ))

    # hr_payroll_runs — new calculation fields from HRM payroll engine
    op.add_column('hr_payroll_runs', sa.Column(
        'cong_quy_doi', sa.Numeric(precision=8, scale=4),
        server_default=sa.text('0'), nullable=False,
    ))
    op.add_column('hr_payroll_runs', sa.Column(
        'he_so_ca_nhan_snapshot', sa.Numeric(precision=5, scale=2),
        server_default=sa.text('0'), nullable=False,
    ))
    op.add_column('hr_payroll_runs', sa.Column(
        'trong_so_ca_nhan', sa.Numeric(precision=10, scale=4),
        server_default=sa.text('0'), nullable=False,
    ))
    op.add_column('hr_payroll_runs', sa.Column(
        'bu_toi_thieu_vung', sa.Numeric(precision=18, scale=2),
        server_default=sa.text('0'), nullable=False,
    ))
    op.add_column('hr_payroll_runs', sa.Column(
        'bo_phan_id_snapshot', sa.Integer(), nullable=True,
    ))
    op.add_column('hr_payroll_runs', sa.Column(
        'ghi_chu_calc', sa.Text(), nullable=True,
    ))
    op.add_column('hr_payroll_runs', sa.Column(
        'ngay_chot', sa.Date(), nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('hr_payroll_runs', 'ngay_chot')
    op.drop_column('hr_payroll_runs', 'ghi_chu_calc')
    op.drop_column('hr_payroll_runs', 'bo_phan_id_snapshot')
    op.drop_column('hr_payroll_runs', 'bu_toi_thieu_vung')
    op.drop_column('hr_payroll_runs', 'trong_so_ca_nhan')
    op.drop_column('hr_payroll_runs', 'he_so_ca_nhan_snapshot')
    op.drop_column('hr_payroll_runs', 'cong_quy_doi')
    op.drop_column('hr_leave_requests', 'file_dinh_kem_url')
    op.drop_column('hr_leave_requests', 'dia_diem')
    op.drop_column('hr_leave_requests', 'so_gio_ot')
    op.drop_column('hr_leave_requests', 'da_xu_ly')
    op.drop_column('users', 'must_change_password')
