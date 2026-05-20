"""
Tests for catalog & system modules:
  GET/POST/PUT/DELETE  /api/don-vi-tinh
  GET/POST/PUT/DELETE  /api/material-groups
  GET                  /api/dashboard/stats
  GET                  /api/theo-doi/don-hang, /api/theo-doi/phan-xuong, /api/theo-doi/bot-query
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
# Đơn vị tính tests
# ---------------------------------------------------------------------------

def test_list_don_vi_tinh_empty(client):
    res = client.get("/api/don-vi-tinh")
    assert res.status_code == 200
    assert res.json() == []


def test_create_don_vi_tinh_success(client):
    res = client.post("/api/don-vi-tinh", json={"ten": "Thùng", "ky_hieu": "Thung"})
    assert res.status_code == 201
    data = res.json()
    assert data["ten"] == "Thùng"
    assert "id" in data


def test_update_don_vi_tinh(client):
    create_res = client.post("/api/don-vi-tinh", json={"ten": "Cuộn"})
    dvt_id = create_res.json()["id"]
    res = client.put(f"/api/don-vi-tinh/{dvt_id}", json={"ten": "Cuộn", "ky_hieu": "Cuon", "trang_thai": True})
    assert res.status_code == 200
    assert res.json()["ky_hieu"] == "Cuon"


def test_delete_don_vi_tinh(client):
    create_res = client.post("/api/don-vi-tinh", json={"ten": "DVT Xoa"})
    dvt_id = create_res.json()["id"]
    res = client.delete(f"/api/don-vi-tinh/{dvt_id}")
    assert res.status_code == 200
    assert res.json()["ok"] is True

    list_res = client.get("/api/don-vi-tinh")
    assert all(item["id"] != dvt_id for item in list_res.json())


# ---------------------------------------------------------------------------
# Material Groups tests
# ---------------------------------------------------------------------------

def test_list_material_groups_empty(client):
    res = client.get("/api/material-groups")
    assert res.status_code == 200
    assert res.json() == []


def test_create_material_group_success(client):
    res = client.post("/api/material-groups", json={"ma_nhom": "GN001", "ten_nhom": "Giấy nâu"})
    assert res.status_code == 201
    data = res.json()
    assert data["ma_nhom"] == "GN001"
    assert "id" in data


def test_create_material_group_duplicate_ma_nhom_blocked(client):
    payload = {"ma_nhom": "DUP_MG", "ten_nhom": "Dup"}
    client.post("/api/material-groups", json=payload)
    res2 = client.post("/api/material-groups", json=payload)
    assert res2.status_code == 400


def test_update_material_group(client):
    create_res = client.post("/api/material-groups", json={"ma_nhom": "MG_UPD", "ten_nhom": "Old Name"})
    mg_id = create_res.json()["id"]
    res = client.put(f"/api/material-groups/{mg_id}", json={"ma_nhom": "MG_UPD", "ten_nhom": "New Name"})
    assert res.status_code == 200
    assert res.json()["ten_nhom"] == "New Name"


def test_delete_material_group(client):
    create_res = client.post("/api/material-groups", json={"ma_nhom": "MG_DEL", "ten_nhom": "Xóa"})
    mg_id = create_res.json()["id"]
    res = client.delete(f"/api/material-groups/{mg_id}")
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Dashboard tests
# ---------------------------------------------------------------------------

def test_dashboard_stats_returns_expected_structure(client):
    res = client.get("/api/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    assert "sales" in data
    assert "production" in data
    assert "warehouse" in data
    assert "purchase" in data
    assert "accounting" in data


def test_dashboard_stats_all_zeros_on_empty_db(client):
    res = client.get("/api/dashboard/stats")
    data = res.json()
    assert data["tong_khach_hang"] == 0
    assert data["sales"]["bao_gia_moi"] == 0
    assert data["production"]["lenh_sx_moi"] == 0


# ---------------------------------------------------------------------------
# Theo dõi tests
# ---------------------------------------------------------------------------

def test_theo_doi_don_hang_empty(client):
    res = client.get("/api/theo-doi/don-hang")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_theo_doi_phan_xuong_empty(client):
    res = client.get("/api/theo-doi/phan-xuong")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_theo_doi_bot_query_missing_params_returns_error(client):
    res = client.get("/api/theo-doi/bot-query")
    assert res.status_code == 200
    data = res.json()
    assert "error" in data


def test_theo_doi_bot_query_by_so_lenh(client):
    res = client.get("/api/theo-doi/bot-query?so_lenh=LSX-TEST")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
