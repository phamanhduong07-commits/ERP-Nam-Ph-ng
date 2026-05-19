"""
Sprint 3.2 — Test purchase returns module
Covers: PurchaseReturn (create, approve, invalid supplier, invalid loai).
"""
from datetime import date
from decimal import Decimal

from app.models.master import Supplier
from app.models.purchase import PurchaseReturn


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_supplier(db, ma="NCC_TR"):
    sup = Supplier(ma_ncc=ma, ten_viet_tat=f"NCC {ma}")
    db.add(sup)
    db.flush()
    return sup


def _return_payload(supplier_id, *, loai="tra_hang", **kwargs):
    return {
        "supplier_id": supplier_id,
        "ngay": date.today().isoformat(),
        "loai": loai,
        "tong_tien_hang": 2_000_000,
        "items": [{"ten_hang": "NVL trả", "so_luong": 50, "dvt": "Kg", "don_gia": 40000}],
        **kwargs,
    }


# ─── Tạo phiếu trả hàng ─────────────────────────────────────────────────────

def test_create_purchase_return_success(client, db_session):
    """Tạo phiếu trả hàng hợp lệ → 201, trang_thai=nhap."""
    sup = _make_supplier(db_session, "NCC_TR1")
    db_session.commit()

    res = client.post("/api/purchase-returns", json=_return_payload(sup.id))

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["trang_thai"] == "nhap"
    assert data["so_phieu"].startswith("PTH")
    assert float(data["tong_tien_hang"]) == 2_000_000.0


def test_create_purchase_return_giam_gia_type(client, db_session):
    """loai=giam_gia → so_phieu bắt đầu bằng PGG."""
    sup = _make_supplier(db_session, "NCC_TR2")
    db_session.commit()

    res = client.post("/api/purchase-returns", json=_return_payload(sup.id, loai="giam_gia"))

    assert res.status_code == 201, res.text
    assert res.json()["so_phieu"].startswith("PGG")


def test_create_return_invalid_loai_rejected(client, db_session):
    """loai không hợp lệ → 400."""
    sup = _make_supplier(db_session, "NCC_TR3")
    db_session.commit()

    res = client.post("/api/purchase-returns", json=_return_payload(sup.id, loai="sai_loai"))
    assert res.status_code == 400


def test_create_return_nonexistent_supplier_returns_404(client, db_session):
    """supplier_id không tồn tại → 404."""
    res = client.post("/api/purchase-returns", json=_return_payload(999999))
    assert res.status_code == 404


# ─── Get & List ─────────────────────────────────────────────────────────────

def test_get_purchase_return_by_id(client, db_session):
    """GET /purchase-returns/{id} → trả đúng phiếu."""
    sup = _make_supplier(db_session, "NCC_TRG")
    db_session.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    return_id = create_res.json()["id"]

    get_res = client.get(f"/api/purchase-returns/{return_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == return_id


def test_get_nonexistent_return_returns_404(client, db_session):
    """GET /purchase-returns/999999 → 404."""
    res = client.get("/api/purchase-returns/999999")
    assert res.status_code == 404


# ─── Duyệt phiếu ────────────────────────────────────────────────────────────

def test_approve_purchase_return_changes_status(client, db_session):
    """Duyệt phiếu trả hàng → trang_thai = da_duyet."""
    sup = _make_supplier(db_session, "NCC_TRA")
    db_session.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    return_id = create_res.json()["id"]

    approve_res = client.post(f"/api/purchase-returns/{return_id}/duyet")
    assert approve_res.status_code == 200, approve_res.text
    assert approve_res.json()["trang_thai"] == "da_duyet"


def test_approve_already_approved_return_blocked(client, db_session):
    """Duyệt phiếu đã duyệt → 400."""
    sup = _make_supplier(db_session, "NCC_TRB")
    db_session.commit()

    create_res = client.post("/api/purchase-returns", json=_return_payload(sup.id))
    return_id = create_res.json()["id"]

    client.post(f"/api/purchase-returns/{return_id}/duyet")
    res2 = client.post(f"/api/purchase-returns/{return_id}/duyet")
    assert res2.status_code == 400
