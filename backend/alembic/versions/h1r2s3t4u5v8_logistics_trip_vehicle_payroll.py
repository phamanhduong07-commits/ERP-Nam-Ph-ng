"""logistics trip salary and unified vehicle fields

Revision ID: h1r2s3t4u5v8
Revises: h1r2s3t4u5v7
Create Date: 2026-05-14
"""

from alembic import op


revision = "h1r2s3t4u5v8"
down_revision = "h1r2s3t4u5v7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE xe ADD COLUMN IF NOT EXISTS dinh_muc_dau NUMERIC(10,2) DEFAULT 0")
    op.execute("ALTER TABLE tai_xe ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES hr_employees(id)")
    op.execute("ALTER TABLE tai_xe ADD COLUMN IF NOT EXISTS he_so_chuyen NUMERIC(8,4) DEFAULT 1")
    op.execute("ALTER TABLE lo_xe ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES hr_employees(id)")
    op.execute("ALTER TABLE lo_xe ADD COLUMN IF NOT EXISTS he_so_chuyen NUMERIC(8,4) DEFAULT 0.3")
    op.execute("ALTER TABLE hr_fuel_logs ADD COLUMN IF NOT EXISTS xe_id INTEGER REFERENCES xe(id)")
    op.execute("ALTER TABLE hr_fuel_logs ALTER COLUMN vehicle_id DROP NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE hr_fuel_logs ALTER COLUMN vehicle_id SET NOT NULL")
    op.execute("ALTER TABLE hr_fuel_logs DROP COLUMN IF EXISTS xe_id")
    op.execute("ALTER TABLE lo_xe DROP COLUMN IF EXISTS he_so_chuyen")
    op.execute("ALTER TABLE lo_xe DROP COLUMN IF EXISTS employee_id")
    op.execute("ALTER TABLE tai_xe DROP COLUMN IF EXISTS he_so_chuyen")
    op.execute("ALTER TABLE tai_xe DROP COLUMN IF EXISTS employee_id")
    op.execute("ALTER TABLE xe DROP COLUMN IF EXISTS dinh_muc_dau")
