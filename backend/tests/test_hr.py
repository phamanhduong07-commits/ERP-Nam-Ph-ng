"""
Sprint 4 — Test HR module
Covers: Employee (create, duplicate ma_nv block, list, get, update).
"""
from datetime import date

from app.models.hr import Employee


# ─── helpers ────────────────────────────────────────────────────────────────

def _emp_payload(ma="NV_TEST", **kwargs):
    return {"ma_nv": ma, "ho_ten": f"Nhân viên {ma}", **kwargs}


# ─── Tạo nhân viên ──────────────────────────────────────────────────────────

def test_create_employee_success(client, db_session):
    """Tạo nhân viên mới → 200/201, ma_nv đúng."""
    res = client.post("/api/hr/employees", json=_emp_payload("NV_HR1"))

    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data["ma_nv"] == "NV_HR1"
    assert data["ho_ten"] == "Nhân viên NV_HR1"


def test_create_employee_duplicate_ma_nv_blocked(client, db_session):
    """Tạo 2 nhân viên cùng ma_nv → 400."""
    client.post("/api/hr/employees", json=_emp_payload("NV_DUP1"))
    res2 = client.post("/api/hr/employees", json=_emp_payload("NV_DUP1"))
    assert res2.status_code == 400


def test_create_employee_with_ngay_vao_lam(client, db_session):
    """Tạo nhân viên với ngay_vao_lam → lưu đúng."""
    res = client.post("/api/hr/employees", json=_emp_payload(
        "NV_DATE1", ngay_vao_lam=date(2024, 1, 15).isoformat()
    ))
    assert res.status_code in (200, 201)
    assert res.json()["ngay_vao_lam"] == "2024-01-15"


# ─── List & Get ─────────────────────────────────────────────────────────────

def test_list_employees_returns_list(client, db_session):
    """GET /hr/employees → trả về list."""
    client.post("/api/hr/employees", json=_emp_payload("NV_LST1"))
    client.post("/api/hr/employees", json=_emp_payload("NV_LST2"))

    res = client.get("/api/hr/employees")
    assert res.status_code == 200
    assert isinstance(res.json(), list) or "items" in res.json()


def test_get_employee_by_id(client, db_session):
    """GET /hr/employees/{id} → trả đúng nhân viên."""
    create_res = client.post("/api/hr/employees", json=_emp_payload("NV_GET1"))
    emp_id = create_res.json()["id"]

    get_res = client.get(f"/api/hr/employees/{emp_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == emp_id


def test_get_nonexistent_employee_returns_404(client, db_session):
    """GET /hr/employees/999999 → 404."""
    res = client.get("/api/hr/employees/999999")
    assert res.status_code == 404


# ─── Update ─────────────────────────────────────────────────────────────────

def test_update_employee_ho_ten(client, db_session):
    """PUT update ho_ten → lưu đúng."""
    create_res = client.post("/api/hr/employees", json=_emp_payload("NV_UPD1"))
    emp_id = create_res.json()["id"]

    update_res = client.put(f"/api/hr/employees/{emp_id}", json={"ho_ten": "Tên mới"})
    assert update_res.status_code == 200
    assert update_res.json()["ho_ten"] == "Tên mới"
