"""add la_mac_dinh_pha_keo to other_materials

Revision ID: zmh036
Revises: zmh035
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh036'
down_revision = 'zmh035'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('other_materials') as batch_op:
        batch_op.add_column(
            sa.Column('la_mac_dinh_pha_keo', sa.Boolean(), nullable=False, server_default='0')
        )


def downgrade() -> None:
    with op.batch_alter_table('other_materials') as batch_op:
        batch_op.drop_column('la_mac_dinh_pha_keo')
