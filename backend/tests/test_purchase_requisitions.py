"""
Sprint 4 — Test purchase_requisitions module
Covers: YMH (create, list, get, approve, cancel).
"""
from datetime import date

from app.models.purchase_requisition import PurchaseRequisition


# ─── helpers ────────────────────────────────────────────────────────────────

def _ymh_payload(**kwargs):
    return {
        "ngay_yeu_cau": date.today().isoformat(),
        "items": [{"ten_hang": "NVL test", "so_luong": 100, "dvt": "Kg", "ghi_chu": "Cần gấp"}],
        **kwargs,
    }


# ─── Tạo yêu cầu mua hàng ───────────────────────────────────────────────────

def test_create_ymh_success(client, db_session):
    """Tạo YMH hợp lệ → 201, so_ymh bắt đầu bằng YMH, trang_thai=nhap."""
    res = client.post("/api/purchase-requisitions", json=_ymh_payload())

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["so_ymh"].startswith("YMH")
    assert data["trang_thai"] == "nhap"
    assert len(data["items"]) == 1


def test_create_ymh_empty_items_rejected(client, db_session):
    """items=[] → 400 (router validate) hoặc 422 (pydantic)."""
    res = client.post("/api/purchase-requisitions", json={
        "ngay_yeu_cau": date.today().isoformat(),
        "items": [],
    })
    assert res.status_code in (400, 422)


# ─── List & Get ─────────────────────────────────────────────────────────────

def test_list_ymh_returns_list(client, db_session):
    """GET /purchase-requisitions → trả về list."""
    client.post("/api/purchase-requisitions", json=_ymh_payload())

    res = client.get("/api/purchase-requisitions")
    assert res.status_code == 200
    assert isinstance(res.json(), list) or "items" in res.json()


def test_get_ymh_by_id(client, db_session):
    """GET /purchase-requisitions/{id} → trả đúng YMH."""
    create_res = client.post("/api/purchase-requisitions", json=_ymh_payload())
    ymh_id = create_res.json()["id"]

    get_res = client.get(f"/api/purchase-requisitions/{ymh_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == ymh_id


def test_get_nonexistent_ymh_returns_404(client, db_session):
    """GET /purchase-requisitions/999999 → 404."""
    res = client.get("/api/purchase-requisitions/999999")
    assert res.status_code == 404


# ─── Approve & Cancel ───────────────────────────────────────────────────────

def test_approve_ymh_changes_status(client, db_session):
    """Duyệt YMH (nhap → duyet_pb) → trang_thai = duyet_pb."""
    create_res = client.post("/api/purchase-requisitions", json=_ymh_payload())
    ymh_id = create_res.json()["id"]

    approve_res = client.post(f"/api/purchase-requisitions/{ymh_id}/duyet-pb")
    assert approve_res.status_code == 200, approve_res.text
    assert approve_res.json()["trang_thai"] == "duyet_pb"


def test_cancel_ymh_changes_status(client, db_session):
    """Hủy YMH → ok=True."""
    create_res = client.post("/api/purchase-requisitions", json=_ymh_payload())
    ymh_id = create_res.json()["id"]

    cancel_res = client.post(f"/api/purchase-requisitions/{ymh_id}/huy")
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["ok"] is True
