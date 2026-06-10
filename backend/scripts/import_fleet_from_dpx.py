"""Import vehicles + drivers + helpers from DIEU PHOI XE (fleet.db) into ERP Nam Phương.

One-shot, idempotent. UPSERT by:
- Xe.bien_so (unique)
- TaiXe.ho_ten (no unique constraint in DB, but we treat as natural key here)
- LoXe.ho_ten (same)

Usage:
    python scripts/import_fleet_from_dpx.py --dry-run   # preview only
    python scripts/import_fleet_from_dpx.py             # commit

Requires:
- fleet.db readable at the path passed via --src (default: C:/DIEU PHOI XE/backend/fleet.db)
- ERP DATABASE_URL working (reads .env via app.config)
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

# Allow `python scripts/import_fleet_from_dpx.py` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.master import Xe, TaiXe, LoXe


VEHICLE_TYPE_MAP = {
    "TRUCK": "Xe tải",
    "CONTAINER_TRAILER": "Đầu kéo container",
    "SEDAN": "Xe con",
}

BUSINESS_UNIT_LABEL = {
    1: "Nam Phương",
    2: "Visunpack",
}


def _loai_xe_label(vehicle_type: str | None, brand: str | None, model: str | None) -> str | None:
    base = VEHICLE_TYPE_MAP.get((vehicle_type or "").upper(), vehicle_type)
    suffix_parts = [p for p in (brand, model) if p]
    if suffix_parts:
        return f"{base} ({' '.join(suffix_parts)})"
    return base


def _ghi_chu_for_vehicle(business_unit_id: int | None, status: str, notes: str | None) -> str | None:
    parts = []
    bu = BUSINESS_UNIT_LABEL.get(business_unit_id or 0)
    if bu:
        parts.append(f"Đơn vị: {bu}")
    if status and status.upper() == "DISPOSED":
        parts.append("Đã thanh lý (DISPOSED)")
    if notes:
        parts.append(notes)
    return " · ".join(parts) if parts else None


def import_vehicles(src: sqlite3.Connection, db, dry_run: bool) -> tuple[int, int]:
    rows = src.execute(
        "SELECT plate_number, vehicle_type, brand, model, status, business_unit_id, notes "
        "FROM vehicles WHERE deleted_at IS NULL"
    ).fetchall()

    inserted = updated = 0
    for plate, vtype, brand, model, status, bu_id, notes in rows:
        if not plate:
            continue
        existing = db.query(Xe).filter(Xe.bien_so == plate).first()
        loai = _loai_xe_label(vtype, brand, model)
        ghi_chu = _ghi_chu_for_vehicle(bu_id, status, notes)
        is_active = (status or "").upper() == "ACTIVE"

        if existing:
            existing.loai_xe = existing.loai_xe or loai
            existing.ghi_chu = existing.ghi_chu or ghi_chu
            # Don't auto-flip trang_thai of active xe — only set if currently default
            if existing.trang_thai is True and not is_active:
                existing.trang_thai = False
            updated += 1
            print(f"  UPDATE  {plate:<12} {loai}")
        else:
            db.add(Xe(
                bien_so=plate,
                loai_xe=loai,
                ghi_chu=ghi_chu,
                trang_thai=is_active,
            ))
            inserted += 1
            print(f"  INSERT  {plate:<12} {loai}{' [DISPOSED]' if not is_active else ''}")

    if not dry_run:
        db.commit()
    else:
        db.rollback()
    return inserted, updated


def import_people(src: sqlite3.Connection, db, dry_run: bool) -> tuple[int, int, int, int]:
    rows = src.execute(
        "SELECT full_name, phone, license_class, license_number, position "
        "FROM drivers WHERE deleted_at IS NULL"
    ).fetchall()

    drv_ins = drv_upd = hlp_ins = hlp_upd = 0
    for name, phone, lic_class, lic_no, pos in rows:
        name = (name or "").strip()
        if not name:
            continue
        pos = (pos or "DRIVER").upper()

        if pos == "DRIVER":
            existing = db.query(TaiXe).filter(TaiXe.ho_ten == name).first()
            license_str = lic_no or lic_class or None
            if existing:
                existing.so_dien_thoai = existing.so_dien_thoai or phone
                existing.so_bang_lai = existing.so_bang_lai or license_str
                drv_upd += 1
                print(f"  DRIVER UPDATE  {name}")
            else:
                db.add(TaiXe(
                    ho_ten=name,
                    so_dien_thoai=phone,
                    so_bang_lai=license_str,
                    trang_thai=True,
                ))
                drv_ins += 1
                print(f"  DRIVER INSERT  {name}")
        else:  # HELPER
            existing = db.query(LoXe).filter(LoXe.ho_ten == name).first()
            if existing:
                existing.so_dien_thoai = existing.so_dien_thoai or phone
                hlp_upd += 1
                print(f"  HELPER UPDATE  {name}")
            else:
                db.add(LoXe(
                    ho_ten=name,
                    so_dien_thoai=phone,
                    trang_thai=True,
                ))
                hlp_ins += 1
                print(f"  HELPER INSERT  {name}")

    if not dry_run:
        db.commit()
    else:
        db.rollback()
    return drv_ins, drv_upd, hlp_ins, hlp_upd


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", default=r"C:/DIEU PHOI XE/backend/fleet.db",
                        help="Path to DIEU PHOI XE fleet.db")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview only, no DB writes")
    args = parser.parse_args()

    src_path = Path(args.src)
    if not src_path.exists():
        print(f"ERROR: source DB not found: {src_path}")
        sys.exit(2)

    print(f"Source : {src_path}")
    print(f"Mode   : {'DRY-RUN (no commit)' if args.dry_run else 'COMMIT'}")
    print()

    src = sqlite3.connect(f"file:{src_path}?mode=ro", uri=True)
    db = SessionLocal()
    try:
        print("=== Vehicles (Xe) ===")
        v_ins, v_upd = import_vehicles(src, db, args.dry_run)

        print()
        print("=== Drivers (TaiXe) + Helpers (LoXe) ===")
        drv_ins, drv_upd, hlp_ins, hlp_upd = import_people(src, db, args.dry_run)

        print()
        print("─" * 60)
        print(f"Xe     : {v_ins} INSERT  ·  {v_upd} UPDATE")
        print(f"TaiXe  : {drv_ins} INSERT  ·  {drv_upd} UPDATE")
        print(f"LoXe   : {hlp_ins} INSERT  ·  {hlp_upd} UPDATE")
        if args.dry_run:
            print()
            print("DRY-RUN — không có thay đổi nào được lưu. Chạy lại không có --dry-run để commit.")
    finally:
        db.close()
        src.close()


if __name__ == "__main__":
    main()
