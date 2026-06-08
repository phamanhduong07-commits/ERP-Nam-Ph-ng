"""Create defect_records unified table and migrate from hang_loi_kho_ao + hang_loi_phoi_kho_ao

Revision ID: zmh017
Revises: zmh016
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'zmh017'
down_revision = 'zmh016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'defect_records',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('ref_type', sa.String(50), nullable=False),
        sa.Column('ref_id', sa.Integer, nullable=False),
        sa.Column('khau', sa.String(20), nullable=False),
        sa.Column('so_luong', sa.Numeric(12, 3), nullable=False),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='cho_xu_ly'),
        sa.Column('ghi_chu', sa.Text, nullable=True),
        sa.Column('production_order_id_tan_dung', sa.Integer,
                  sa.ForeignKey('production_orders.id'), nullable=True),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('ref_type', 'ref_id', name='uq_defect_records_ref'),
    )
    op.create_index('ix_defect_records_trang_thai', 'defect_records', ['trang_thai'])
    op.create_index('ix_defect_records_khau', 'defect_records', ['khau'])

    # Migrate from hang_loi_kho_ao (TP lỗi, khau='tp')
    conn = op.get_bind()
    conn.execute(text("""
        INSERT INTO defect_records
            (ref_type, ref_id, khau, so_luong, trang_thai, ghi_chu, created_by, created_at, updated_at)
        SELECT
            'production_output',
            production_output_id,
            'tp',
            so_luong,
            trang_thai,
            ghi_chu,
            created_by,
            created_at,
            updated_at
        FROM hang_loi_kho_ao
        WHERE NOT EXISTS (
            SELECT 1 FROM defect_records dr
            WHERE dr.ref_type = 'production_output' AND dr.ref_id = hang_loi_kho_ao.production_output_id
        )
    """))

    # Migrate from hang_loi_phoi_kho_ao (Phôi lỗi, khau='cd1')
    conn.execute(text("""
        INSERT INTO defect_records
            (ref_type, ref_id, khau, so_luong, trang_thai, ghi_chu,
             production_order_id_tan_dung, created_by, created_at, updated_at)
        SELECT
            'phieu_nhap_phoi_song_item',
            phieu_nhap_phoi_song_item_id,
            'cd1',
            so_luong,
            trang_thai,
            ghi_chu,
            production_order_id_tan_dung,
            created_by,
            created_at,
            updated_at
        FROM hang_loi_phoi_kho_ao
        WHERE NOT EXISTS (
            SELECT 1 FROM defect_records dr
            WHERE dr.ref_type = 'phieu_nhap_phoi_song_item'
              AND dr.ref_id = hang_loi_phoi_kho_ao.phieu_nhap_phoi_song_item_id
        )
    """))


def downgrade() -> None:
    op.drop_index('ix_defect_records_khau', table_name='defect_records')
    op.drop_index('ix_defect_records_trang_thai', table_name='defect_records')
    op.drop_table('defect_records')
