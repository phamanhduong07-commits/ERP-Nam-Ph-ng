"""Migration: tạo 4 bảng cho module An toàn lao động.

- hr_safety_equipments        — danh mục BHLĐ
- hr_safety_equipment_issues  — lần cấp phát BHLĐ cho NV
- hr_safety_trainings         — buổi huấn luyện ATVSLĐ
- hr_safety_training_participants — NV tham gia buổi huấn luyện
- hr_work_accidents           — báo cáo TNLĐ

Idempotent.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from app.database import engine
from app.models.hr import (  # noqa: F401 — register vào Base.metadata
    SafetyEquipment, SafetyEquipmentIssue,
    SafetyTraining, SafetyTrainingParticipant,
    WorkAccident,
)


def main() -> None:
    insp = inspect(engine)
    existing = set(insp.get_table_names())

    targets = [
        ("hr_safety_equipments", SafetyEquipment),
        ("hr_safety_equipment_issues", SafetyEquipmentIssue),
        ("hr_safety_trainings", SafetyTraining),
        ("hr_safety_training_participants", SafetyTrainingParticipant),
        ("hr_work_accidents", WorkAccident),
    ]
    for name, model in targets:
        if name in existing:
            print(f"✓ {name} đã tồn tại")
            continue
        model.__table__.create(engine)
        print(f"✅ Đã tạo bảng {name}")


if __name__ == "__main__":
    main()
