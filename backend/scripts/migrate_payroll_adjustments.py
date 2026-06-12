"""Migration: tạo bảng hr_payroll_adjustments (Sprint D.4)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from app.database import engine
from app.models.hr import PayrollAdjustment  # noqa: F401


def main() -> None:
    insp = inspect(engine)
    if "hr_payroll_adjustments" in insp.get_table_names():
        print("✓ Table hr_payroll_adjustments đã tồn tại")
        return
    PayrollAdjustment.__table__.create(engine)
    print("✅ Đã tạo bảng hr_payroll_adjustments")


if __name__ == "__main__":
    main()
