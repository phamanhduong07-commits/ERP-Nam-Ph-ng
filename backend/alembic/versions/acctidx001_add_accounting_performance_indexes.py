"""add_accounting_performance_indexes

Thêm index cho các cột lọc/sort/join nóng trong module kế toán:
journal_entries, journal_entry_lines, purchase_invoices, cash_receipts,
cash_payments, workshop_payroll, fixed_assets, bank_transactions,
production_cost_periods.

Migration này cũng hợp nhất (merge) các head đang phân nhánh để giữ cây
migration tuyến tính. Index dùng tên chuẩn SQLAlchemy (ix_<bảng>_<cột>) khớp
với index=True trong models/accounting.py. Tất cả dùng IF NOT EXISTS nên an
toàn khi chạy lại hoặc khi index đã tồn tại từ migration trước.

Revision ID: acctidx001
Revises: add_quote_history, ib003, mi001, so001_sales_po, up001_user_permissions, zmh014
Create Date: 2026-06-07
"""
from typing import Sequence, Union
from alembic import op

revision: str = "acctidx001"
down_revision: Union[str, tuple] = (
    "add_quote_history",
    "ib003",
    "mi001",
    "so001_sales_po",
    "up001_user_permissions",
    "zmh014",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (index_name, table, column) — tên khớp index=True của SQLAlchemy
_INDEXES = [
    # JournalEntry
    ("ix_journal_entries_ngay_but_toan", "journal_entries", "ngay_but_toan"),
    ("ix_journal_entries_loai_but_toan", "journal_entries", "loai_but_toan"),
    ("ix_journal_entries_chung_tu_loai", "journal_entries", "chung_tu_loai"),
    ("ix_journal_entries_phap_nhan_id", "journal_entries", "phap_nhan_id"),
    # JournalEntryLine
    ("ix_journal_entry_lines_entry_id", "journal_entry_lines", "entry_id"),
    # PurchaseInvoice
    ("ix_purchase_invoices_supplier_id", "purchase_invoices", "supplier_id"),
    ("ix_purchase_invoices_ngay_lap", "purchase_invoices", "ngay_lap"),
    ("ix_purchase_invoices_trang_thai", "purchase_invoices", "trang_thai"),
    ("ix_purchase_invoices_phap_nhan_id", "purchase_invoices", "phap_nhan_id"),
    # CashReceipt
    ("ix_cash_receipts_ngay_phieu", "cash_receipts", "ngay_phieu"),
    ("ix_cash_receipts_customer_id", "cash_receipts", "customer_id"),
    ("ix_cash_receipts_trang_thai", "cash_receipts", "trang_thai"),
    ("ix_cash_receipts_phap_nhan_id", "cash_receipts", "phap_nhan_id"),
    # CashPayment
    ("ix_cash_payments_ngay_phieu", "cash_payments", "ngay_phieu"),
    ("ix_cash_payments_supplier_id", "cash_payments", "supplier_id"),
    ("ix_cash_payments_trang_thai", "cash_payments", "trang_thai"),
    ("ix_cash_payments_phap_nhan_id", "cash_payments", "phap_nhan_id"),
    # WorkshopPayroll
    ("ix_workshop_payroll_phan_xuong_id", "workshop_payroll", "phan_xuong_id"),
    ("ix_workshop_payroll_phap_nhan_id", "workshop_payroll", "phap_nhan_id"),
    # FixedAsset
    ("ix_fixed_assets_phap_nhan_id", "fixed_assets", "phap_nhan_id"),
    ("ix_fixed_assets_trang_thai", "fixed_assets", "trang_thai"),
    # BankTransaction
    ("ix_bank_transactions_phap_nhan_id", "bank_transactions", "phap_nhan_id"),
    ("ix_bank_transactions_ngay_giao_dich", "bank_transactions", "ngay_giao_dich"),
    ("ix_bank_transactions_trang_thai", "bank_transactions", "trang_thai"),
    # ProductionCostPeriod
    ("ix_production_cost_periods_phap_nhan_id", "production_cost_periods", "phap_nhan_id"),
    ("ix_production_cost_periods_phan_xuong_id", "production_cost_periods", "phan_xuong_id"),
    ("ix_production_cost_periods_trang_thai", "production_cost_periods", "trang_thai"),
]


def upgrade() -> None:
    for name, table, column in _INDEXES:
        op.execute(f'CREATE INDEX IF NOT EXISTS {name} ON {table} ({column})')


def downgrade() -> None:
    for name, _table, _column in _INDEXES:
        op.execute(f'DROP INDEX IF EXISTS {name}')
