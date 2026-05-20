"""
Tests for financial catalog modules:
  POST/GET/PUT       /api/addon-rates, /api/addon-rates/seed
  POST/GET/PUT       /api/indirect-costs, /api/indirect-costs/seed
  GET/POST/PUT       /api/bank-accounts
  GET/POST/PUT       /api/ccdc/nhom, /api/ccdc
  POST/PATCH         /api/ccdc/phieu-xuat (approve/cancel flow)
  GET/POST/PUT/DELETE /api/don-gia-van-chuyen
  GET                /api/accounting/customer-refunds
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
# Addon Rates tests
# ---------------------------------------------------------------------------

def test_list_addon_rates_empty(client):
    res = client.get("/api/addon-rates")
    assert res.status_code == 200
    assert res.json() == []


def test_seed_addon_rates(client):
    res = client.post("/api/addon-rates/seed")
    assert res.status_code == 201
    assert "message" in res.json()


def test_list_addon_rates_after_seed_has_items(client):
    client.post("/api/addon-rates/seed")
    res = client.get("/api/addon-rates")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0
    assert "ma_chi_phi" in items[0]
    assert "don_gia" in items[0]


def test_update_addon_rate(client):
    client.post("/api/addon-rates/seed")
    items = client.get("/api/addon-rates").json()
    first_id = items[0]["id"]

    res = client.put(f"/api/addon-rates/{first_id}", json={"don_gia": 999})
    assert res.status_code == 200
    assert float(res.json()["don_gia"]) == 999.0


# ---------------------------------------------------------------------------
# Indirect Costs tests
# ---------------------------------------------------------------------------

def test_list_indirect_costs_empty(client):
    res = client.get("/api/indirect-costs")
    assert res.status_code == 200
    assert res.json() == []


def test_seed_indirect_costs(client):
    res = client.post("/api/indirect-costs/seed")
    assert res.status_code == 201
    assert "message" in res.json()


def test_list_indirect_costs_after_seed_has_3_layers(client):
    client.post("/api/indirect-costs/seed")
    res = client.get("/api/indirect-costs")
    assert res.status_code == 200
    items = res.json()
    so_lop_values = {item["so_lop"] for item in items}
    assert so_lop_values == {3, 5, 7}


def test_update_indirect_cost(client):
    client.post("/api/indirect-costs/seed")
    items = client.get("/api/indirect-costs").json()
    first_id = items[0]["id"]

    res = client.put(f"/api/indirect-costs/{first_id}", json={"don_gia_m2": 999.0})
    assert res.status_code == 200
    assert float(res.json()["don_gia_m2"]) == 999.0


# ---------------------------------------------------------------------------
# Bank Accounts tests
# ---------------------------------------------------------------------------

def test_list_bank_accounts_empty(client):
    res = client.get("/api/bank-accounts")
    assert res.status_code == 200
    assert res.json() == []


def test_create_bank_account_success(client):
    payload = {
        "ma_tk": "VIETCOM_001",
        "ten_ngan_hang": "Vietcombank",
        "so_tai_khoan": "1234567890",
    }
    res = client.post("/api/bank-accounts", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["ma_tk"] == "VIETCOM_001"


def test_create_bank_account_duplicate_ma_tk_blocked(client):
    payload = {"ma_tk": "DUP_TK", "ten_ngan_hang": "Test Bank", "so_tai_khoan": "999"}
    client.post("/api/bank-accounts", json=payload)
    res2 = client.post("/api/bank-accounts", json=payload)
    assert res2.status_code == 400


def test_get_bank_account_by_id(client):
    create_res = client.post("/api/bank-accounts", json={
        "ma_tk": "ACB_001", "ten_ngan_hang": "ACB", "so_tai_khoan": "5678"
    })
    account_id = create_res.json()["id"]
    res = client.get(f"/api/bank-accounts/{account_id}")
    assert res.status_code == 200
    assert res.json()["ma_tk"] == "ACB_001"


# ---------------------------------------------------------------------------
# CCDC tests
# ---------------------------------------------------------------------------

def test_list_ccdc_nhom_empty(client):
    res = client.get("/api/ccdc/nhom")
    assert res.status_code == 200
    assert res.json() == []


def test_create_ccdc_nhom_success(client):
    res = client.post("/api/ccdc/nhom", json={"ma_nhom": "MN01", "ten_nhom": "Nhóm máy tính"})
    assert res.status_code == 201
    assert res.json()["ma_nhom"] == "MN01"


def test_list_ccdc_empty(client):
    res = client.get("/api/ccdc")
    assert res.status_code == 200
    assert res.json() == []


def test_create_ccdc_success(client):
    client.post("/api/ccdc/nhom", json={"ma_nhom": "MN_CCDC", "ten_nhom": "Nhóm test"})
    res = client.post("/api/ccdc", json={
        "ma_ccdc": "CCDC001",
        "ten_ccdc": "Máy tính Dell",
        "nguyen_gia": 15000000,
        "so_luong": 2,
    })
    assert res.status_code == 201
    data = res.json()
    assert data["ma_ccdc"] == "CCDC001"


def test_phieu_xuat_ccdc_approve_deducts_inventory(client):
    client.post("/api/ccdc/nhom", json={"ma_nhom": "MN_XUAT", "ten_nhom": "Test"})
    ccdc_res = client.post("/api/ccdc", json={
        "ma_ccdc": "CCDC_XUAT01",
        "ten_ccdc": "Tool Test",
        "nguyen_gia": 500000,
        "so_luong": 10,
    })
    ccdc_id = ccdc_res.json()["id"]

    phieu_res = client.post("/api/ccdc/phieu-xuat", json={
        "ngay_xuat": "2026-06-01",
        "nguoi_nhan": "Nguyen Van A",
        "bo_phan": "Phòng IT",
        "ly_do": "Cấp phát",
        "items": [{"ccdc_id": ccdc_id, "so_luong": 3}],
    })
    assert phieu_res.status_code == 201
    phieu_id = phieu_res.json()["id"]

    approve_res = client.patch(f"/api/ccdc/phieu-xuat/{phieu_id}/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["trang_thai"] == "da_duyet"

    ccdc_after = client.get(f"/api/ccdc/{ccdc_id}")
    assert float(ccdc_after.json()["so_luong"]) == 7.0


# ---------------------------------------------------------------------------
# Đơn giá vận chuyển tests
# ---------------------------------------------------------------------------

def test_list_don_gia_van_chuyen_empty(client):
    res = client.get("/api/don-gia-van-chuyen")
    assert res.status_code == 200
    assert res.json() == []


def test_create_don_gia_van_chuyen_success(client):
    res = client.post("/api/don-gia-van-chuyen", json={
        "ten_tuyen": "HCM - Bình Dương",
        "don_gia": 500000,
        "don_gia_m2": 150,
    })
    assert res.status_code == 201
    assert res.json()["ten_tuyen"] == "HCM - Bình Dương"


def test_delete_don_gia_van_chuyen(client):
    create_res = client.post("/api/don-gia-van-chuyen", json={
        "ten_tuyen": "Tuyến xóa test", "don_gia": 0
    })
    obj_id = create_res.json()["id"]
    res = client.delete(f"/api/don-gia-van-chuyen/{obj_id}")
    assert res.status_code == 200
    assert res.json()["ok"] is True


# ---------------------------------------------------------------------------
# Customer Refunds tests
# ---------------------------------------------------------------------------

def test_list_customer_refunds_empty_returns_paged(client):
    res = client.get("/api/accounting/customer-refunds")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)
