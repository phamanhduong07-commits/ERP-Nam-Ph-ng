"""Migration: tạo 5 bảng cho module KPI/Performance.

- hr_kpi_templates
- hr_kpi_criteria
- hr_kpi_cycles
- hr_kpi_evaluations
- hr_kpi_scores

Idempotent.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from app.database import engine
from app.models.hr import (  # noqa: F401
    KPITemplate, KPICriteria, KPICycle, KPIEvaluation, KPIScore,
)


def main() -> None:
    insp = inspect(engine)
    existing = set(insp.get_table_names())
    targets = [
        ("hr_kpi_templates", KPITemplate),
        ("hr_kpi_criteria", KPICriteria),
        ("hr_kpi_cycles", KPICycle),
        ("hr_kpi_evaluations", KPIEvaluation),
        ("hr_kpi_scores", KPIScore),
    ]
    for name, model in targets:
        if name in existing:
            print(f"✓ {name} đã tồn tại")
            continue
        model.__table__.create(engine)
        print(f"✅ Đã tạo bảng {name}")


if __name__ == "__main__":
    main()
