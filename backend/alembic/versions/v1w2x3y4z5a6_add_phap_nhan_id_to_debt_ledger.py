"""add phap_nhan_id to debt_ledger_entries

Revision ID: v1w2x3y4z5a6
Revises: u1v2w3x4y5z6
Create Date: 2026-05-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'v1w2x3y4z5a6'
down_revision = 'u1v2w3x4y5z6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'debt_ledger_entries',
        sa.Column('phap_nhan_id', sa.Integer(), nullable=True)
    )
    op.create_index(
        'ix_debt_ledger_entries_phap_nhan_id',
        'debt_ledger_entries',
        ['phap_nhan_id']
    )
    op.create_foreign_key(
        'fk_debt_ledger_phap_nhan',
        'debt_ledger_entries',
        'phap_nhan',
        ['phap_nhan_id'],
        ['id']
    )


def downgrade():
    op.drop_constraint('fk_debt_ledger_phap_nhan', 'debt_ledger_entries', type_='foreignkey')
    op.drop_index('ix_debt_ledger_entries_phap_nhan_id', table_name='debt_ledger_entries')
    op.drop_column('debt_ledger_entries', 'phap_nhan_id')
