"""create debt reconciliation statement tables

Revision ID: debtrec001
Revises: w1x2y3z4a5b6
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa

revision = "debtrec001"
down_revision = "w1x2y3z4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "debt_reconciliation_statements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("so_bien_ban", sa.String(length=30), nullable=False, unique=True),
        sa.Column("doi_tuong", sa.String(length=20), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=True),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id"), nullable=True),
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
        sa.Column("tu_ngay", sa.Date(), nullable=False),
        sa.Column("den_ngay", sa.Date(), nullable=False),
        sa.Column("so_du_dau_ky", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("phat_sinh_tang", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("phat_sinh_giam", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("so_du_cuoi_ky", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("trang_thai", sa.String(length=20), nullable=False, server_default="nhap"),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("file_ky_url", sa.String(length=500), nullable=True),
        sa.Column("snapshot_json", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("confirmed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_debt_reconciliation_statements_phap_nhan_id",
        "debt_reconciliation_statements",
        ["phap_nhan_id"],
    )

    op.create_table(
        "debt_reconciliation_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "statement_id",
            sa.Integer(),
            sa.ForeignKey("debt_reconciliation_statements.id"),
            nullable=False,
        ),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="ledger"),
        sa.Column("ngay", sa.Date(), nullable=True),
        sa.Column("loai", sa.String(length=20), nullable=True),
        sa.Column("chung_tu_loai", sa.String(length=50), nullable=True),
        sa.Column("chung_tu_id", sa.Integer(), nullable=True),
        sa.Column("dien_giai", sa.Text(), nullable=True),
        sa.Column("phat_sinh_tang", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("phat_sinh_giam", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("so_du", sa.Numeric(18, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("debt_reconciliation_lines")
    op.drop_index(
        "ix_debt_reconciliation_statements_phap_nhan_id",
        table_name="debt_reconciliation_statements",
    )
    op.drop_table("debt_reconciliation_statements")
