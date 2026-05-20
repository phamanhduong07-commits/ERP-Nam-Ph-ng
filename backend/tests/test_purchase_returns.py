"""
Tests for PurchaseReturn module — /api/purchase-returns
Covers: create, list, get by id, 404, initial status, approve (duyet),
        cancel (huy), missing supplier, filter by supplier, delete, loai validation.

Uses a fresh in-memory SQLite DB per test to avoid file-locking issues
caused by the FK-cycle drop_all failure in conftest's named file DB.
"""

from datetime import date
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, JSON, Text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.database import Base
from app.models.master import Supplier


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_supplier(db, ma="NCC_TR", ten=None) -> Supplier:
    s = Supplier(ma_ncc=ma, ten_viet_tat=ten or f"NCC {ma}")
    db.add(s)
    db.flush()
    return s


def _return_payload(supplier_id: int, *, loai: str = "tra_hang", **kwargs) -> dict:
    payload = {
        "supplier_id": supplier_id,
        "ngay": date.today().isoformat(),
        "loai": loai,
        "tong_tien_hang": 2_000_000,
        "items": [
            {"ten_hang": "NVL trả", "so_luong": 50, "dvt": "Kg", "don_gia": 40000}
        ],
    }
    payload.update(kwargs)
    return payload


def _create_tables(engine) -> None:
    """Replace PostgreSQL-specific types and create all tables in SQLite."""
    from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID as PG_UUID
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()
            elif isinstance(col.type, (ARRAY, PG_UUID)):
                col.type = Text()
    Base.metadata.create_all(engine, checkfirst=True)


# ─── Fixture ──────────────────────────────────────────────────────────────────

@pytest.fixture
def cr():
    """
    Yields (TestClient, db_session) backed by a fresh in-memory SQLite database.
    Name 'cr' is short for client_returns to keep test signatures concise.
    """
    import app.models  # noqa: F401 — register all ORM models

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)

    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()

    from app.main import app
    from app.database import get_db
    from app.deps import get_current_user

    _admin_role = SimpleNamespace(ma_vai_tro="ADMIN")
    _user = SimpleNamespace(id=1, username="testuser", trang_thai=True, role=_admin_role)

    def override_db():
        yield session

    def override_user():
        return _user

    with patch("app.socket_manager.sio.emit", new=AsyncMock(return_value=None)):
        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c, session
    app.dependency_overrides.clear()
    session.close()
    engine.dispose()


# ─── Test 1: Tạo phiếu trả hàng → 201 ───────────────────────────────────────

def test_create_purchase_return(cr):
    """Tạo phiếu trả hàng hợp lệ → 201, so_phieu bắt đầu PTH."""
    client, db = cr
    sup = _make_supplier(db, "NCC_CR001")
    db.commit()

    res = client.post("/api/purchase-returns", json=_return_payload(sup.id))

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["supplier_id"] == sup.id
    assert data["loai"] == "tra_hang"
    assert data["so_phieu"].startswith("PTH")
    assert float(data["tong_tien_hang"]) == 2_000_000.0


# ─── Test 2: GET list → 200 ───────────────────────────────────────────────────

def test_list_purchase_returns(cr):
    """GET /api/purchase-returns → 200 với total và items."""
    client, db = cr
    sup = _make_supplier(db, "NCC_LIST001")
    db.commit()

    client.post("/api/purchase-returns", json=_return_payload(sup.id))
    client.post("/api/purchase-returns", json=_return_payload(sup.id, loai="giam_gia"))

    res = client.get("/api/purchase-returns")

    assert res.status_code == 200, res.text
    body = res.json()
    assert "items" in body
    assert "total" in body
    assert body["total"] >= 2
    assert len(body["items"]) >= 2


# ─── Test 3: GET by id → đúng fields ─────────────────────────────────────────

def test_get_purchase_return_by_id(cr):
    """GET /api/purchase-returns/{id} → trả đúng phiếu với items."""
    client, db = cr
    sup = _make_supplier(db, "NCC_GID001")
    db.commit()

    create_res = client.post(
        "/api/purchase-returns",
        json=_return_payload(sup.id, ly_do="Hàng lỗi"),
    )
    assert create_res.status_code == 201
    return_id = create_res.json()["id"]

    res = client.get(f"/api/purchase-returns/{return_id}")

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == return_id
    assert data["supplier_id"] == sup.id
    assert data["ly_do"] == "Hàng lỗi"
    assert data["loai"] == "tra_hang"
    assert "items" in data
    assert len(data["items"]) == 1
    assert data["items"][0]["ten_hang"] == "NVL trả"


# ─── Test 4: GET nonexistent → 404 ───────────────────────────────────────────

def test_get_nonexistent_return_returns_404(cr):
    """GET /api/purchase-returns/999999 → 404."""
    client, _db = cr
    res = client.get("/api/purchase-returns/999999")
    assert res.status_code == 404


# ─── Test 5: Trạng thái ban đầu là "nhap" ────────────────────────────────────

def test_purchase_return_status(cr):
    """Phiếu mới tạo → trang_thai = nhap."""
    client, db = cr
    sup = _make_supplier(db, "NCC_STAT001")
    db.commit()

    res = client.post("/api/purchase-returns", json=_return_payload(sup.id))

    assert res.status_code == 201
    assert res.json()["trang_thai"] == "nhap"


# ─── Test 6: Duyệt phiếu → trang_thai = "da_duyet" ──────────────────────────

def test_confirm_purchase_return(cr):
    """POST /{id}/duyet → trang_thai = da_duyet, approved_at được set."""
    client, db = cr
    sup = _make_supplier(db, "NCC_DUYET001")
    db.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    assert create_res.status_code == 201
    return_id = create_res.json()["id"]

    duyet_res = client.post(f"/api/purchase-returns/{return_id}/duyet")

    assert duyet_res.status_code == 200, duyet_res.text
    data = duyet_res.json()
    assert data["trang_thai"] == "da_duyet"
    assert data["approved_at"] is not None


# ─── Test 7: Thiếu supplier_id → 422 ─────────────────────────────────────────

def test_purchase_return_requires_supplier(cr):
    """Thiếu supplier_id (required field) → 422 Unprocessable Entity."""
    client, _db = cr
    payload = {
        "ngay": date.today().isoformat(),
        "loai": "tra_hang",
        "tong_tien_hang": 500000,
        # supplier_id bị bỏ qua
    }

    res = client.post("/api/purchase-returns", json=payload)

    assert res.status_code == 422


# ─── Test 8: Filter theo supplier_id ─────────────────────────────────────────

def test_filter_by_supplier(cr):
    """GET ?supplier_id=X → chỉ trả phiếu của NCC đó."""
    client, db = cr
    sup1 = _make_supplier(db, "NCC_FILTA")
    sup2 = _make_supplier(db, "NCC_FILTB")
    db.commit()

    # 2 phiếu cho sup1, 1 phiếu cho sup2
    client.post("/api/purchase-returns", json=_return_payload(sup1.id))
    client.post("/api/purchase-returns", json=_return_payload(sup1.id))
    client.post("/api/purchase-returns", json=_return_payload(sup2.id))

    res = client.get(f"/api/purchase-returns?supplier_id={sup1.id}")

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 2
    for item in body["items"]:
        assert item["supplier_id"] == sup1.id


# ─── Test 9: supplier_id không tồn tại → 404 ─────────────────────────────────

def test_create_return_nonexistent_supplier_returns_404(cr):
    """supplier_id không tồn tại → 404 với message chứa 'nhà cung cấp'."""
    client, _db = cr
    res = client.post("/api/purchase-returns", json=_return_payload(supplier_id=999999))

    assert res.status_code == 404
    assert "nhà cung cấp" in res.json()["detail"].lower()


# ─── Test 10: loai không hợp lệ → 400 ───────────────────────────────────────

def test_create_return_invalid_loai_rejected(cr):
    """loai không thuộc tra_hang/giam_gia → 400."""
    client, db = cr
    sup = _make_supplier(db, "NCC_INV_LOAI")
    db.commit()

    res = client.post("/api/purchase-returns", json=_return_payload(sup.id, loai="sai_loai"))

    assert res.status_code == 400


# ─── Test 11: loai = giam_gia → prefix PGG ───────────────────────────────────

def test_create_giam_gia_return_has_pgg_prefix(cr):
    """loai=giam_gia → so_phieu bắt đầu bằng PGG."""
    client, db = cr
    sup = _make_supplier(db, "NCC_PGG001")
    db.commit()

    res = client.post("/api/purchase-returns", json=_return_payload(sup.id, loai="giam_gia"))

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["loai"] == "giam_gia"
    assert data["so_phieu"].startswith("PGG")


# ─── Test 12: Hủy phiếu nhap → trang_thai = "huy" ────────────────────────────

def test_cancel_purchase_return_success(cr):
    """POST /{id}/huy khi trang_thai=nhap → trang_thai = huy."""
    client, db = cr
    sup = _make_supplier(db, "NCC_HUY001")
    db.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    assert create_res.status_code == 201
    return_id = create_res.json()["id"]

    huy_res = client.post(f"/api/purchase-returns/{return_id}/huy")

    assert huy_res.status_code == 200, huy_res.text
    assert huy_res.json()["trang_thai"] == "huy"


# ─── Test 13: Hủy phiếu đã duyệt → 400 ──────────────────────────────────────

def test_cancel_approved_return_blocked(cr):
    """Phiếu đã duyệt → không được hủy → 400."""
    client, db = cr
    sup = _make_supplier(db, "NCC_BLKHUY")
    db.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    return_id = create_res.json()["id"]
    client.post(f"/api/purchase-returns/{return_id}/duyet")

    huy_res = client.post(f"/api/purchase-returns/{return_id}/huy")

    assert huy_res.status_code == 400
    assert "duyệt" in huy_res.json()["detail"].lower()


# ─── Test 14: Duyệt phiếu đã duyệt → 400 ────────────────────────────────────

def test_approve_already_approved_return_blocked(cr):
    """Duyệt lần 2 phiếu đã duyệt → 400."""
    client, db = cr
    sup = _make_supplier(db, "NCC_DBLDUYET")
    db.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    return_id = create_res.json()["id"]

    client.post(f"/api/purchase-returns/{return_id}/duyet")
    res2 = client.post(f"/api/purchase-returns/{return_id}/duyet")

    assert res2.status_code == 400


# ─── Test 15: Xóa phiếu nhap → 204 ──────────────────────────────────────────

def test_delete_draft_return_returns_204(cr):
    """DELETE /{id} khi trang_thai=nhap → 204; GET sau đó → 404."""
    client, db = cr
    sup = _make_supplier(db, "NCC_DEL001")
    db.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    return_id = create_res.json()["id"]

    del_res = client.delete(f"/api/purchase-returns/{return_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/api/purchase-returns/{return_id}")
    assert get_res.status_code == 404
