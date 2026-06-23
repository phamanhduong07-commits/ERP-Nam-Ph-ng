"""production_session_overheads table

Revision ID: zmh041
Revises: zmh040
Create Date: 2026-06-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh041'
down_revision = 'zmh040'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'production_session_overheads',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(),
                  sa.ForeignKey('production_sessions.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('loai_chi_phi', sa.String(50), nullable=False),
        sa.Column('ten_chi_phi', sa.String(200), nullable=False),
        sa.Column('thanh_tien', sa.Numeric(18, 2), nullable=False),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
    )
    op.create_index(
        'ix_production_session_overheads_session',
        'production_session_overheads',
        ['session_id'],
    )


def downgrade():
    op.drop_index('ix_production_session_overheads_session', 'production_session_overheads')
    op.drop_table('production_session_overheads')
