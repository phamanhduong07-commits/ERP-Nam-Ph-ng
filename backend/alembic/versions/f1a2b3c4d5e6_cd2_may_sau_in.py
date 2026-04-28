"""cd2 may_sau_in table and phieu_in.may_sau_in_id

Revision ID: f1a2b3c4d5e6
Revises: e7a3f45b8c91
Create Date: 2026-04-28

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e7a3f45b8c91'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS may_sau_in (
            id SERIAL NOT NULL,
            ten_may VARCHAR(50) NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            active BOOLEAN NOT NULL DEFAULT true,
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        ALTER TABLE phieu_in
        ADD COLUMN IF NOT EXISTS may_sau_in_id INTEGER REFERENCES may_sau_in(id)
    """)


def downgrade() -> None:
    op.drop_column('phieu_in', 'may_sau_in_id')
    op.drop_table('may_sau_in')
