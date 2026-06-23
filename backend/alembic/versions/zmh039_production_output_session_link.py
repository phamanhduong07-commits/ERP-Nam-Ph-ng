"""production_outputs: add production_session_id link

Revision ID: zmh039
Revises: zmh038
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh039'
down_revision = 'zmh038'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'production_outputs',
        sa.Column(
            'production_session_id',
            sa.Integer(),
            sa.ForeignKey('production_sessions.id'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_production_outputs_session',
        'production_outputs',
        ['production_session_id'],
    )


def downgrade():
    op.drop_index('ix_production_outputs_session', 'production_outputs')
    op.drop_column('production_outputs', 'production_session_id')
