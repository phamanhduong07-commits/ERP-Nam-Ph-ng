"""
Tests for HR extended modules:
  GET/POST         /api/hr/rewards
  PUT              /api/hr/rewards/{id}/status
  GET              /api/hr/me/profile, /api/hr/me/payroll
  GET/POST         /api/hr/leave-requests
  PUT              /api/hr/leave-requests/{id}/approve
"""
import pytest
from sqlalchemy import create_engine, JSON, Text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db_engine():
    from app.database import Base
    from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID as PG_UUID
    import app.models  # noqa: F401

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()
            elif isinstance(col.type, (ARRAY, PG_UUID)):
                col.type = Text()
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    from app.main import app
    from app.database import get_db
    from app.deps import get_current_user
    from fastapi.testclient import TestClient

    def override_get_db():
        yield db_session

    def override_get_current_user():
        _role = SimpleNamespace(ma_vai_tro="ADMIN", role_permissions=[])
        return SimpleNamespace(
            id=1, username="testuser", ho_ten="Test User",
            email=None, phan_xuong=None, machine_id=None,
            trang_thai=True, role=_role,
        )

    with patch("app.socket_manager.sio.emit", new=AsyncMock(return_value=None)):
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_employee(client, ma_nv="NV_HELPER"):
    res = client.post("/api/hr/employees", json={"ma_nv": ma_nv, "ho_ten": f"NV {ma_nv}"})
    assert res.status_code in (200, 201), f"create employee failed: {res.text}"
    return res.json()


# ---------------------------------------------------------------------------
# HR Reward tests
# ---------------------------------------------------------------------------

def test_list_rewards_empty(client):
    res = client.get("/api/hr/rewards")
    assert res.status_code == 200
    assert res.json() == []


def test_create_reward_success(client):
    emp = _create_employee(client, "NV_REWARD01")
    payload = {
        "employee_id": emp["id"],
        "loai": "khen_thuong",
        "hinh_thuc": "thuong_tien",
        "so_tien": 500000,
        "ly_do": "Hoàn thành xuất sắc nhiệm vụ",
        "thang_ap_dung": 5,
        "nam_ap_dung": 2026,
    }
    res = client.post("/api/hr/rewards", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"


def test_create_reward_and_list(client):
    emp = _create_employee(client, "NV_REWARD02")
    payload = {
        "employee_id": emp["id"],
        "loai": "ky_luat",
        "hinh_thuc": "phat_tien",
        "so_tien": 200000,
        "ly_do": "Đi muộn",
        "thang_ap_dung": 5,
        "nam_ap_dung": 2026,
    }
    client.post("/api/hr/rewards", json=payload)
    res = client.get("/api/hr/rewards")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["loai"] == "ky_luat"


def test_update_reward_status(client):
    emp = _create_employee(client, "NV_REWARD03")
    payload = {
        "employee_id": emp["id"],
        "loai": "khen_thuong",
        "hinh_thuc": "thuong_tien",
        "so_tien": 100000,
        "ly_do": "Test",
        "thang_ap_dung": 5,
        "nam_ap_dung": 2026,
    }
    create_res = client.post("/api/hr/rewards", json=payload)
    reward_id = create_res.json()["id"]

    res = client.put(f"/api/hr/rewards/{reward_id}/status?status=da_duyet")
    assert res.status_code == 200
    assert res.json()["status"] == "success"


# ---------------------------------------------------------------------------
# HR Self-Service tests
# ---------------------------------------------------------------------------

def test_get_my_profile_no_employee_linked_returns_404(client):
    res = client.get("/api/hr/me/profile")
    assert res.status_code == 404


def test_get_my_payroll_no_employee_returns_empty(client):
    res = client.get("/api/hr/me/payroll")
    assert res.status_code == 200
    assert res.json() == []


# ---------------------------------------------------------------------------
# HR Workflow (Leave Requests) tests
# ---------------------------------------------------------------------------

def test_list_leave_requests_empty(client):
    res = client.get("/api/hr/leave-requests")
    assert res.status_code == 200
    assert res.json() == []


def test_create_leave_request_success(client):
    emp = _create_employee(client, "NV_LEAVE01")
    payload = {
        "employee_id": emp["id"],
        "loai_don": "nghi_phep",
        "ngay_bat_dau": "2026-06-01T00:00:00",
        "ngay_ket_thuc": "2026-06-03T00:00:00",
        "tong_ngay": 3,
        "ly_do": "Nghỉ phép năm",
    }
    res = client.post("/api/hr/leave-requests", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert data["loai_don"] == "nghi_phep"


def test_approve_leave_request(client):
    emp = _create_employee(client, "NV_LEAVE02")
    payload = {
        "employee_id": emp["id"],
        "loai_don": "nghi_phep",
        "ngay_bat_dau": "2026-06-05T00:00:00",
        "ngay_ket_thuc": "2026-06-06T00:00:00",
        "tong_ngay": 2,
    }
    create_res = client.post("/api/hr/leave-requests", json=payload)
    req_id = create_res.json()["id"]

    approve_payload = {
        "trang_thai": "phong_ban_duyet",
        "y_kien_duyet": "Đồng ý",
        "nguoi_duyet_id": 1,
    }
    res = client.put(f"/api/hr/leave-requests/{req_id}/approve", json=approve_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "phong_ban_duyet"
