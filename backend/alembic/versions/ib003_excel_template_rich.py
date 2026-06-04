"""excel_template_rich: add header_config, footer_config, style_config

Revision ID: ib003
Revises: ib002
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = "ib003"
down_revision = "ib002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("excel_templates", sa.Column("header_config", sa.JSON(), nullable=True))
    op.add_column("excel_templates", sa.Column("footer_config", sa.JSON(), nullable=True))
    op.add_column("excel_templates", sa.Column("style_config", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("excel_templates", "style_config")
    op.drop_column("excel_templates", "footer_config")
    op.drop_column("excel_templates", "header_config")
