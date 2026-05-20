"""
Tests for HR module — Employee, Department, LeaveRequest endpoints.

Endpoints covered:
  GET    /api/hr/departments
  POST   /api/hr/departments
  GET    /api/hr/employees
  GET    /api/hr/employees/{id}
  POST   /api/hr/employees
  PUT    /api/hr/employees/{id}
  GET    /api/hr/leave-requests
  POST   /api/hr/leave-requests
  POST   /api/hr/leave-requests/{id}/approve   (POST with query param)
  PUT    /api/hr/leave-requests/{id}/approve   (PUT with body)
"""
import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch


# ---------------------------------------------------------------------------
# Local fixture overrides — use in-memory SQLite to avoid shared-file issues.
# These override the conftest.py fixtures for tests in this file.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db_engine():
    """
    SQLite engine using a shared in-memory DB via URI + cache=shared.
    This ensures all connections in the same test function see the same data.
    """
    from app.database import Base
    from sqlalchemy import JSON, Text, event
    from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID as PG_UUID
    import app.models  # noqa: F401 — registers all models

    # Use a named shared-memory DB so all connections in this test share state
    engine = create_engine(
        "sqlite:///file:test_hr_mem?mode=memory&cache=shared&uri=true",
        connect_args={"check_same_thread": False},
    )

    # Enable FK support on each connection
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        pass  # SQLite doesn't enforce FK in tests — skip for simplicity

    # Patch PG-specific types so SQLite can create the tables
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()
            elif isinstance(col.type, (ARRAY, PG_UUID)):
                col.type = Text()

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Session bound to the shared-memory engine."""
    SessionLocal = sessionmaker(bind=db_engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient with overridden DB + current_user (ADMIN)."""
    from app.main import app
    from app.database import get_db
    from app.deps import get_current_user
    from fastapi.testclient import TestClient

    def override_get_db():
        yield db_session

    def override_get_current_user():
        _role = SimpleNamespace(ma_vai_tro="ADMIN")
        return SimpleNamespace(id=1, username="testuser", trang_thai=True, role=_role)

    with patch("app.socket_manager.sio.emit", new=AsyncMock(return_value=None)):
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _emp_payload(ma="NV_TEST", **kwargs):
    return {"ma_nv": ma, "ho_ten": f"Nhan vien {ma}", **kwargs}


def _create_employee(client, ma_nv="NV_HELPER_001", ho_ten=None):
    payload = {"ma_nv": ma_nv, "ho_ten": ho_ten or f"Nhan vien {ma_nv}"}
    res = client.post("/api/hr/employees", json=payload)
    assert res.status_code in (200, 201), f"create_employee failed: {res.text}"
    return res.json()


# ---------------------------------------------------------------------------
# Employee tests
# ---------------------------------------------------------------------------

def test_create_employee_success(client, db_session):
    """Tao nhan vien moi → 200/201, ma_nv dung."""
    res = client.post("/api/hr/employees", json=_emp_payload("NV_HR1"))
    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data["ma_nv"] == "NV_HR1"
    assert "id" in data
    assert data["id"] > 0


def test_create_employee_duplicate_ma_nv_blocked(client, db_session):
    """Tao 2 nhan vien cung ma_nv → 400."""
    client.post("/api/hr/employees", json=_emp_payload("NV_DUP1"))
    res2 = client.post("/api/hr/employees", json=_emp_payload("NV_DUP1"))
    assert res2.status_code == 400


def test_create_employee_with_ngay_vao_lam(client, db_session):
    """Tao nhan vien voi ngay_vao_lam → luu dung."""
    res = client.post("/api/hr/employees", json=_emp_payload(
        "NV_DATE1", ngay_vao_lam=date(2024, 1, 15).isoformat()
    ))
    assert res.status_code in (200, 201)
    assert res.json()["ngay_vao_lam"] == "2024-01-15"


def test_list_employees_returns_200(client, db_session):
    """GET /api/hr/employees → 200 va tra ve list."""
    _create_employee(client, ma_nv="NV_LST1")
    _create_employee(client, ma_nv="NV_LST2")

    res = client.get("/api/hr/employees")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2


def test_get_employee_by_id(client, db_session):
    """GET /api/hr/employees/{id} → tra dung nhan vien."""
    emp = _create_employee(client, ma_nv="NV_GET1")
    emp_id = emp["id"]

    res = client.get(f"/api/hr/employees/{emp_id}")
    assert res.status_code == 200
    assert res.json()["id"] == emp_id


def test_get_nonexistent_employee_returns_404(client, db_session):
    """GET /api/hr/employees/999999 → 404."""
    res = client.get("/api/hr/employees/999999")
    assert res.status_code == 404


def test_update_employee_ho_ten(client, db_session):
    """PUT /api/hr/employees/{id} → cap nhat ho_ten thanh cong."""
    emp = _create_employee(client, ma_nv="NV_UPD1")
    emp_id = emp["id"]

    res = client.put(f"/api/hr/employees/{emp_id}", json={"ho_ten": "Ten moi"})
    assert res.status_code == 200
    assert res.json()["ho_ten"] == "Ten moi"


def test_update_employee_phone_and_status(client, db_session):
    """PUT update nhieu field → tat ca field duoc cap nhat."""
    emp = _create_employee(client, ma_nv="NV_UPD2")
    emp_id = emp["id"]

    res = client.put(f"/api/hr/employees/{emp_id}", json={
        "so_dien_thoai": "0901234567",
        "trang_thai": "tam_nghi",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["so_dien_thoai"] == "0901234567"
    assert data["trang_thai"] == "tam_nghi"


def test_employee_required_fields_missing_returns_422(client, db_session):
    """POST thieu field bat buoc (ho_ten) → 422."""
    res = client.post("/api/hr/employees", json={
        "ma_nv": "NV_MISS_001",
        # thieu ho_ten
    })
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Department tests
# ---------------------------------------------------------------------------

def test_create_department_success(client, db_session):
    """POST /api/hr/departments → 200, tra ve object co id va ma_bo_phan."""
    res = client.post("/api/hr/departments", json={
        "ma_bo_phan": "KD",
        "ten_bo_phan": "Kinh Doanh",
    })
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["id"] > 0
    assert data["ma_bo_phan"] == "KD"
    assert data["ten_bo_phan"] == "Kinh Doanh"


def test_list_departments_returns_200(client, db_session):
    """GET /api/hr/departments → 200 va tra ve list."""
    client.post("/api/hr/departments", json={
        "ma_bo_phan": "SX",
        "ten_bo_phan": "San Xuat",
    })
    res = client.get("/api/hr/departments")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_create_department_duplicate_returns_400(client, db_session):
    """POST cung ma_bo_phan lan 2 → 400."""
    client.post("/api/hr/departments", json={
        "ma_bo_phan": "DUP_DEPT",
        "ten_bo_phan": "Phong trung",
    })
    res = client.post("/api/hr/departments", json={
        "ma_bo_phan": "DUP_DEPT",
        "ten_bo_phan": "Trung ma",
    })
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# LeaveRequest tests
# ---------------------------------------------------------------------------

def test_list_leave_requests_returns_200(client, db_session):
    """GET /api/hr/leave-requests → 200 va tra ve list."""
    res = client.get("/api/hr/leave-requests")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_create_leave_request_success(client, db_session):
    """POST /api/hr/leave-requests → 200, trang_thai mac dinh 'cho_duyet'."""
    emp = _create_employee(client, ma_nv="NV_LR_001")

    res = client.post("/api/hr/leave-requests", json={
        "employee_id": emp["id"],
        "loai_don": "nghi_phep",
        "ngay_bat_dau": "2026-06-01T08:00:00",
        "ngay_ket_thuc": "2026-06-02T17:00:00",
        "tong_ngay": "2",
        "ly_do": "Viec ca nhan",
    })
    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data["id"] > 0
    assert data["employee_id"] == emp["id"]
    assert data["trang_thai"] == "cho_duyet"


def test_approve_leave_request_via_put(client, db_session):
    """PUT /api/hr/leave-requests/{id}/approve voi trang_thai=bgd_duyet → doi trang_thai."""
    emp = _create_employee(client, ma_nv="NV_LR_APP_001")

    lr_res = client.post("/api/hr/leave-requests", json={
        "employee_id": emp["id"],
        "loai_don": "nghi_phep",
        "ngay_bat_dau": "2026-06-01T08:00:00",
        "ngay_ket_thuc": "2026-06-01T17:00:00",
        "tong_ngay": "1",
    })
    assert lr_res.status_code in (200, 201)
    lr_id = lr_res.json()["id"]

    res = client.put(f"/api/hr/leave-requests/{lr_id}/approve", json={
        "trang_thai": "bgd_duyet",
        "y_kien_duyet": "Dong y cho nghi phep",
    })
    assert res.status_code == 200
    assert res.json()["status"] == "bgd_duyet"


def test_reject_leave_request_via_put(client, db_session):
    """PUT /api/hr/leave-requests/{id}/approve voi trang_thai=tu_choi → doi trang_thai."""
    emp = _create_employee(client, ma_nv="NV_LR_REJ_001")

    lr_res = client.post("/api/hr/leave-requests", json={
        "employee_id": emp["id"],
        "loai_don": "tang_ca",
        "ngay_bat_dau": "2026-06-05T18:00:00",
        "ngay_ket_thuc": "2026-06-05T21:00:00",
        "tong_ngay": "0.5",
    })
    assert lr_res.status_code in (200, 201)
    lr_id = lr_res.json()["id"]

    res = client.put(f"/api/hr/leave-requests/{lr_id}/approve", json={
        "trang_thai": "tu_choi",
        "y_kien_duyet": "Khong co nguoi thay the",
    })
    assert res.status_code == 200
    assert res.json()["status"] == "tu_choi"


def test_approve_leave_request_invalid_status_returns_400(client, db_session):
    """PUT approve voi trang_thai khong hop le → 400."""
    emp = _create_employee(client, ma_nv="NV_LR_INV_001")

    lr_res = client.post("/api/hr/leave-requests", json={
        "employee_id": emp["id"],
        "loai_don": "nghi_phep",
        "ngay_bat_dau": "2026-06-10T08:00:00",
        "ngay_ket_thuc": "2026-06-10T17:00:00",
        "tong_ngay": "1",
    })
    assert lr_res.status_code in (200, 201)
    lr_id = lr_res.json()["id"]

    res = client.put(f"/api/hr/leave-requests/{lr_id}/approve", json={
        "trang_thai": "invalid_status",
    })
    assert res.status_code == 400


def test_approve_leave_nonexistent_returns_404(client, db_session):
    """PUT /api/hr/leave-requests/999999/approve → 404."""
    res = client.put("/api/hr/leave-requests/999999/approve", json={
        "trang_thai": "bgd_duyet",
    })
    assert res.status_code == 404
