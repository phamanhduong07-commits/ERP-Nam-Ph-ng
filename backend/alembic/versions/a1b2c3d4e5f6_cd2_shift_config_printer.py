"""cd2 shift_ca shift_config printer_user capacity

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-04-28

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS shift_ca (
            id SERIAL NOT NULL,
            name VARCHAR(50) NOT NULL,
            leader VARCHAR(100),
            active BOOLEAN NOT NULL DEFAULT true,
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS shift_config (
            id SERIAL NOT NULL,
            may_in_id INTEGER NOT NULL REFERENCES may_in(id),
            shift_ca_id INTEGER NOT NULL REFERENCES shift_ca(id),
            ngay DATE NOT NULL,
            gio_lam NUMERIC(5,2),
            gio_bat_dau VARCHAR(10),
            gio_ket_thuc VARCHAR(10),
            nghi_1 INTEGER,
            nghi_2 INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS printer_user (
            id SERIAL NOT NULL,
            rfid_key VARCHAR(100),
            token_user VARCHAR(100) NOT NULL,
            token_password VARCHAR(255) NOT NULL,
            shift INTEGER,
            active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        ALTER TABLE may_in
        ADD COLUMN IF NOT EXISTS capacity NUMERIC(10,2)
    """)


def downgrade() -> None:
    op.drop_table('shift_config')
    op.drop_table('shift_ca')
    op.drop_table('printer_user')
    op.drop_column('may_in', 'capacity')
