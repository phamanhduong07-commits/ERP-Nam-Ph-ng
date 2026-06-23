"""material_issue session link + ton_kho other_materials

Revision ID: zmh037
Revises: zmh036
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'zmh037'
down_revision = 'zmh036'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Thêm ton_kho vào other_materials
    op.add_column(
        'other_materials',
        sa.Column('ton_kho', sa.Numeric(12, 3), nullable=False, server_default='0'),
    )

    # 2. Thêm production_session_id vào material_issues
    op.add_column(
        'material_issues',
        sa.Column('production_session_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_mi_production_session',
        'material_issues', 'production_sessions',
        ['production_session_id'], ['id'],
        ondelete='SET NULL',
    )

    # 3. production_order_id và warehouse_id → nullable (bảng đang rỗng, an toàn)
    op.alter_column('material_issues', 'production_order_id',
                    existing_type=sa.Integer(), nullable=True)
    op.alter_column('material_issues', 'warehouse_id',
                    existing_type=sa.Integer(), nullable=True)


def downgrade():
    op.alter_column('material_issues', 'warehouse_id',
                    existing_type=sa.Integer(), nullable=False)
    op.alter_column('material_issues', 'production_order_id',
                    existing_type=sa.Integer(), nullable=False)
    op.drop_constraint('fk_mi_production_session', 'material_issues', type_='foreignkey')
    op.drop_column('material_issues', 'production_session_id')
    op.drop_column('other_materials', 'ton_kho')
