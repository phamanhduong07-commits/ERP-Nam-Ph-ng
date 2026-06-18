"""incoming_invoices: them phap_nhan_id FK + backfill tu buyer_tax_code

Revision ID: zmh033
Revises: zmh032
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh033'
down_revision = 'zmh032'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('incoming_invoices') as batch_op:
        batch_op.add_column(sa.Column('phap_nhan_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_incoming_invoices_phap_nhan',
            'phap_nhan',
            ['phap_nhan_id'], ['id']
        )
        batch_op.create_index('ix_incoming_invoices_phap_nhan_id', ['phap_nhan_id'])

    # Backfill: khớp buyer_tax_code với phap_nhan.ma_so_thue
    op.execute("""
        UPDATE incoming_invoices
        SET phap_nhan_id = (
            SELECT id FROM phap_nhan
            WHERE ma_so_thue = incoming_invoices.buyer_tax_code
            LIMIT 1
        )
        WHERE buyer_tax_code IS NOT NULL AND phap_nhan_id IS NULL
    """)


def downgrade() -> None:
    with op.batch_alter_table('incoming_invoices') as batch_op:
        batch_op.drop_index('ix_incoming_invoices_phap_nhan_id')
        batch_op.drop_constraint('fk_incoming_invoices_phap_nhan', type_='foreignkey')
        batch_op.drop_column('phap_nhan_id')
