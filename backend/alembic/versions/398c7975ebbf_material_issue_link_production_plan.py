"""material_issue_link_production_plan

Revision ID: 398c7975ebbf
Revises: f7630db419be
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa

revision = '398c7975ebbf'
down_revision = 'f7630db419be'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make production_order_id nullable
    op.alter_column('material_issues', 'production_order_id', nullable=True)
    # Add production_plan_id FK
    op.add_column('material_issues', sa.Column(
        'production_plan_id', sa.Integer(),
        sa.ForeignKey('production_plans.id'),
        nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('material_issues', 'production_plan_id')
    op.alter_column('material_issues', 'production_order_id', nullable=False)
