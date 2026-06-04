"""add accounting period locks

Revision ID: acclock001
Revises: zmh013
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa


revision = "acclock001"
down_revision = "zmh013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounting_period_locks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("thang", sa.SmallInteger(), nullable=False),
        sa.Column("nam", sa.Integer(), nullable=False),
        sa.Column("phap_nhan_id", sa.Integer(), nullable=False),
        sa.Column("trang_thai", sa.String(length=20), nullable=False),
        sa.Column("closing_entry_id", sa.Integer(), nullable=True),
        sa.Column("locked_by", sa.Integer(), nullable=True),
        sa.Column("unlocked_by", sa.Integer(), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ly_do_khoa", sa.Text(), nullable=True),
        sa.Column("ly_do_mo_khoa", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["closing_entry_id"], ["journal_entries.id"]),
        sa.ForeignKeyConstraint(["locked_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["phap_nhan_id"], ["phap_nhan.id"]),
        sa.ForeignKeyConstraint(["unlocked_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("thang", "nam", "phap_nhan_id", name="uq_accounting_period_lock_period_entity"),
    )
    op.create_index(
        op.f("ix_accounting_period_locks_phap_nhan_id"),
        "accounting_period_locks",
        ["phap_nhan_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_accounting_period_locks_phap_nhan_id"), table_name="accounting_period_locks")
    op.drop_table("accounting_period_locks")
