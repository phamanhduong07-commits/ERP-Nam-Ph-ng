"""add doi_tru_chung_tu and doi_tru_items, add da_doi_tru to cash_payments

Revision ID: dt001
Revises: zmh032
Create Date: 2026-06-17

"""
from alembic import op
import sqlalchemy as sa

revision = "dt001"
down_revision = "0718ea571b91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cash_payments",
        sa.Column("da_doi_tru", sa.Numeric(18, 2), nullable=False, server_default="0"),
    )

    op.create_table(
        "doi_tru_chung_tu",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ma_doi_tru", sa.String(30), nullable=False, unique=True),
        sa.Column("ngay_doi_tru", sa.Date(), nullable=False),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id"), nullable=False),
        sa.Column("loai", sa.String(20), nullable=False, server_default="doi_tru"),
        sa.Column("trang_thai", sa.String(20), nullable=False, server_default="da_xac_nhan"),
        sa.Column("tong_tien_doi_tru", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
        sa.Column("nguoi_xac_nhan_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("ngay_xac_nhan", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_doi_tru_chung_tu_ngay", "doi_tru_chung_tu", ["ngay_doi_tru"])
    op.create_index("ix_doi_tru_chung_tu_supplier", "doi_tru_chung_tu", ["supplier_id"])
    op.create_index("ix_doi_tru_chung_tu_trang_thai", "doi_tru_chung_tu", ["trang_thai"])
    op.create_index("ix_doi_tru_chung_tu_phap_nhan", "doi_tru_chung_tu", ["phap_nhan_id"])

    op.create_table(
        "doi_tru_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doi_tru_id", sa.Integer(), sa.ForeignKey("doi_tru_chung_tu.id"), nullable=False),
        sa.Column("purchase_invoice_id", sa.Integer(), sa.ForeignKey("purchase_invoices.id"), nullable=True),
        sa.Column("cash_payment_id", sa.Integer(), sa.ForeignKey("cash_payments.id"), nullable=True),
        sa.Column("sales_invoice_id", sa.Integer(), sa.ForeignKey("sales_invoices.id"), nullable=True),
        sa.Column("so_tien_doi_tru", sa.Numeric(18, 2), nullable=False),
    )
    op.create_index("ix_doi_tru_items_doi_tru_id", "doi_tru_items", ["doi_tru_id"])


def downgrade() -> None:
    op.drop_index("ix_doi_tru_items_doi_tru_id", table_name="doi_tru_items")
    op.drop_table("doi_tru_items")
    op.drop_index("ix_doi_tru_chung_tu_phap_nhan", table_name="doi_tru_chung_tu")
    op.drop_index("ix_doi_tru_chung_tu_trang_thai", table_name="doi_tru_chung_tu")
    op.drop_index("ix_doi_tru_chung_tu_supplier", table_name="doi_tru_chung_tu")
    op.drop_index("ix_doi_tru_chung_tu_ngay", table_name="doi_tru_chung_tu")
    op.drop_table("doi_tru_chung_tu")
    op.drop_column("cash_payments", "da_doi_tru")
