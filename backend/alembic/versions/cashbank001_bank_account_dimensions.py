"""add bank account dimensions to cash and bank flows

Revision ID: cashbank001
Revises: ocr_merge001
Create Date: 2026-05-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cashbank001"
down_revision: Union[str, None] = "ocr_merge001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bank_accounts", sa.Column("phap_nhan_id", sa.Integer(), nullable=True))
    op.create_index("ix_bank_accounts_phap_nhan_id", "bank_accounts", ["phap_nhan_id"])
    op.create_foreign_key(
        "fk_bank_accounts_phap_nhan",
        "bank_accounts",
        "phap_nhan",
        ["phap_nhan_id"],
        ["id"],
    )

    op.add_column("cash_receipts", sa.Column("bank_account_id", sa.Integer(), nullable=True))
    op.add_column("cash_receipts", sa.Column("phan_xuong_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_cash_receipts_bank_account",
        "cash_receipts",
        "bank_accounts",
        ["bank_account_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_cash_receipts_phan_xuong",
        "cash_receipts",
        "phan_xuong",
        ["phan_xuong_id"],
        ["id"],
    )

    op.add_column("cash_payments", sa.Column("bank_account_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_cash_payments_bank_account",
        "cash_payments",
        "bank_accounts",
        ["bank_account_id"],
        ["id"],
    )

    op.create_table(
        "bank_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bank_account_id", sa.Integer(), nullable=True),
        sa.Column("phap_nhan_id", sa.Integer(), nullable=True),
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
        sa.Column("matched_by", sa.Integer(), nullable=True),
        sa.Column("import_key", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["bank_account_id"], ["bank_accounts.id"], name="fk_bank_transactions_bank_account"),
        sa.ForeignKeyConstraint(["phap_nhan_id"], ["phap_nhan.id"], name="fk_bank_transactions_phap_nhan"),
        sa.ForeignKeyConstraint(["matched_by"], ["users.id"], name="fk_bank_transactions_matched_by"),
    )
    op.create_index("ix_bank_transactions_phap_nhan_id", "bank_transactions", ["phap_nhan_id"])
    op.create_index("ix_bank_transactions_ngay", "bank_transactions", ["ngay_giao_dich"])
    op.create_index("ix_bank_transactions_status", "bank_transactions", ["trang_thai"])


def downgrade() -> None:
    op.drop_index("ix_bank_transactions_status", table_name="bank_transactions")
    op.drop_index("ix_bank_transactions_ngay", table_name="bank_transactions")
    op.drop_index("ix_bank_transactions_phap_nhan_id", table_name="bank_transactions")
    op.drop_table("bank_transactions")

    op.drop_constraint("fk_cash_payments_bank_account", "cash_payments", type_="foreignkey")
    op.drop_column("cash_payments", "bank_account_id")

    op.drop_constraint("fk_cash_receipts_phan_xuong", "cash_receipts", type_="foreignkey")
    op.drop_constraint("fk_cash_receipts_bank_account", "cash_receipts", type_="foreignkey")
    op.drop_column("cash_receipts", "phan_xuong_id")
    op.drop_column("cash_receipts", "bank_account_id")

    op.drop_constraint("fk_bank_accounts_phap_nhan", "bank_accounts", type_="foreignkey")
    op.drop_index("ix_bank_accounts_phap_nhan_id", table_name="bank_accounts")
    op.drop_column("bank_accounts", "phap_nhan_id")
