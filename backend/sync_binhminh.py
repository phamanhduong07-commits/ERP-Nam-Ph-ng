"""
Script đồng bộ nhiên liệu từ Bình Minh — chạy trực tiếp (không cần server running).

Dùng khi: server restart, cần backfill dữ liệu bị miss.

Cách dùng:
  python sync_binhminh.py              # sync ngày hôm nay
  python sync_binhminh.py 2026-05-20  # sync ngày cụ thể
  python sync_binhminh.py 2026-05-19 2026-05-21  # sync từ ngày đến ngày

Cách thêm serial xe mới:
  Vào systemroute.gpsbinhminh.vn → F12 Network → Báo cáo nhiên liệu → bấm Tìm kiếm
  Xem request TongHopNlBySerialListV2 → Payload = [<serial>], Response có field 'Bs' = biển số
  Sửa file app/data/binhminh_serials.json thêm {"BIENSOX": serial_int}
"""
import asyncio
import json
import os
import sys
from datetime import date, timedelta

# Fix Windows console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import httpx

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERIALS_PATH = os.path.join(BASE_DIR, "app", "data", "binhminh_serials.json")

# Đọc config qua pydantic settings (đọc cả default lẫn .env)
sys.path.insert(0, BASE_DIR)
from app.config import settings

TOKEN = settings.GPS_BINHMINH_TOKEN
SYSTEM_URL = settings.GPS_BINHMINH_SYSTEM_URL
COMPANY_ID = settings.GPS_PAGE_IDS
DB_URL = settings.DATABASE_URL


def load_serials() -> dict[str, int]:
    if os.path.exists(SERIALS_PATH):
        with open(SERIALS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return {k.upper().replace("-", "").replace(" ", ""): int(v) for k, v in data.items()}
    return {}


async def sync_one_day(ngay: date, serial_list: list[int]) -> dict:
    mm_dd_yyyy = ngay.strftime("%m/%d/%Y")
    url = f"{SYSTEM_URL}/api/LogManager/TongHopNlBySerialListV2"
    params = {
        "companyId": COMPANY_ID,
        "beginTime": f"00:00:00 {mm_dd_yyyy}",
        "endTime": f"23:59:59 {mm_dd_yyyy}",
    }
    headers = {
        "token": TOKEN,
        "x-access-token": TOKEN,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://gpsbinhminh.vn",
        "Referer": "https://gpsbinhminh.vn/",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, params=params, headers=headers, json=serial_list)
        r.raise_for_status()
        raw = r.json()

    if raw.get("Status") != 1:
        raise ValueError(f"API error: {raw.get('Description')}")

    records = raw.get("TongHopNlTranfers") or []
    return {"ngay": ngay.isoformat(), "records": records}


def parse_fills(fv: str, times: str, locs: str, types: str) -> list[dict]:
    fvs = [v.strip() for v in fv.rstrip(";").split(";") if v.strip()]
    tms = [v.strip() for v in times.rstrip(";").split(";") if v.strip()]
    fills = []
    for i, f in enumerate(fvs):
        try:
            fills.append({"so_lit": float(f), "gio": tms[i] if i < len(tms) else None})
        except ValueError:
            pass
    return fills


def save_to_db(records_by_day: list[tuple[date, list]]) -> int:
    """Upsert records vào DB trực tiếp qua SQLAlchemy."""
    if not DB_URL:
        print("[WARN] DATABASE_URL không tìm thấy trong .env — bỏ qua lưu DB")
        return 0

    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import Session
    except ImportError:
        print("[ERR] sqlalchemy chưa cài: pip install sqlalchemy")
        return 0

    engine = create_engine(DB_URL)
    total = 0

    with Session(engine) as session:
        for ngay, records in records_by_day:
            for r in records:
                plate = (r.get("Bs") or "").strip().upper()
                if not plate:
                    continue
                fills = parse_fills(
                    str(r.get("FuelValue") or ""),
                    str(r.get("ThayDoiNlTime") or ""),
                    str(r.get("ActionLocation") or ""),
                    str(r.get("DeviceStatusType") or ""),
                )
                fills_json = json.dumps(fills, ensure_ascii=False) if fills else None

                session.execute(text("""
                    INSERT INTO gps_binhminh_daily
                        (bien_so, ngay, km_odometer, nl_dau_ngay, nl_tieu_thu, dung_tich_binh, fills_json, synced_at)
                    VALUES
                        (:bs, :ngay, :km, :nl_dau, :nl_tieu, :dung_tich, :fills, NOW())
                    ON CONFLICT (bien_so, ngay) DO UPDATE SET
                        km_odometer = EXCLUDED.km_odometer,
                        nl_dau_ngay = EXCLUDED.nl_dau_ngay,
                        nl_tieu_thu = EXCLUDED.nl_tieu_thu,
                        dung_tich_binh = EXCLUDED.dung_tich_binh,
                        fills_json = EXCLUDED.fills_json,
                        synced_at = NOW()
                """), {
                    "bs": plate,
                    "ngay": ngay,
                    "km": float(r.get("KmGps") or 0),
                    "nl_dau": float(r.get("NhienLieuDauNgay") or 0),
                    "nl_tieu": float(r.get("NhienLieuTieuThu") or 0),
                    "dung_tich": float(r.get("DungTichBinh") or 0),
                    "fills": fills_json,
                })
                total += 1
        session.commit()
    return total


async def main():
    args = sys.argv[1:]
    today = date.today()

    if len(args) == 0:
        days = [today]
    elif len(args) == 1:
        days = [date.fromisoformat(args[0])]
    else:
        start = date.fromisoformat(args[0])
        end = date.fromisoformat(args[1])
        days = [start + timedelta(i) for i in range((end - start).days + 1)]

    if not TOKEN:
        print("[ERR] GPS_BINHMINH_TOKEN chưa set trong .env")
        sys.exit(1)

    serial_map = load_serials()
    if not serial_map:
        print("[ERR] Không có serial nào trong app/data/binhminh_serials.json")
        print("      Thêm bằng cách: sửa file, format: {\"51L78276\": 679316178, ...}")
        sys.exit(1)

    serial_list = list(set(serial_map.values()))
    print(f"Serials: {serial_list} ({len(serial_list)} xe)")
    print(f"Sync ngày: {[d.isoformat() for d in days]}")
    print()

    all_records = []
    for d in days:
        print(f"  {d} ...", end=" ", flush=True)
        try:
            result = await sync_one_day(d, serial_list)
            records = result["records"]
            all_records.append((d, records))
            print(f"OK — {len(records)} xe")
            for r in records:
                fills = parse_fills(
                    str(r.get("FuelValue") or ""),
                    str(r.get("ThayDoiNlTime") or ""),
                    str(r.get("ActionLocation") or ""),
                    str(r.get("DeviceStatusType") or ""),
                )
                fills_str = ", ".join(f"{f['so_lit']}L@{f['gio']}" for f in fills) if fills else "không đổ"
                print(f"    {r.get('Bs')}: {r.get('NhienLieuTieuThu'):.1f}L tiêu thụ | {fills_str}")
        except Exception as e:
            print(f"ERROR: {e}")

    print()
    saved = save_to_db(all_records)
    print(f"Đã lưu {saved} bản ghi vào DB.")


if __name__ == "__main__":
    asyncio.run(main())
