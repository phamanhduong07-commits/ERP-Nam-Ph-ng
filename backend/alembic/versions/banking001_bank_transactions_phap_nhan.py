"""add bank_transactions table and phap_nhan_id to bank_accounts

Revision ID: banking001
Revises: costing001
Create Date: 2026-05-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "banking001"
down_revision: Union[str, None] = "costing001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add phap_nhan_id to bank_accounts
    op.add_column(
        "bank_accounts",
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
    )
    op.create_index("ix_bank_accounts_phap_nhan", "bank_accounts", ["phap_nhan_id"])

    # Create bank_transactions table
    op.create_table(
        "bank_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bank_account_id", sa.Integer(), sa.ForeignKey("bank_accounts.id"), nullable=True),
        sa.Column("phap_nhan_id", sa.Integer(), sa.ForeignKey("phap_nhan.id"), nullable=True),
        sa.Column("ngay_giao_dich", sa.Date(), nullable=False),
        sa.Column("so_tai_khoan", sa.String(100), nullable=True),
        sa.Column("so_tham_chieu", sa.String(100), nullable=True),
        sa.Column("mo_ta", sa.Text(), nullable=True),
        sa.Column("thu", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("chi", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("so_du", sa.Numeric(18, 2), nullable=True),
        sa.Column("trang_thai", sa.String(20), nullable=False, server_default="chua_doi_soat"),
        sa.Column("matched_chung_tu_loai", sa.String(30), nullable=True),
        sa.Column("matched_chung_tu_id", sa.Integer(), nullable=True),
        sa.Column("matched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("matched_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("import_key", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_bank_transactions_account_date", "bank_transactions", ["bank_account_id", "ngay_giao_dich"])
    op.create_index("ix_bank_transactions_trang_thai", "bank_transactions", ["trang_thai"])
    op.create_index("ix_bank_transactions_phap_nhan", "bank_transactions", ["phap_nhan_id"])


def downgrade() -> None:
    op.drop_index("ix_bank_transactions_phap_nhan", table_name="bank_transactions")
    op.drop_index("ix_bank_transactions_trang_thai", table_name="bank_transactions")
    op.drop_index("ix_bank_transactions_account_date", table_name="bank_transactions")
    op.drop_table("bank_transactions")
    op.drop_index("ix_bank_accounts_phap_nhan", table_name="bank_accounts")
    op.drop_column("bank_accounts", "phap_nhan_id")
