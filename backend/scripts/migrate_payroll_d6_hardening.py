"""Migration: Sprint D.6 hardening — UNIQUE PayrollRun + ondelete FK.

Áp:
1. UNIQUE(employee_id, thang, nam) trên hr_payroll_runs (chặn race condition E.1)
2. ondelete=SET NULL cho hr_payroll_audit_logs.employee_id, user_id (C.1, C.3)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text
from app.database import engine


def main() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        # 1. UNIQUE constraint
        existing_uniques = [u["name"] for u in insp.get_unique_constraints("hr_payroll_runs")]
        if "uq_payroll_emp_period" not in existing_uniques:
            # Trước khi tạo UNIQUE, dọn duplicate nếu có (giữ row có id lớn nhất = mới nhất)
            conn.execute(text("""
                DELETE FROM hr_payroll_runs a
                USING hr_payroll_runs b
                WHERE a.id < b.id
                  AND a.employee_id = b.employee_id
                  AND a.thang = b.thang
                  AND a.nam = b.nam
            """))
            conn.execute(text("""
                ALTER TABLE hr_payroll_runs
                ADD CONSTRAINT uq_payroll_emp_period
                UNIQUE (employee_id, thang, nam)
            """))
            print("✅ Thêm UNIQUE(employee_id, thang, nam) cho hr_payroll_runs")
        else:
            print("✓ UNIQUE uq_payroll_emp_period đã tồn tại")

        # 2. ondelete SET NULL cho audit log FKs
        # Drop + recreate FK với ondelete
        for col, fk_name in [
            ("employee_id", "hr_payroll_audit_logs_employee_id_fkey"),
            ("user_id", "hr_payroll_audit_logs_user_id_fkey"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE hr_payroll_audit_logs DROP CONSTRAINT {fk_name}"))
            except Exception as e:
                print(f"   Drop FK {fk_name}: {e}")
            ref_table = "hr_employees" if col == "employee_id" else "users"
            conn.execute(text(f"""
                ALTER TABLE hr_payroll_audit_logs
                ADD CONSTRAINT {fk_name}
                FOREIGN KEY ({col}) REFERENCES {ref_table}(id) ON DELETE SET NULL
            """))
            print(f"✅ FK {col} → {ref_table} ondelete=SET NULL")


if __name__ == "__main__":
    main()
