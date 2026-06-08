"""add trang_thai_loi to production_outputs and create hang_loi_kho_ao

Revision ID: zmh015
Revises: zmh014
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh015'
down_revision = 'acctidx002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A: thêm cột trang_thai_loi vào production_outputs
    op.add_column('production_outputs', sa.Column(
        'trang_thai_loi', sa.String(20), nullable=True,
    ))
    # Backfill: record nào có lỗi thì set cho_xu_ly
    op.execute(
        "UPDATE production_outputs SET trang_thai_loi='cho_xu_ly' "
        "WHERE so_luong_loi > 0 AND trang_thai_loi IS NULL"
    )

    # B: tạo bảng hang_loi_kho_ao
    op.create_table(
        'hang_loi_kho_ao',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('production_output_id', sa.Integer,
                  sa.ForeignKey('production_outputs.id'), unique=True, nullable=False),
        sa.Column('so_luong', sa.Numeric(12, 3), nullable=False),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='cho_xu_ly'),
        sa.Column('nguyen_nhan', sa.Text, nullable=True),
        sa.Column('bien_phap_xu_ly', sa.Text, nullable=True),
        sa.Column('nguoi_xu_ly_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('han_xu_ly', sa.Date, nullable=True),
        sa.Column('ghi_chu', sa.Text, nullable=True),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_hang_loi_kho_ao_production_output_id', 'hang_loi_kho_ao', ['production_output_id'])
    op.create_index('ix_hang_loi_kho_ao_trang_thai', 'hang_loi_kho_ao', ['trang_thai'])


def downgrade() -> None:
    op.drop_index('ix_hang_loi_kho_ao_trang_thai', table_name='hang_loi_kho_ao')
    op.drop_index('ix_hang_loi_kho_ao_production_output_id', table_name='hang_loi_kho_ao')
    op.drop_table('hang_loi_kho_ao')
    op.drop_column('production_outputs', 'trang_thai_loi')
