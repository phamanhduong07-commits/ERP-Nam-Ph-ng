"""Migration: tạo bảng hr_payroll_complaints (Sprint D.5 — Điều 16 Quy chế Lương)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from app.database import engine
from app.models.hr import PayrollComplaint  # noqa: F401


def main() -> None:
    insp = inspect(engine)
    if "hr_payroll_complaints" in insp.get_table_names():
        print("✓ Table hr_payroll_complaints đã tồn tại")
        return
    PayrollComplaint.__table__.create(engine)
    print("✅ Đã tạo bảng hr_payroll_complaints")


if __name__ == "__main__":
    main()
