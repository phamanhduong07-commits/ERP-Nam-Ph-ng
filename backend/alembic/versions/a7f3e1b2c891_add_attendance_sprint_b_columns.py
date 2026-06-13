"""add hr_attendance_logs Sprint B geo-fence columns

Revision ID: a7f3e1b2c891
Revises: 23d284918194
Create Date: 2026-06-12

Adds 11 Sprint B (geo-fence online check-in) columns to hr_attendance_logs.
Table was created by create_all() before HRM branch added these columns.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a7f3e1b2c891'
down_revision = '23d284918194'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sprint B — geo-fence check-in (vào)
    op.add_column('hr_attendance_logs', sa.Column('checkin_lat', sa.Float(), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column('checkin_lng', sa.Float(), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column('checkin_address', sa.Text(), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column('checkin_selfie_url', sa.String(length=500), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column(
        'checkin_location_id',
        sa.Integer(),
        sa.ForeignKey('hr_checkin_locations.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('hr_attendance_logs', sa.Column('checkin_distance_m', sa.Float(), nullable=True))

    # Sprint B — geo-fence check-out (ra)
    op.add_column('hr_attendance_logs', sa.Column('checkout_lat', sa.Float(), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column('checkout_lng', sa.Float(), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column('checkout_address', sa.Text(), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column('checkout_selfie_url', sa.String(length=500), nullable=True))
    op.add_column('hr_attendance_logs', sa.Column('checkout_distance_m', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('hr_attendance_logs', 'checkout_distance_m')
    op.drop_column('hr_attendance_logs', 'checkout_selfie_url')
    op.drop_column('hr_attendance_logs', 'checkout_address')
    op.drop_column('hr_attendance_logs', 'checkout_lng')
    op.drop_column('hr_attendance_logs', 'checkout_lat')
    op.drop_column('hr_attendance_logs', 'checkin_distance_m')
    op.drop_column('hr_attendance_logs', 'checkin_location_id')
    op.drop_column('hr_attendance_logs', 'checkin_selfie_url')
    op.drop_column('hr_attendance_logs', 'checkin_address')
    op.drop_column('hr_attendance_logs', 'checkin_lng')
    op.drop_column('hr_attendance_logs', 'checkin_lat')
