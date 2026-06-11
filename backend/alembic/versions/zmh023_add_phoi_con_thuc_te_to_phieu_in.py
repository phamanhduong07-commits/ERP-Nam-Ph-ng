"""add so_phoi_thuc_te and so_con_thuc_te to phieu_in

Revision ID: zmh023
Revises: zmh022
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh023'
down_revision = ('zmh022', 'merge001')
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('phieu_in', sa.Column('so_phoi_thuc_te', sa.Integer(), nullable=True))
    op.add_column('phieu_in', sa.Column('so_con_thuc_te', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('phieu_in', 'so_con_thuc_te')
    op.drop_column('phieu_in', 'so_phoi_thuc_te')
