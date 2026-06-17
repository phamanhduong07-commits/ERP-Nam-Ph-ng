"""cash_payment: nullable supplier_id, add loai_chi

Revision ID: zmh031
Revises: zmh030
Create Date: 2026-06-17

"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh031'
down_revision = 'zmh030'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('cash_payments') as batch_op:
        batch_op.alter_column('supplier_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('loai_chi', sa.String(30), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('cash_payments') as batch_op:
        batch_op.drop_column('loai_chi')
        batch_op.alter_column('supplier_id', existing_type=sa.Integer(), nullable=False)
