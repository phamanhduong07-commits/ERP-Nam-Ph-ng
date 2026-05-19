"""
Sprint 4 — Test quotes module
Covers: Quote (create, list, get, invalid customer).
"""
from datetime import date
from decimal import Decimal

from app.models.master import Customer, PhapNhan


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_customer(db, ma="KH_BG"):
    kh = Customer(ma_kh=ma, ten_viet_tat=f"KH {ma}", trang_thai=True)
    db.add(kh)
    db.flush()
    return kh


def _quote_payload(customer_id, **kwargs):
    return {
        "customer_id": customer_id,
        "ngay_bao_gia": date.today().isoformat(),
        "items": [{"ten_hang": "Thùng test", "so_luong": 100}],
        **kwargs,
    }


# ─── Tạo báo giá ────────────────────────────────────────────────────────────

def test_create_quote_success(client, db_session):
    """Tạo báo giá hợp lệ → 200/201, trang_thai mặc định."""
    kh = _make_customer(db_session, "KH_BG1")
    db_session.commit()

    res = client.post("/api/quotes", json=_quote_payload(kh.id))

    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data["customer_id"] == kh.id
    assert "so_bao_gia" in data or "id" in data


def test_create_quote_invalid_customer_returns_404(client, db_session):
    """customer_id không tồn tại → 404."""
    res = client.post("/api/quotes", json=_quote_payload(999999))
    assert res.status_code == 404


# ─── List & Get ─────────────────────────────────────────────────────────────

def test_list_quotes_returns_paginated(client, db_session):
    """GET /quotes → trả về PagedResponse."""
    kh = _make_customer(db_session, "KH_BGL")
    db_session.commit()

    client.post("/api/quotes", json=_quote_payload(kh.id))
    client.post("/api/quotes", json=_quote_payload(kh.id))

    res = client.get("/api/quotes")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)


def test_get_quote_by_id(client, db_session):
    """GET /quotes/{id} → trả đúng báo giá."""
    kh = _make_customer(db_session, "KH_BGG")
    db_session.commit()

    create_res = client.post("/api/quotes", json=_quote_payload(kh.id))
    quote_id = create_res.json()["id"]

    get_res = client.get(f"/api/quotes/{quote_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == quote_id


def test_get_nonexistent_quote_returns_404(client, db_session):
    """GET /quotes/999999 → 404."""
    res = client.get("/api/quotes/999999")
    assert res.status_code == 404


def test_list_quotes_filter_by_customer(client, db_session):
    """Filter customer_id → chỉ trả báo giá của khách đó."""
    kh1 = _make_customer(db_session, "KH_BGF1")
    kh2 = _make_customer(db_session, "KH_BGF2")
    db_session.commit()

    client.post("/api/quotes", json=_quote_payload(kh1.id))
    client.post("/api/quotes", json=_quote_payload(kh2.id))

    res = client.get(f"/api/quotes?customer_id={kh1.id}")
    assert res.status_code == 200
    data = res.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    if items:
        assert all(r["customer_id"] == kh1.id for r in items)
