"""add customer contact fields

Revision ID: zmh018
Revises: zmh017
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh018'
down_revision = 'zmh017'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('email', sa.String(150), nullable=True))
    op.add_column('customers', sa.Column('phap_nhan', sa.String(100), nullable=True))
    op.add_column('customers', sa.Column('ke_toan_phu_trach', sa.String(150), nullable=True))
    op.add_column('customers', sa.Column('dieu_khoan_tt', sa.String(200), nullable=True))
    op.add_column('customers', sa.Column('sa_cskh', sa.String(150), nullable=True))


def downgrade() -> None:
    op.drop_column('customers', 'sa_cskh')
    op.drop_column('customers', 'dieu_khoan_tt')
    op.drop_column('customers', 'ke_toan_phu_trach')
    op.drop_column('customers', 'phap_nhan')
    op.drop_column('customers', 'email')
