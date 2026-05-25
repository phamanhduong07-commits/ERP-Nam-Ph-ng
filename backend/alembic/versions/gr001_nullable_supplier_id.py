"""nullable supplier_id in goods_receipts for gate guard quick capture

Revision ID: gr001
Revises: del002
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'gr002'
down_revision = 'del002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('goods_receipts') as batch_op:
        batch_op.alter_column('supplier_id',
                              existing_type=sa.Integer(),
                              nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('goods_receipts') as batch_op:
        batch_op.alter_column('supplier_id',
                              existing_type=sa.Integer(),
                              nullable=False)
