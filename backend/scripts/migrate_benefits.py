"""Sprint Phúc Lợi migration: create hr_benefit_policies + hr_benefit_records.

Idempotent — sử dụng Base.metadata.create_all(checkfirst=True).

Usage:
    python scripts/migrate_benefits.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import engine, Base
from app.models import hr as hr_models


def main() -> None:
    print("─── CREATE TABLES benefit policies + records (if not exists) ───")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            hr_models.BenefitPolicy.__table__,
            hr_models.BenefitRecord.__table__,
        ],
        checkfirst=True,
    )
    print("  ✓ hr_benefit_policies")
    print("  ✓ hr_benefit_records")
    print()
    print("Done.")


if __name__ == "__main__":
    main()
