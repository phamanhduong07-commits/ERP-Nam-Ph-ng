"""cd2 may_in phieu_in

Revision ID: c3a1d84e9f20
Revises: b7e4f291a053
Create Date: 2026-04-28

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3a1d84e9f20'
down_revision: Union[str, None] = 'b7e4f291a053'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'may_in',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ten_may', sa.String(50), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'phieu_in',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('so_phieu', sa.String(30), nullable=False),
        sa.Column('production_order_id', sa.Integer(), sa.ForeignKey('production_orders.id'), nullable=True),
        sa.Column('may_in_id', sa.Integer(), sa.ForeignKey('may_in.id'), nullable=True),
        sa.Column('trang_thai', sa.String(20), nullable=False, server_default='cho_in'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ten_hang', sa.String(255), nullable=True),
        sa.Column('ma_kh', sa.String(50), nullable=True),
        sa.Column('ten_khach_hang', sa.String(255), nullable=True),
        sa.Column('quy_cach', sa.String(100), nullable=True),
        sa.Column('so_luong_phoi', sa.Numeric(12, 3), nullable=True),
        sa.Column('ngay_lenh', sa.Date(), nullable=True),
        sa.Column('loai_in', sa.String(50), nullable=True),
        sa.Column('so_don', sa.String(50), nullable=True),
        sa.Column('ngay_giao_hang', sa.Date(), nullable=True),
        sa.Column('ghi_chu', sa.Text(), nullable=True),
        sa.Column('ngay_in', sa.Date(), nullable=True),
        sa.Column('ca', sa.String(20), nullable=True),
        sa.Column('so_luong_in_ok', sa.Numeric(12, 3), nullable=True),
        sa.Column('so_luong_loi', sa.Numeric(12, 3), nullable=True),
        sa.Column('ghi_chu_ket_qua', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('so_phieu'),
    )

    # Seed 3 default printers
    op.execute("INSERT INTO may_in (ten_may, sort_order, active) VALUES ('Máy In 1', 1, true)")
    op.execute("INSERT INTO may_in (ten_may, sort_order, active) VALUES ('Máy In 2', 2, true)")
    op.execute("INSERT INTO may_in (ten_may, sort_order, active) VALUES ('Máy In 3', 3, true)")


def downgrade() -> None:
    op.drop_table('phieu_in')
    op.drop_table('may_in')
