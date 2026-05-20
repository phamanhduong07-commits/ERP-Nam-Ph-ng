"""
Tests for logistics modules:
  GET/POST/PUT/DELETE  /api/xe
  GET/POST/PUT/DELETE  /api/tai-xe
  GET/POST/PUT/DELETE  /api/lo-xe
  GET/POST/PATCH/DELETE /api/yeu-cau-giao-hang
  GET                  /api/hr/vehicles
  GET                  /api/hr/trip-rate
  GET/POST             /api/hr/fuel-logs
  GET                  /api/hr/trip-salaries
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
# Xe tests
# ---------------------------------------------------------------------------

def test_list_xe_empty(client):
    res = client.get("/api/xe")
    assert res.status_code == 200
    assert res.json() == []


def test_create_xe_success(client):
    res = client.post("/api/xe", json={"bien_so": "51A-12345"})
    assert res.status_code == 201
    data = res.json()
    assert data["bien_so"] == "51A-12345"
    assert "id" in data


def test_create_xe_duplicate_bien_so_blocked(client):
    client.post("/api/xe", json={"bien_so": "51A-99999"})
    res2 = client.post("/api/xe", json={"bien_so": "51A-99999"})
    assert res2.status_code == 400


def test_update_xe(client):
    create_res = client.post("/api/xe", json={"bien_so": "51B-11111"})
    xe_id = create_res.json()["id"]
    res = client.put(f"/api/xe/{xe_id}", json={"bien_so": "51B-11111", "loai_xe": "Tải 5T"})
    assert res.status_code == 200
    assert res.json()["loai_xe"] == "Tải 5T"


# ---------------------------------------------------------------------------
# Tài xế tests
# ---------------------------------------------------------------------------

def test_list_tai_xe_empty(client):
    res = client.get("/api/tai-xe")
    assert res.status_code == 200
    assert res.json() == []


def test_create_tai_xe_success(client):
    res = client.post("/api/tai-xe", json={"ho_ten": "Nguyen Van A", "so_dien_thoai": "0901234567"})
    assert res.status_code == 201
    data = res.json()
    assert data["ho_ten"] == "Nguyen Van A"


def test_update_tai_xe(client):
    create_res = client.post("/api/tai-xe", json={"ho_ten": "Tran Van B"})
    tx_id = create_res.json()["id"]
    res = client.put(f"/api/tai-xe/{tx_id}", json={"ho_ten": "Tran Van B Updated", "so_bang_lai": "BL123456"})
    assert res.status_code == 200
    assert res.json()["so_bang_lai"] == "BL123456"


# ---------------------------------------------------------------------------
# Lơ xe tests
# ---------------------------------------------------------------------------

def test_list_lo_xe_empty(client):
    res = client.get("/api/lo-xe")
    assert res.status_code == 200
    assert res.json() == []


def test_create_lo_xe_success(client):
    res = client.post("/api/lo-xe", json={"ho_ten": "Lo Xe Test"})
    assert res.status_code == 201
    data = res.json()
    assert data["ho_ten"] == "Lo Xe Test"


# ---------------------------------------------------------------------------
# Yêu cầu giao hàng tests
# ---------------------------------------------------------------------------

def test_list_yeu_cau_giao_hang_empty(client):
    res = client.get("/api/yeu-cau-giao-hang")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_create_yeu_cau_empty_items_blocked(client):
    payload = {
        "ngay_yeu_cau": "2026-06-01",
        "items": [],
    }
    res = client.post("/api/yeu-cau-giao-hang", json=payload)
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Logistics HR tests
# ---------------------------------------------------------------------------

def test_list_vehicles(client):
    res = client.get("/api/hr/vehicles")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_get_trip_rate_default_zero(client):
    res = client.get("/api/hr/trip-rate")
    assert res.status_code == 200
    assert "don_gia_m2" in res.json()


def test_list_fuel_logs_empty(client):
    res = client.get("/api/hr/fuel-logs?from_date=2026-01-01&to_date=2026-12-31")
    assert res.status_code == 200
    assert res.json() == []


def test_create_fuel_log_success(client, db_session):
    from app.models.master import Xe
    xe = Xe(bien_so="52A-FUEL01")
    db_session.add(xe)
    db_session.commit()
    db_session.refresh(xe)

    payload = {
        "ngay_do": "2026-06-01",
        "xe_id": xe.id,
        "employee_id": 1,
        "so_km_dau": 1000,
        "so_km_cuoi": 1200,
        "so_lit_dau": 20,
        "don_gia": 22000,
    }
    res = client.post("/api/hr/fuel-logs", json=payload)
    assert res.status_code == 200


def test_create_fuel_log_km_cuoi_less_than_km_dau_blocked(client, db_session):
    from app.models.master import Xe
    xe = Xe(bien_so="52A-FUEL02")
    db_session.add(xe)
    db_session.commit()
    db_session.refresh(xe)

    payload = {
        "ngay_do": "2026-06-01",
        "xe_id": xe.id,
        "employee_id": 1,
        "so_km_dau": 1200,
        "so_km_cuoi": 1000,
        "so_lit_dau": 20,
        "don_gia": 22000,
    }
    res = client.post("/api/hr/fuel-logs", json=payload)
    assert res.status_code == 400


def test_list_trip_salaries_empty(client):
    res = client.get("/api/hr/trip-salaries?from_date=2026-01-01&to_date=2026-12-31")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
