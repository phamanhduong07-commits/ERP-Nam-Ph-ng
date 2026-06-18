"""chart_of_accounts: them theo_doi_doi_tuong va loai_doi_tuong

Revision ID: zmh032
Revises: zmh031
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh032'
down_revision = 'zmh031'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('chart_of_accounts') as batch_op:
        batch_op.add_column(sa.Column('theo_doi_doi_tuong', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('loai_doi_tuong', sa.String(30), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('chart_of_accounts') as batch_op:
        batch_op.drop_column('loai_doi_tuong')
        batch_op.drop_column('theo_doi_doi_tuong')
