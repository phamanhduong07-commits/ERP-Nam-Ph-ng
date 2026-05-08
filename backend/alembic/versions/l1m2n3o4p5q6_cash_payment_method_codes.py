"""allow descriptive cash payment method codes

Revision ID: l1m2n3o4p5q6
Revises: k1l2m3n4o5p6
Create Date: 2026-05-06 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "l1m2n3o4p5q6"
down_revision: Union[str, None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_CODES = "'TM', 'CK', 'TM+CK', 'tien_mat', 'chuyen_khoan', 'bu_tru_cong_no', 'khac'"
OLD_CODES = "'TM', 'CK', 'TM+CK'"


def upgrade() -> None:
    op.execute("ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_hinh_thuc_tt_check")
    op.execute(
        f"ALTER TABLE cash_receipts ADD CONSTRAINT cash_receipts_hinh_thuc_tt_check "
        f"CHECK (hinh_thuc_tt IN ({NEW_CODES}))"
    )
    op.execute("ALTER TABLE cash_payments DROP CONSTRAINT IF EXISTS cash_payments_hinh_thuc_tt_check")
    op.execute(
        f"ALTER TABLE cash_payments ADD CONSTRAINT cash_payments_hinh_thuc_tt_check "
        f"CHECK (hinh_thuc_tt IN ({NEW_CODES}))"
    )


def downgrade() -> None:
    op.execute("UPDATE cash_receipts SET hinh_thuc_tt = 'TM' WHERE hinh_thuc_tt = 'tien_mat'")
    op.execute("UPDATE cash_receipts SET hinh_thuc_tt = 'CK' WHERE hinh_thuc_tt <> 'TM'")
    op.execute("UPDATE cash_payments SET hinh_thuc_tt = 'TM' WHERE hinh_thuc_tt = 'tien_mat'")
    op.execute("UPDATE cash_payments SET hinh_thuc_tt = 'CK' WHERE hinh_thuc_tt <> 'TM'")

    op.execute("ALTER TABLE cash_receipts DROP CONSTRAINT IF EXISTS cash_receipts_hinh_thuc_tt_check")
    op.execute(
        f"ALTER TABLE cash_receipts ADD CONSTRAINT cash_receipts_hinh_thuc_tt_check "
        f"CHECK (hinh_thuc_tt IN ({OLD_CODES}))"
    )
    op.execute("ALTER TABLE cash_payments DROP CONSTRAINT IF EXISTS cash_payments_hinh_thuc_tt_check")
    op.execute(
        f"ALTER TABLE cash_payments ADD CONSTRAINT cash_payments_hinh_thuc_tt_check "
        f"CHECK (hinh_thuc_tt IN ({OLD_CODES}))"
    )
