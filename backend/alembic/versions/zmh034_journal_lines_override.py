"""cash_receipts + cash_payments: them journal_lines_override JSON

Revision ID: zmh034
Revises: zmh033
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh034'
down_revision = ('zmh033', 'dt001')
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('cash_receipts') as batch_op:
        batch_op.add_column(sa.Column('journal_lines_override', sa.JSON(), nullable=True))

    with op.batch_alter_table('cash_payments') as batch_op:
        batch_op.add_column(sa.Column('journal_lines_override', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('cash_payments') as batch_op:
        batch_op.drop_column('journal_lines_override')

    with op.batch_alter_table('cash_receipts') as batch_op:
        batch_op.drop_column('journal_lines_override')
