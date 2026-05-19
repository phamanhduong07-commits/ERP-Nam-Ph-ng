"""
Sprint 2.2 — Test sales module
Covers: SalesOrder (create, list, get, invalid customer/product),
        status transitions (moi → da_duyet).
"""
from datetime import date
from decimal import Decimal

from app.models.master import Customer, Product, PhapNhan
from app.models.sales import SalesOrder


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_customer(db, ma="KH_SO"):
    kh = Customer(ma_kh=ma, ten_viet_tat=f"KH {ma}", trang_thai=True)
    db.add(kh)
    db.flush()
    return kh


def _make_product(db, ma="SP001"):
    p = Product(
        ma_hang=ma,
        ma_amis=f"AMIS_{ma}",
        ten_hang=f"Sản phẩm {ma}",
        dvt="Thùng",
        trang_thai=True,
    )
    db.add(p)
    db.flush()
    return p


def _make_phap_nhan(db, ma="PN_SO"):
    pn = PhapNhan(ma_phap_nhan=ma, ten_phap_nhan=f"PN {ma}", ten_viet_tat=ma)
    db.add(pn)
    db.flush()
    return pn


def _order_payload(customer_id, product_id, **kwargs):
    return {
        "customer_id": customer_id,
        "ngay_don": date.today().isoformat(),
        "items": [{"product_id": product_id, "so_luong": 100, "don_gia": 5000}],
        **kwargs,
    }


# ─── Tạo đơn hàng ───────────────────────────────────────────────────────────

def test_create_sales_order_success(client, db_session):
    """Tạo SO hợp lệ → status 201, trang_thai=moi, tong_tien đúng."""
    kh = _make_customer(db_session, "KH_SO1")
    sp = _make_product(db_session, "SP_SO1")
    db_session.commit()

    res = client.post("/api/sales-orders", json=_order_payload(kh.id, sp.id))

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["trang_thai"] == "moi"
    assert float(data["tong_tien"]) == 500_000.0
    assert data["so_don"].startswith("DH")


def test_create_sales_order_invalid_customer_returns_404(client, db_session):
    """Customer không tồn tại → 404."""
    sp = _make_product(db_session, "SP_SO2")
    db_session.commit()

    res = client.post("/api/sales-orders", json=_order_payload(999999, sp.id))
    assert res.status_code == 404


def test_create_sales_order_inactive_customer_returns_404(client, db_session):
    """Customer trang_thai=False → 404 (không cho tạo đơn)."""
    kh = Customer(ma_kh="KH_INACTIVE", ten_viet_tat="KH Inactive", trang_thai=False)
    db_session.add(kh)
    sp = _make_product(db_session, "SP_SO3")
    db_session.commit()

    res = client.post("/api/sales-orders", json=_order_payload(kh.id, sp.id))
    assert res.status_code == 404


def test_create_sales_order_invalid_product_returns_404(client, db_session):
    """product_id không tồn tại → 404."""
    kh = _make_customer(db_session, "KH_SO4")
    db_session.commit()

    res = client.post("/api/sales-orders", json=_order_payload(kh.id, 999999))
    assert res.status_code == 404


def test_create_sales_order_empty_items_returns_422(client, db_session):
    """items=[] → 422 validation error."""
    kh = _make_customer(db_session, "KH_SO5")
    db_session.commit()

    res = client.post("/api/sales-orders", json={
        "customer_id": kh.id,
        "ngay_don": date.today().isoformat(),
        "items": [],
    })
    assert res.status_code == 422


# ─── List & Get ─────────────────────────────────────────────────────────────

def test_list_sales_orders_returns_paginated(client, db_session):
    """GET /sales-orders → trả về PagedResponse với items và total."""
    kh = _make_customer(db_session, "KH_SOL1")
    sp = _make_product(db_session, "SP_SOL1")
    db_session.commit()

    for i in range(3):
        client.post("/api/sales-orders", json=_order_payload(kh.id, sp.id))

    res = client.get("/api/sales-orders")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 3


def test_get_sales_order_by_id(client, db_session):
    """GET /sales-orders/{id} → trả đúng đơn hàng."""
    kh = _make_customer(db_session, "KH_SOG1")
    sp = _make_product(db_session, "SP_SOG1")
    db_session.commit()

    create_res = client.post("/api/sales-orders", json=_order_payload(kh.id, sp.id))
    order_id = create_res.json()["id"]

    get_res = client.get(f"/api/sales-orders/{order_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == order_id
    assert len(get_res.json()["items"]) == 1


def test_get_nonexistent_sales_order_returns_404(client, db_session):
    """GET /sales-orders/999999 → 404."""
    res = client.get("/api/sales-orders/999999")
    assert res.status_code == 404


def test_list_sales_orders_filter_by_customer(client, db_session):
    """Filter customer_id → chỉ trả đơn của khách đó."""
    kh1 = _make_customer(db_session, "KH_SOF1")
    kh2 = _make_customer(db_session, "KH_SOF2")
    sp = _make_product(db_session, "SP_SOF1")
    db_session.commit()

    client.post("/api/sales-orders", json=_order_payload(kh1.id, sp.id))
    client.post("/api/sales-orders", json=_order_payload(kh2.id, sp.id))

    res = client.get(f"/api/sales-orders?customer_id={kh1.id}")
    assert res.status_code == 200
    items = res.json()["items"]
    assert all(item["customer_id"] == kh1.id for item in items)


# ─── Update trạng thái ───────────────────────────────────────────────────────

def test_approve_sales_order_changes_status(client, db_session):
    """PATCH /approve → trang_thai = da_duyet."""
    kh = _make_customer(db_session, "KH_SOU1")
    sp = _make_product(db_session, "SP_SOU1")
    db_session.commit()

    create_res = client.post("/api/sales-orders", json=_order_payload(kh.id, sp.id))
    order_id = create_res.json()["id"]

    approve_res = client.patch(f"/api/sales-orders/{order_id}/approve")
    assert approve_res.status_code == 200, approve_res.text
    assert approve_res.json()["trang_thai"] == "da_duyet"
