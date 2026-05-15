"""add workshop and stage to HR payroll config

Revision ID: h1r2s3t4u5v7
Revises: h1r2s3t4u5v6
Create Date: 2026-05-14
"""
from alembic import op

revision = "h1r2s3t4u5v7"
down_revision = "h1r2s3t4u5v6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE hr_payroll_configs ADD COLUMN IF NOT EXISTS phan_xuong_id INTEGER REFERENCES phan_xuong(id)")
    op.execute("ALTER TABLE hr_payroll_configs ADD COLUMN IF NOT EXISTS cong_doan VARCHAR(50)")


def downgrade():
    op.execute("ALTER TABLE hr_payroll_configs DROP COLUMN IF EXISTS cong_doan")
    op.execute("ALTER TABLE hr_payroll_configs DROP COLUMN IF EXISTS phan_xuong_id")
