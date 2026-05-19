"""
Sprint 8 — Test CRM module
Covers: CustomerInteraction CRUD, credit-alerts API.
"""
from datetime import date


def _make_customer(client, ma="KH_CRM1"):
    res = client.post("/api/customers", json={
        "ma_kh": ma,
        "ten_viet_tat": f"KH {ma}",
        "no_tran": 10000000,
    })
    assert res.status_code == 201, res.text
    return res.json()


def _make_interaction(client, customer_id: int, loai="goi_dien"):
    res = client.post("/api/crm/interactions", json={
        "customer_id": customer_id,
        "loai": loai,
        "ngay": date.today().isoformat(),
        "noi_dung": "Gọi hỏi tiến độ đơn hàng",
        "ket_qua": "tich_cuc",
    })
    assert res.status_code == 201, res.text
    return res.json()


# ─── Create ───────────────────────────────────────────────────────────────────

def test_create_interaction_returns_201(client, db_session):
    """Tạo tương tác hợp lệ → 201, loai đúng."""
    c = _make_customer(client, "KH_C1")
    i = _make_interaction(client, c["id"], loai="gap_mat")
    assert i["loai"] == "gap_mat"
    assert i["ket_qua"] == "tich_cuc"


def test_invalid_loai_returns_422(client, db_session):
    """loai không hợp lệ → 422."""
    c = _make_customer(client, "KH_C2")
    res = client.post("/api/crm/interactions", json={
        "customer_id": c["id"],
        "loai": "sai_loai",
        "ngay": date.today().isoformat(),
    })
    assert res.status_code == 422


def test_invalid_ket_qua_returns_422(client, db_session):
    """ket_qua không hợp lệ → 422."""
    c = _make_customer(client, "KH_C3")
    res = client.post("/api/crm/interactions", json={
        "customer_id": c["id"],
        "loai": "email",
        "ngay": date.today().isoformat(),
        "ket_qua": "hay_lam",
    })
    assert res.status_code == 422


def test_create_interaction_unknown_customer_returns_404(client, db_session):
    """customer_id không tồn tại → 404."""
    res = client.post("/api/crm/interactions", json={
        "customer_id": 999999,
        "loai": "goi_dien",
        "ngay": date.today().isoformat(),
    })
    assert res.status_code == 404


# ─── List / Get ───────────────────────────────────────────────────────────────

def test_list_interactions(client, db_session):
    """GET /interactions → list, filter by customer_id works."""
    c = _make_customer(client, "KH_L1")
    _make_interaction(client, c["id"])
    _make_interaction(client, c["id"], loai="email")

    res = client.get(f"/api/crm/interactions?customer_id={c['id']}")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    assert all(d["customer_id"] == c["id"] for d in data)


def test_get_interaction_by_id(client, db_session):
    """GET /interactions/{id} → trả đúng bản ghi."""
    c = _make_customer(client, "KH_G1")
    i = _make_interaction(client, c["id"])
    res = client.get(f"/api/crm/interactions/{i['id']}")
    assert res.status_code == 200
    assert res.json()["id"] == i["id"]


# ─── Update / Delete ──────────────────────────────────────────────────────────

def test_patch_interaction_updates_ket_qua(client, db_session):
    """PATCH → cập nhật ket_qua."""
    c = _make_customer(client, "KH_P1")
    i = _make_interaction(client, c["id"])
    res = client.patch(f"/api/crm/interactions/{i['id']}", json={"ket_qua": "tieu_cuc"})
    assert res.status_code == 200
    assert res.json()["ket_qua"] == "tieu_cuc"


def test_delete_interaction(client, db_session):
    """DELETE → 204, GET sau đó → 404."""
    c = _make_customer(client, "KH_D1")
    i = _make_interaction(client, c["id"])
    res = client.delete(f"/api/crm/interactions/{i['id']}")
    assert res.status_code == 204
    res2 = client.get(f"/api/crm/interactions/{i['id']}")
    assert res2.status_code == 404


# ─── Credit alerts ────────────────────────────────────────────────────────────

def test_credit_alerts_returns_list(client, db_session):
    """GET /credit-alerts → list (có thể rỗng, không lỗi)."""
    res = client.get("/api/crm/credit-alerts")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
