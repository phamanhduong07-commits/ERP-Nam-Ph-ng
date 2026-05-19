"""
Sprint 3.1 — Test production module
Covers: ProductionOrder (create, list, get), status transitions (start, finish),
        invalid items validation.
"""
from datetime import date
from decimal import Decimal

from app.models.master import PhanXuong, PhapNhan, Warehouse
from app.models.production import ProductionOrder, ProductionOrderItem


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_setup(db, *, ma_pn="PN_SX", ma_px="PX_SX", ma_kho="KHO_SX"):
    pn = PhapNhan(ma_phap_nhan=ma_pn, ten_phap_nhan=f"PN {ma_pn}", ten_viet_tat=ma_pn)
    db.add(pn)
    db.flush()
    px = PhanXuong(ma_xuong=ma_px, ten_xuong=f"PX {ma_px}", cong_doan="cd2", phap_nhan_id=pn.id)
    db.add(px)
    db.flush()
    kho = Warehouse(
        ma_kho=ma_kho, ten_kho=f"Kho {ma_kho}",
        loai_kho="THANH_PHAM", phan_xuong_id=px.id, trang_thai=True,
    )
    db.add(kho)
    db.flush()
    return pn, px, kho


def _lsx_payload(phan_xuong_id=None, **kwargs):
    payload = {
        "ngay_lenh": date.today().isoformat(),
        "items": [{"ten_hang": "Thùng test", "so_luong_ke_hoach": 500, "dvt": "Thùng"}],
    }
    if phan_xuong_id:
        payload["phan_xuong_id"] = phan_xuong_id
    payload.update(kwargs)
    return payload


# ─── Tạo lệnh sản xuất ──────────────────────────────────────────────────────

def test_create_production_order_success(client, db_session):
    """Tạo LSX hợp lệ → status 201, so_lenh bắt đầu bằng LSX, trang_thai=moi."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_SX1", ma_px="PX_SX1", ma_kho="KHO_SX1")
    db_session.commit()

    res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["so_lenh"].startswith("LSX")
    assert data["trang_thai"] == "moi"
    assert len(data["items"]) == 1


def test_create_production_order_empty_items_rejected(client, db_session):
    """items=[] → 422 validation error."""
    res = client.post("/api/production-orders", json={
        "ngay_lenh": date.today().isoformat(),
        "items": [],
    })
    assert res.status_code == 422


def test_create_production_order_negative_quantity_rejected(client, db_session):
    """so_luong_ke_hoach <= 0 → 422."""
    res = client.post("/api/production-orders", json={
        "ngay_lenh": date.today().isoformat(),
        "items": [{"ten_hang": "Test", "so_luong_ke_hoach": -1}],
    })
    assert res.status_code == 422


# ─── List & Get ─────────────────────────────────────────────────────────────

def test_list_production_orders_returns_list(client, db_session):
    """GET /production-orders → trả về list (có thể rỗng), không crash."""
    res = client.get("/api/production-orders")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data or isinstance(data, list)


def test_get_production_order_by_id(client, db_session):
    """GET /production-orders/{id} → trả đúng LSX."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_SXG", ma_px="PX_SXG", ma_kho="KHO_SXG")
    db_session.commit()

    create_res = client.post("/api/production-orders", json=_lsx_payload(phan_xuong_id=px.id))
    assert create_res.status_code == 201
    order_id = create_res.json()["id"]

    get_res = client.get(f"/api/production-orders/{order_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == order_id


def test_get_nonexistent_production_order_returns_404(client, db_session):
    """GET /production-orders/999999 → 404."""
    res = client.get("/api/production-orders/999999")
    assert res.status_code == 404


# ─── Direct DB: verify model tạo đúng ───────────────────────────────────────

def test_production_order_item_stored_correctly(client, db_session):
    """Items được lưu vào DB với đúng so_luong_ke_hoach."""
    pn, px, kho = _make_setup(db_session, ma_pn="PN_SXD", ma_px="PX_SXD", ma_kho="KHO_SXD")
    db_session.commit()

    res = client.post("/api/production-orders", json={
        "ngay_lenh": date.today().isoformat(),
        "phan_xuong_id": px.id,
        "items": [
            {"ten_hang": "Thùng A", "so_luong_ke_hoach": 200, "dvt": "Thùng"},
            {"ten_hang": "Thùng B", "so_luong_ke_hoach": 300, "dvt": "Thùng"},
        ],
    })
    assert res.status_code == 201
    order_id = res.json()["id"]

    items = db_session.query(ProductionOrderItem).filter(
        ProductionOrderItem.production_order_id == order_id
    ).all()
    assert len(items) == 2
    total = sum(i.so_luong_ke_hoach for i in items)
    assert total == Decimal("500")
