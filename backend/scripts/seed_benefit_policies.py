"""Seed 9 chính sách phúc lợi mặc định cho công ty Việt Nam điển hình.

Idempotent — skip nếu đã tồn tại (theo loai).

Usage:
    python scripts/seed_benefit_policies.py
"""
from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.hr import BenefitPolicy


DEFAULTS = [
    ("Sinh nhật nhân viên",      "sinh_nhat",  500_000,  "all",    "Quà sinh nhật tặng nhân viên (tự sinh hàng ngày bằng cron)"),
    ("Hiếu (đám tang gia đình)", "hieu",       2_000_000, "all",   "Hỗ trợ khi gia đình NV (bố/mẹ/vợ/chồng/con) qua đời"),
    ("Hỉ (kết hôn nhân viên)",   "hi",         1_000_000, "all",   "Mừng cưới nhân viên"),
    ("Sinh con",                 "sinh_con",   1_000_000, "all",   "Mừng nhân viên sinh con"),
    ("Tết Âm Lịch",              "tet_am",     2_000_000, "all",   "Thưởng Tết Nguyên Đán"),
    ("Lễ 30/4 - 1/5",            "le_30_4",    300_000,  "all",    "Thưởng Lễ Chiến thắng + Lao động Quốc tế"),
    ("Lễ Quốc Khánh 2/9",        "le_2_9",     300_000,  "all",    "Thưởng Quốc khánh"),
    ("Quốc tế Phụ nữ 8/3",       "le_8_3",     300_000,  "female", "Tặng nhân viên nữ"),
    ("Phụ nữ Việt Nam 20/10",    "le_20_10",   300_000,  "female", "Tặng nhân viên nữ"),
    ("Tết Trung thu",            "trung_thu",  200_000,  "all",    "Quà Trung thu cho gia đình NV"),
]


def main() -> None:
    with SessionLocal() as db:
        created = skipped = 0
        for ten, loai, muc, ap_dung, mo_ta in DEFAULTS:
            existing = db.query(BenefitPolicy).filter(BenefitPolicy.loai == loai).first()
            if existing:
                skipped += 1
                print(f"  - SKIP  {loai:<12} (đã có id={existing.id})")
                continue
            db.add(BenefitPolicy(
                ten=ten, loai=loai,
                muc_tien=Decimal(muc),
                ap_dung_cho=ap_dung,
                mo_ta=mo_ta,
                is_active=True,
            ))
            created += 1
            print(f"  + ADD   {loai:<12} {ten:<30} {muc:>12,d}đ ({ap_dung})")
        db.commit()
        print()
        print(f"Created: {created}  ·  Skipped: {skipped}")


if __name__ == "__main__":
    main()
