"""Migration: tạo bảng hr_payroll_audit_logs (Sprint D.6 — GAP-7 audit log)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from app.database import engine
from app.models.hr import PayrollAuditLog  # noqa: F401


def main() -> None:
    insp = inspect(engine)
    if "hr_payroll_audit_logs" in insp.get_table_names():
        print("✓ Table hr_payroll_audit_logs đã tồn tại")
        return
    PayrollAuditLog.__table__.create(engine)
    print("✅ Đã tạo bảng hr_payroll_audit_logs")


if __name__ == "__main__":
    main()
