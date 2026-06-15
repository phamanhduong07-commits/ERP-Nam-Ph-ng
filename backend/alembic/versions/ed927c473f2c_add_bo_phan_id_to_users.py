"""add_bo_phan_id_to_users

Revision ID: ed927c473f2c
Revises: zmh028
Create Date: 2026-06-15 12:19:09.409167

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ed927c473f2c'
down_revision: Union[str, None] = 'zmh028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('bo_phan_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'users', 'hr_departments', ['bo_phan_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'users', type_='foreignkey')
    op.drop_column('users', 'bo_phan_id')
