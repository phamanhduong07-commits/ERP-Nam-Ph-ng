"""warehouse capacity fields + standardize loai_kho

Revision ID: c1d2e3f4a5b6
Revises: f2a3b4c5d6e7
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Thêm 3 cột capacity vào warehouses (idempotent)
    for col_name, col_def in [
        ('dien_tich', sa.Column('dien_tich', sa.Float(), nullable=True)),
        ('suc_chua', sa.Column('suc_chua', sa.Float(), nullable=True)),
        ('don_vi_suc_chua', sa.Column('don_vi_suc_chua', sa.String(20), nullable=True)),
    ]:
        res = conn.execute(sa.text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name='warehouses' AND column_name=:col"
        ), {"col": col_name})
        if res.scalar() == 0:
            op.add_column('warehouses', col_def)

    # Chuẩn hóa loai_kho: ban_thanh_pham → PHOI (chỉ kho gắn với xưởng)
    op.execute(sa.text(
        "UPDATE warehouses SET loai_kho = 'PHOI' "
        "WHERE loai_kho = 'ban_thanh_pham' AND phan_xuong_id IS NOT NULL"
    ))
    # thanh_pham → THANH_PHAM (nếu gắn xưởng)
    op.execute(sa.text(
        "UPDATE warehouses SET loai_kho = 'THANH_PHAM' "
        "WHERE loai_kho = 'thanh_pham' AND phan_xuong_id IS NOT NULL"
    ))
    # nguyen_lieu → GIAY_CUON (nếu gắn xưởng cd1_cd2)
    op.execute(sa.text(
        "UPDATE warehouses SET loai_kho = 'GIAY_CUON' "
        "WHERE loai_kho = 'nguyen_lieu' AND phan_xuong_id IN ("
        "  SELECT id FROM phan_xuong WHERE cong_doan = 'cd1_cd2'"
        ")"
    ))


def downgrade() -> None:
    op.execute(sa.text("UPDATE warehouses SET loai_kho = 'ban_thanh_pham' WHERE loai_kho = 'PHOI'"))
    op.execute(sa.text("UPDATE warehouses SET loai_kho = 'thanh_pham' WHERE loai_kho = 'THANH_PHAM'"))
    op.execute(sa.text("UPDATE warehouses SET loai_kho = 'nguyen_lieu' WHERE loai_kho IN ('GIAY_CUON', 'NVL_PHU')"))
    op.drop_column('warehouses', 'don_vi_suc_chua')
    op.drop_column('warehouses', 'suc_chua')
    op.drop_column('warehouses', 'dien_tich')
