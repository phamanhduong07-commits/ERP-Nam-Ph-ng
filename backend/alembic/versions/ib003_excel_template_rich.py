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
    conn = op.get_bind()
    existing = {r[0] for r in conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='excel_templates'"
    ))}
    for col_name, col_type in [
        ("header_config", sa.JSON()),
        ("footer_config", sa.JSON()),
        ("style_config", sa.JSON()),
    ]:
        if col_name not in existing:
            op.add_column("excel_templates", sa.Column(col_name, col_type, nullable=True))


def downgrade():
    op.drop_column("excel_templates", "style_config")
    op.drop_column("excel_templates", "footer_config")
    op.drop_column("excel_templates", "header_config")
