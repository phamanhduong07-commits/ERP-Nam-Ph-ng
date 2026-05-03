"""cd2: thêm phan_xuong_id vào may_in, may_sau_in, may_scan, shift_ca, phieu_in

Revision ID: g1h2i3j4k5l6
Revises: f2b3c4d5e6a7
Create Date: 2026-05-03
"""
from alembic import op

revision = 'g1h2i3j4k5l6'
down_revision = 'f2b3c4d5e6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    for tbl in ('may_in', 'may_sau_in', 'may_scan', 'shift_ca', 'phieu_in'):
        op.execute(f"""
            ALTER TABLE {tbl}
            ADD COLUMN IF NOT EXISTS phan_xuong_id INTEGER REFERENCES phan_xuong(id)
        """)


def downgrade() -> None:
    for tbl in ('phieu_in', 'shift_ca', 'may_scan', 'may_sau_in', 'may_in'):
        op.execute(f"ALTER TABLE {tbl} DROP COLUMN IF EXISTS phan_xuong_id")
