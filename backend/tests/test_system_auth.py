"""
Tests for system/auth modules:
  POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me
  GET/POST/PUT /api/users
  GET/POST/PUT/DELETE /api/permissions, /api/roles
  GET/POST/PUT/DELETE /api/phap-nhan
  GET/PUT /api/system/settings, /api/system/templates
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

def _create_role_in_db(db_session, ma_vai_tro="ADMIN", ten_vai_tro="Admin"):
    from app.models.auth import Role
    role = Role(ma_vai_tro=ma_vai_tro, ten_vai_tro=ten_vai_tro, trang_thai=True)
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)
    return role


def _create_user_in_db(db_session, username, password, role_id):
    import bcrypt
    from app.models.auth import User
    user = User(
        username=username,
        ho_ten=f"User {username}",
        password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        role_id=role_id,
        trang_thai=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------

def test_login_correct_credentials(client, db_session):
    role = _create_role_in_db(db_session)
    _create_user_in_db(db_session, "logintest", "pass123", role.id)

    res = client.post("/api/auth/login", data={"username": "logintest", "password": "pass123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password_returns_401(client, db_session):
    role = _create_role_in_db(db_session, "STAFF", "Staff")
    _create_user_in_db(db_session, "wrongpwd", "correct_pass", role.id)

    res = client.post("/api/auth/login", data={"username": "wrongpwd", "password": "wrong"})
    assert res.status_code == 401


def test_get_me_returns_user_info(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == "testuser"
    assert "role" in data


# ---------------------------------------------------------------------------
# Users tests
# ---------------------------------------------------------------------------

def test_list_users(client):
    res = client.get("/api/users")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_create_user_success(client, db_session):
    role = _create_role_in_db(db_session, "KE_TOAN", "Ke Toan")
    payload = {
        "username": "newuser01",
        "ho_ten": "New User",
        "password": "pass123",
        "role_id": role.id,
    }
    res = client.post("/api/users", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "newuser01"


def test_create_user_duplicate_username_blocked(client, db_session):
    role = _create_role_in_db(db_session, "NV", "Nhan Vien")
    payload = {"username": "dupuser", "ho_ten": "Dup", "password": "pass123", "role_id": role.id}
    client.post("/api/users", json=payload)
    res2 = client.post("/api/users", json=payload)
    assert res2.status_code == 400


# ---------------------------------------------------------------------------
# Permissions tests
# ---------------------------------------------------------------------------

def test_list_permissions_empty_returns_paged(client):
    res = client.get("/api/permissions")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 0


def test_create_permission_success(client):
    payload = {"ma_quyen": "xem_bao_cao", "ten_quyen": "Xem báo cáo", "nhom": "bao_cao"}
    res = client.post("/api/permissions", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["ma_quyen"] == "xem_bao_cao"


def test_create_permission_duplicate_blocked(client):
    payload = {"ma_quyen": "dup_quyen", "ten_quyen": "Dup"}
    client.post("/api/permissions", json=payload)
    res2 = client.post("/api/permissions", json=payload)
    assert res2.status_code == 400


# ---------------------------------------------------------------------------
# Pháp nhân tests
# ---------------------------------------------------------------------------

def test_list_phap_nhan_empty(client):
    res = client.get("/api/phap-nhan")
    assert res.status_code == 200
    assert res.json() == []


def test_create_phap_nhan_success(client):
    payload = {"ma_phap_nhan": "TESTPN", "ten_phap_nhan": "Cty Test"}
    res = client.post("/api/phap-nhan", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["ma_phap_nhan"] == "TESTPN"


def test_create_phap_nhan_duplicate_blocked(client):
    payload = {"ma_phap_nhan": "DUP_PN", "ten_phap_nhan": "Dup"}
    client.post("/api/phap-nhan", json=payload)
    res2 = client.post("/api/phap-nhan", json=payload)
    assert res2.status_code == 400


# ---------------------------------------------------------------------------
# System settings tests
# ---------------------------------------------------------------------------

def test_get_system_settings_returns_dict(client):
    res = client.get("/api/system/settings")
    assert res.status_code == 200
    assert isinstance(res.json(), dict)


def test_update_system_setting_and_read_back(client):
    payload = {"key": "app_version", "value": "2.0.0", "description": "Version"}
    res = client.put("/api/system/settings", json=payload)
    assert res.status_code == 200

    res2 = client.get("/api/system/settings")
    assert res2.json().get("app_version") == "2.0.0"


def test_list_system_templates_empty(client):
    res = client.get("/api/system/templates")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
