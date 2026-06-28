"""Add phan_xuong_id to delivery_post_tasks

Revision ID: zmh049
Revises: da1f6657a415
Create Date: 2026-06-28

"""
import sqlalchemy as sa
from alembic import op

revision = "zmh049"
down_revision = "da1f6657a415"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("delivery_post_tasks", sa.Column("phan_xuong_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_delivery_post_tasks_phan_xuong",
        "delivery_post_tasks", "phan_xuong",
        ["phan_xuong_id"], ["id"],
    )
    op.create_index("ix_delivery_post_tasks_phan_xuong_id", "delivery_post_tasks", ["phan_xuong_id"])

    # Backfill: lấy phan_xuong_id từ DeliveryOrderItem → ProductionOrder
    op.get_bind().execute(sa.text("""
        UPDATE delivery_post_tasks AS dpt
        SET phan_xuong_id = po.phan_xuong_id
        FROM delivery_order_items AS doi
        JOIN production_orders AS po ON po.id = doi.production_order_id
        WHERE dpt.item_id = doi.id
          AND doi.production_order_id IS NOT NULL
          AND po.phan_xuong_id IS NOT NULL
    """))


def downgrade():
    op.drop_index("ix_delivery_post_tasks_phan_xuong_id", table_name="delivery_post_tasks")
    op.drop_constraint("fk_delivery_post_tasks_phan_xuong", "delivery_post_tasks", type_="foreignkey")
    op.drop_column("delivery_post_tasks", "phan_xuong_id")
