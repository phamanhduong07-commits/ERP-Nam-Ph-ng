"""add trang_thai_loi to phieu_nhap_phoi_song_items and create hang_loi_phoi_kho_ao

Revision ID: zmh016
Revises: zmh015
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh016'
down_revision = 'zmh015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A: thêm cột trang_thai_loi vào phieu_nhap_phoi_song_items
    op.add_column('phieu_nhap_phoi_song_items', sa.Column(
        'trang_thai_loi', sa.String(20), nullable=True,
    ))
    # Backfill: item nào có phôi lỗi thì set cho_xu_ly
    op.execute(
        "UPDATE phieu_nhap_phoi_song_items SET trang_thai_loi='cho_xu_ly' "
        "WHERE so_luong_loi > 0 AND trang_thai_loi IS NULL"
    )

    # B: tạo bảng hang_loi_phoi_kho_ao
    op.create_table(
        'hang_loi_phoi_kho_ao',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('phieu_nhap_phoi_song_item_id', sa.Integer,
                  sa.ForeignKey('phieu_nhap_phoi_song_items.id'), unique=True, nullable=False),
        sa.Column('so_luong', sa.Numeric(12, 3), nullable=False),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='cho_xu_ly'),
        sa.Column('ghi_chu', sa.Text, nullable=True),
        sa.Column('production_order_id_tan_dung', sa.Integer,
                  sa.ForeignKey('production_orders.id'), nullable=True),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_hang_loi_phoi_kho_ao_item_id', 'hang_loi_phoi_kho_ao',
                    ['phieu_nhap_phoi_song_item_id'])
    op.create_index('ix_hang_loi_phoi_kho_ao_trang_thai', 'hang_loi_phoi_kho_ao', ['trang_thai'])


def downgrade() -> None:
    op.drop_index('ix_hang_loi_phoi_kho_ao_trang_thai', table_name='hang_loi_phoi_kho_ao')
    op.drop_index('ix_hang_loi_phoi_kho_ao_item_id', table_name='hang_loi_phoi_kho_ao')
    op.drop_table('hang_loi_phoi_kho_ao')
    op.drop_column('phieu_nhap_phoi_song_items', 'trang_thai_loi')
