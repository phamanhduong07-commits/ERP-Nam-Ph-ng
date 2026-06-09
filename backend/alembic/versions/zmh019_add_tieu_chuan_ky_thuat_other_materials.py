"""add tieu_chuan_ky_thuat to other_materials

Revision ID: zmh019
Revises: zmh018
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh019'
down_revision = 'zmh018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('other_materials', sa.Column('quy_cach', sa.String(200), nullable=True))
    op.add_column('other_materials', sa.Column('tieu_chuan_ky_thuat', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('other_materials', 'tieu_chuan_ky_thuat')
    op.drop_column('other_materials', 'quy_cach')
