"""Sync HR data từ máy remote → máy này qua FastAPI endpoints.

Cách dùng:
  # Cùng mạng nội bộ — chạy 1 lệnh:
  python scripts/sync_hr_from_remote.py --src http://192.168.1.xxx:8001

  # Hoặc import từ file JSON đã export sẵn:
  python scripts/sync_hr_from_remote.py --from-file hr_export.json

  # Chỉ export ra file (chạy trên máy nguồn):
  python scripts/sync_hr_from_remote.py --export-only --src http://localhost:8001
"""
import argparse
import json
import sys
import requests

LOCAL_URL   = "http://localhost:8001"
ADMIN_USER  = "admin"
ADMIN_PASS  = "admin123"


# ─── Auth ────────────────────────────────────────────────────────────────────

def get_token(base_url: str) -> str:
    r = requests.post(
        f"{base_url}/api/auth/login",
        data={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Pull from source ────────────────────────────────────────────────────────

def pull_data(src_url: str) -> dict:
    print(f"🔐 Login vào {src_url} ...")
    token = get_token(src_url)
    h = headers(token)

    data: dict = {}
    endpoints = {
        "departments": "/api/hr/departments",
        "positions":   "/api/hr/positions",
        "teams":       "/api/hr/teams",
        "employees":   "/api/hr/employees",
    }
    for key, path in endpoints.items():
        r = requests.get(f"{src_url}{path}", headers=h, timeout=30)
        r.raise_for_status()
        data[key] = r.json()
        print(f"  ✓ {key}: {len(data[key])} records")

    return data


# ─── Push to local ───────────────────────────────────────────────────────────

def push_data(data: dict) -> None:
    print(f"\n📤 Import vào {LOCAL_URL} ...")
    token = get_token(LOCAL_URL)
    h = headers(token)
    h["Content-Type"] = "application/json"

    # 1. Departments
    existing_depts = {
        d["ma_bo_phan"]: d["id"]
        for d in requests.get(f"{LOCAL_URL}/api/hr/departments", headers=headers(token)).json()
    }
    dept_map: dict[int, int] = {}   # remote_id → local_id
    created_dept = 0
    for dept in data.get("departments", []):
        remote_id = dept["id"]
        ma = dept.get("ma_bo_phan", "")
        if ma in existing_depts:
            dept_map[remote_id] = existing_depts[ma]
        else:
            payload = {k: v for k, v in dept.items() if k not in ("id", "created_at", "parent_id")}
            r = requests.post(f"{LOCAL_URL}/api/hr/departments", headers=headers(token), json=payload, timeout=10)
            if r.status_code in (200, 201):
                local_id = r.json()["id"]
                dept_map[remote_id] = local_id
                existing_depts[ma] = local_id
                created_dept += 1
            else:
                print(f"  ⚠ dept {ma}: {r.status_code} {r.text[:80]}")
    print(f"  ✓ departments: {created_dept} tạo mới, {len(dept_map)-created_dept} đã có")

    # 2. Positions (chuc_vu)
    existing_pos = {
        p["ma_chuc_vu"]: p["id"]
        for p in requests.get(f"{LOCAL_URL}/api/hr/positions", headers=headers(token)).json()
    }
    pos_map: dict[int, int] = {}
    created_pos = 0
    for pos in data.get("positions", []):
        remote_id = pos["id"]
        ma = pos.get("ma_chuc_vu", "")
        if ma in existing_pos:
            pos_map[remote_id] = existing_pos[ma]
        else:
            payload = {k: v for k, v in pos.items() if k not in ("id", "created_at")}
            r = requests.post(f"{LOCAL_URL}/api/hr/positions", headers=headers(token), json=payload, timeout=10)
            if r.status_code in (200, 201):
                local_id = r.json()["id"]
                pos_map[remote_id] = local_id
                existing_pos[ma] = local_id
                created_pos += 1
            else:
                print(f"  ⚠ pos {ma}: {r.status_code} {r.text[:80]}")
    print(f"  ✓ positions: {created_pos} tạo mới, {len(pos_map)-created_pos} đã có")

    # 3. Employees — bulk upsert by ma_nv
    employees = data.get("employees", [])
    existing_nv = {
        e["ma_nv"]: e["id"]
        for e in requests.get(f"{LOCAL_URL}/api/hr/employees", headers=headers(token)).json()
    }
    emp_map: dict[int, int] = {}
    created_emp = updated_emp = skipped_emp = 0

    SKIP_FIELDS = {"id", "created_at", "ten_bo_phan", "ten_chuc_vu",
                   "ten_phan_xuong", "ten_phap_nhan", "ten_to", "has_account"}

    for emp in employees:
        remote_id = emp["id"]
        ma_nv = emp.get("ma_nv", "")
        payload = {k: v for k, v in emp.items() if k not in SKIP_FIELDS}

        # remap FK ids
        if emp.get("bo_phan_id") and emp["bo_phan_id"] in dept_map:
            payload["bo_phan_id"] = dept_map[emp["bo_phan_id"]]
        if emp.get("chuc_vu_id") and emp["chuc_vu_id"] in pos_map:
            payload["chuc_vu_id"] = pos_map[emp["chuc_vu_id"]]

        if ma_nv in existing_nv:
            local_id = existing_nv[ma_nv]
            emp_map[remote_id] = local_id
            r = requests.put(f"{LOCAL_URL}/api/hr/employees/{local_id}", headers=headers(token), json=payload, timeout=10)
            if r.status_code == 200:
                updated_emp += 1
            else:
                skipped_emp += 1
        else:
            r = requests.post(f"{LOCAL_URL}/api/hr/employees", headers=headers(token), json=payload, timeout=10)
            if r.status_code in (200, 201):
                local_id = r.json()["id"]
                emp_map[remote_id] = local_id
                existing_nv[ma_nv] = local_id
                created_emp += 1
            else:
                skipped_emp += 1
                print(f"  ⚠ emp {ma_nv}: {r.status_code} {r.text[:100]}")

    print(f"  ✓ employees: {created_emp} tạo mới, {updated_emp} cập nhật, {skipped_emp} lỗi")

    # 4. Teams
    existing_teams = {
        t["ten_to"]: t["id"]
        for t in requests.get(f"{LOCAL_URL}/api/hr/teams", headers=headers(token)).json()
    }
    created_team = 0
    for team in data.get("teams", []):
        ten = team.get("ten_to", "")
        if ten in existing_teams:
            continue
        payload = {
            "ten_to":    ten,
            "mo_ta":     team.get("mo_ta"),
            "trang_thai": team.get("trang_thai", True),
        }
        if team.get("bo_phan_id") and team["bo_phan_id"] in dept_map:
            payload["bo_phan_id"] = dept_map[team["bo_phan_id"]]
        r = requests.post(f"{LOCAL_URL}/api/hr/teams", headers=headers(token), json=payload, timeout=10)
        if r.status_code in (200, 201):
            created_team += 1
        else:
            print(f"  ⚠ team {ten}: {r.status_code} {r.text[:80]}")
    print(f"  ✓ teams: {created_team} tạo mới")

    print("\n✅ Xong!")


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src",         help="URL máy nguồn, ví dụ http://192.168.1.50:8001")
    parser.add_argument("--from-file",   help="Import từ file JSON đã export (bỏ qua --src)")
    parser.add_argument("--export-only", action="store_true", help="Chỉ export ra file hr_export.json, không import")
    args = parser.parse_args()

    if args.from_file:
        with open(args.from_file, encoding="utf-8") as f:
            data = json.load(f)
        push_data(data)
        return

    if not args.src:
        print("Cần --src hoặc --from-file. Ví dụ:")
        print("  python scripts/sync_hr_from_remote.py --src http://192.168.1.50:8001")
        sys.exit(1)

    data = pull_data(args.src)

    if args.export_only:
        out = "hr_export.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Đã lưu → {out}")
        return

    push_data(data)


if __name__ == "__main__":
    main()
