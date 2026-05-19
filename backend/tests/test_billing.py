"""
Sprint 1.2 — Test billing module
Covers: SalesInvoice (create, tính VAT, duplicate delivery block, list filter).
"""
from datetime import date

from app.models.master import Customer, PhapNhan


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_customer(db, ma="KH_BILL"):
    kh = Customer(ma_kh=ma, ten_viet_tat=f"KH {ma}")
    db.add(kh)
    db.flush()
    return kh


def _make_phap_nhan(db, ma="PN_BILL"):
    pn = PhapNhan(ma_phap_nhan=ma, ten_phap_nhan=f"PN {ma}", ten_viet_tat=ma)
    db.add(pn)
    db.flush()
    return pn


# ─── Tạo hóa đơn thủ công ───────────────────────────────────────────────────

def test_create_invoice_calculates_vat_automatically(client, db_session):
    """tong_tien_hang=10M, VAT 10% → tien_vat=1M, tong_cong=11M (tự tính)."""
    kh = _make_customer(db_session, "KH_B1")
    db_session.commit()

    res = client.post("/api/billing/invoices", json={
        "customer_id": kh.id,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 10_000_000,
        "ty_le_vat": 10,
    })

    assert res.status_code == 200, res.text
    data = res.json()
    assert float(data["tien_vat"]) == 1_000_000.0
    assert float(data["tong_cong"]) == 11_000_000.0
    assert data["trang_thai"] == "nhap"


def test_create_invoice_zero_vat(client, db_session):
    """VAT 0% → tien_vat = 0, tong_cong = tong_tien_hang."""
    kh = _make_customer(db_session, "KH_B2")
    db_session.commit()

    res = client.post("/api/billing/invoices", json={
        "customer_id": kh.id,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 5_000_000,
        "ty_le_vat": 0,
    })

    assert res.status_code == 200, res.text
    data = res.json()
    assert float(data["tien_vat"]) == 0.0
    assert float(data["tong_cong"]) == 5_000_000.0


def test_create_invoice_nonexistent_customer_returns_404(client, db_session):
    """Customer không tồn tại → 404."""
    res = client.post("/api/billing/invoices", json={
        "customer_id": 999999,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 1_000_000,
    })
    assert res.status_code == 404


def test_invoice_has_phap_nhan(client, db_session):
    """Hóa đơn được gán phap_nhan_id → trả về đúng."""
    kh = _make_customer(db_session, "KH_B3")
    pn = _make_phap_nhan(db_session, "PN_B3")
    db_session.commit()

    res = client.post("/api/billing/invoices", json={
        "customer_id": kh.id,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 2_000_000,
        "phap_nhan_id": pn.id,
    })

    assert res.status_code == 200
    assert res.json()["phap_nhan_id"] == pn.id


# ─── List filter ────────────────────────────────────────────────────────────

def test_list_invoices_filter_by_customer(client, db_session):
    """Filter customer_id → chỉ trả hóa đơn của khách đó."""
    kh1 = _make_customer(db_session, "KH_BL1")
    kh2 = _make_customer(db_session, "KH_BL2")
    db_session.commit()

    client.post("/api/billing/invoices", json={
        "customer_id": kh1.id,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 1_000_000,
    })
    client.post("/api/billing/invoices", json={
        "customer_id": kh2.id,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 2_000_000,
    })

    res = client.get(f"/api/billing/invoices?customer_id={kh1.id}")
    assert res.status_code == 200
    rows = res.json()
    items = rows.get("items", rows) if isinstance(rows, dict) else rows
    assert all(r["customer_id"] == kh1.id for r in items)


def test_get_invoice_by_id(client, db_session):
    """GET /invoices/{id} → trả đúng hóa đơn."""
    kh = _make_customer(db_session, "KH_BG1")
    db_session.commit()

    create_res = client.post("/api/billing/invoices", json={
        "customer_id": kh.id,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 3_000_000,
    })
    inv_id = create_res.json()["id"]

    get_res = client.get(f"/api/billing/invoices/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == inv_id
    assert float(get_res.json()["tong_tien_hang"]) == 3_000_000.0
