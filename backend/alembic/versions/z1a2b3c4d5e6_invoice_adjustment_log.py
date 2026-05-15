"""invoice_adjustment_log

Revision ID: z1a2b3c4d5e6
Revises: y1z2a3b4c5d6
Create Date: 2026-05-13 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'z1a2b3c4d5e6'
down_revision: Union[str, None] = 'y1z2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Thêm cột anh_phieu_giao vào sales_invoices
    op.add_column('sales_invoices', sa.Column('anh_phieu_giao', sa.Text(), nullable=True))

    # 2. Tạo bảng invoice_adjustment_logs
    op.create_table(
        'invoice_adjustment_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('sales_invoices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('adjusted_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('adjusted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('loai', sa.String(30), nullable=False),
        # truoc_ket_chuyen | sau_ket_chuyen
        sa.Column('ghi_chu', sa.Text(), nullable=False),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='na'),
        # na (trước KC) | pending | approved | rejected
        sa.Column('approved_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('du_lieu_truoc', sa.Text(), nullable=True),  # JSON snapshot
        sa.Column('du_lieu_sau', sa.Text(), nullable=True),    # JSON snapshot
    )
    op.create_index('ix_invoice_adjustment_logs_invoice_id', 'invoice_adjustment_logs', ['invoice_id'])

    # 3. Seed 3 roles mới
    op.execute("""
        INSERT INTO roles (ma_vai_tro, ten_vai_tro, trang_thai, created_at)
        VALUES
          ('SALE_ADMIN',       'Sale Admin',         true, now()),
          ('KE_TOAN_CONG_NO',  'Kế toán công nợ',   true, now()),
          ('KE_TOAN_TRUONG',   'Kế toán trưởng',    true, now())
        ON CONFLICT (ma_vai_tro) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE ma_vai_tro IN ('SALE_ADMIN','KE_TOAN_CONG_NO','KE_TOAN_TRUONG')")
    op.drop_index('ix_invoice_adjustment_logs_invoice_id', table_name='invoice_adjustment_logs')
    op.drop_table('invoice_adjustment_logs')
    op.drop_column('sales_invoices', 'anh_phieu_giao')
