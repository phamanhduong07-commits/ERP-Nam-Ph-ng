"""acctidx002: debt_ledger_entries indexes + CHECK constraints

Thêm index cho customer_id và supplier_id trên debt_ledger_entries (phục vụ
truy vấn sổ công nợ, doi_chieu, aging). Thêm CHECK constraints để đảm bảo
tính nhất quán của cột loai và doi_tuong ở cấp DB.

Revision ID: acctidx002
Revises: acctidx001
Create Date: 2026-06-08
"""
from typing import Sequence, Union
from alembic import op

revision: str = "acctidx002"
down_revision: Union[str, None] = "acctidx001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_debt_ledger_entries_customer_id "
        "ON debt_ledger_entries (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_debt_ledger_entries_supplier_id "
        "ON debt_ledger_entries (supplier_id)"
    )
    op.execute(
        "ALTER TABLE debt_ledger_entries "
        "ADD CONSTRAINT ck_debt_ledger_loai "
        "CHECK (loai IN ('tang_no', 'giam_no'))"
    )
    op.execute(
        "ALTER TABLE debt_ledger_entries "
        "ADD CONSTRAINT ck_debt_ledger_doi_tuong "
        "CHECK (doi_tuong IN ('khach_hang', 'nha_cung_cap', 'quy_tien_mat'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE debt_ledger_entries DROP CONSTRAINT IF EXISTS ck_debt_ledger_doi_tuong")
    op.execute("ALTER TABLE debt_ledger_entries DROP CONSTRAINT IF EXISTS ck_debt_ledger_loai")
    op.execute("DROP INDEX IF EXISTS ix_debt_ledger_entries_supplier_id")
    op.execute("DROP INDEX IF EXISTS ix_debt_ledger_entries_customer_id")
