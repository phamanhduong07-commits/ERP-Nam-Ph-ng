"""
Tests for billing module — SalesInvoice CRUD, VAT calculation, cancel, issue, filters.

URL prefix: /api/billing/invoices
"""
from datetime import date

from app.models.master import Customer, PhapNhan


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_customer(db, ma="KH_BILL"):
    kh = Customer(ma_kh=ma, ten_viet_tat=f"KH {ma}", ten_don_vi=f"Công ty {ma}")
    db.add(kh)
    db.flush()
    return kh


def _make_phap_nhan(db, ma="PN_BILL"):
    pn = PhapNhan(ma_phap_nhan=ma, ten_phap_nhan=f"PN {ma}", ten_viet_tat=ma)
    db.add(pn)
    db.flush()
    return pn


def _invoice_payload(customer_id: int, **overrides) -> dict:
    """Minimal valid payload for POST /api/billing/invoices."""
    base = {
        "customer_id": customer_id,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 10_000_000,
        "ty_le_vat": 10,
    }
    base.update(overrides)
    return base


# ─── Test 1: Tạo hóa đơn — 200, có so_hoa_don tự sinh ─────────────────────

def test_create_sales_invoice(client, db_session):
    """Tạo hóa đơn cơ bản → 200, so_hoa_don được sinh tự động, trang_thai='nhap'."""
    kh = _make_customer(db_session, "KH_B1")
    db_session.commit()

    res = client.post("/api/billing/invoices", json=_invoice_payload(kh.id))

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["customer_id"] == kh.id
    assert data["so_hoa_don"] is not None
    assert data["so_hoa_don"].startswith("HD")
    assert data["trang_thai"] == "nhap"


# ─── Test 2: List hóa đơn — 200, trả về dict có key "items" ────────────────

def test_list_sales_invoices(client, db_session):
    """GET /invoices → 200, trả về dict có total và items."""
    kh = _make_customer(db_session, "KH_B2")
    db_session.commit()
    client.post("/api/billing/invoices", json=_invoice_payload(kh.id))
    client.post("/api/billing/invoices", json=_invoice_payload(kh.id))

    res = client.get("/api/billing/invoices")

    assert res.status_code == 200, res.text
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 2
    assert isinstance(data["items"], list)


# ─── Test 3: GET theo id — đúng field ───────────────────────────────────────

def test_get_invoice_by_id(client, db_session):
    """GET /invoices/{id} → trả đúng hóa đơn với đầy đủ field."""
    kh = _make_customer(db_session, "KH_BG1")
    db_session.commit()

    create_res = client.post("/api/billing/invoices", json=_invoice_payload(
        kh.id, ten_don_vi="Công ty Test ABC",
    ))
    assert create_res.status_code == 200
    inv_id = create_res.json()["id"]

    res = client.get(f"/api/billing/invoices/{inv_id}")

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == inv_id
    assert data["customer_id"] == kh.id
    assert "tong_tien_hang" in data
    assert "tien_vat" in data
    assert "tong_cong" in data


# ─── Test 4: tong_tien_hang + VAT 10% tính đúng ────────────────────────────

def test_invoice_tong_tien_calculation(client, db_session):
    """tong_tien_hang=10M, VAT 10% → tien_vat=1M, tong_cong=11M (tự tính)."""
    kh = _make_customer(db_session, "KH_B_VAT10")
    db_session.commit()

    res = client.post("/api/billing/invoices", json=_invoice_payload(
        kh.id, tong_tien_hang=10_000_000, ty_le_vat=10,
    ))

    assert res.status_code == 200, res.text
    data = res.json()
    assert float(data["tong_tien_hang"]) == 10_000_000.0
    assert float(data["tien_vat"]) == 1_000_000.0
    assert float(data["tong_cong"]) == 11_000_000.0


# ─── Test 5: Hủy hóa đơn đã phát hành — trang_thai = 'huy' ─────────────────

def test_cancel_invoice(client, db_session):
    """Phát hành rồi hủy → trang_thai = 'huy'."""
    kh = _make_customer(db_session, "KH_B_CANCEL")
    db_session.commit()
    create_res = client.post("/api/billing/invoices", json=_invoice_payload(kh.id))
    assert create_res.status_code == 200
    invoice_id = create_res.json()["id"]

    # Phát hành trước (nhap → da_phat_hanh)
    issue_res = client.patch(f"/api/billing/invoices/{invoice_id}/issue")
    assert issue_res.status_code == 200
    assert issue_res.json()["trang_thai"] == "da_phat_hanh"

    # Hủy
    cancel_res = client.patch(f"/api/billing/invoices/{invoice_id}/cancel")
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["trang_thai"] == "huy"


# ─── Test 6: Hủy hóa đơn nháp (không cần phát hành) ────────────────────────

def test_cancel_draft_invoice(client, db_session):
    """Hủy hóa đơn ở trạng thái nháp → trang_thai = 'huy'."""
    kh = _make_customer(db_session, "KH_B_CANCEL_DRAFT")
    db_session.commit()
    create_res = client.post("/api/billing/invoices", json=_invoice_payload(kh.id))
    assert create_res.status_code == 200
    invoice_id = create_res.json()["id"]

    cancel_res = client.patch(f"/api/billing/invoices/{invoice_id}/cancel")
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["trang_thai"] == "huy"


# ─── Test 7: ty_le_vat không hợp lệ → 422 ──────────────────────────────────

def test_invalid_vat_pct_returns_422(client, db_session):
    """ty_le_vat=7 (không nằm trong 0/5/8/10) → 422."""
    kh = _make_customer(db_session, "KH_B_VAT422")
    db_session.commit()

    res = client.post("/api/billing/invoices", json=_invoice_payload(kh.id, ty_le_vat=7))

    assert res.status_code == 422, res.text


# ─── Test 8: Filter theo trang_thai ─────────────────────────────────────────

def test_list_with_filter_by_trang_thai(client, db_session):
    """Filter ?trang_thai=nhap → chỉ trả hóa đơn nhap; ?trang_thai=huy → chỉ huy."""
    kh = _make_customer(db_session, "KH_B_FILTER")
    db_session.commit()

    # Tạo 1 hóa đơn → phát hành → hủy
    r1 = client.post("/api/billing/invoices", json=_invoice_payload(kh.id))
    assert r1.status_code == 200
    inv_id = r1.json()["id"]
    client.patch(f"/api/billing/invoices/{inv_id}/issue")
    client.patch(f"/api/billing/invoices/{inv_id}/cancel")

    # Tạo 1 hóa đơn nhap mới
    r2 = client.post("/api/billing/invoices", json=_invoice_payload(kh.id))
    assert r2.status_code == 200

    # Filter nhap
    res_nhap = client.get("/api/billing/invoices", params={"trang_thai": "nhap"})
    assert res_nhap.status_code == 200
    items_nhap = res_nhap.json()["items"]
    assert all(i["trang_thai"] == "nhap" for i in items_nhap)

    # Filter huy
    res_huy = client.get("/api/billing/invoices", params={"trang_thai": "huy"})
    assert res_huy.status_code == 200
    items_huy = res_huy.json()["items"]
    assert all(i["trang_thai"] == "huy" for i in items_huy)


# ─── Test 9: Tạo hóa đơn cho KH không tồn tại → 404 ────────────────────────

def test_create_invoice_nonexistent_customer_returns_404(client, db_session):
    """customer_id không tồn tại → 404."""
    res = client.post("/api/billing/invoices", json={
        "customer_id": 999999,
        "ngay_hoa_don": date.today().isoformat(),
        "tong_tien_hang": 1_000_000,
    })
    assert res.status_code == 404


# ─── Test 10: VAT 0% — tien_vat = 0, tong_cong = tong_tien_hang ─────────────

def test_create_invoice_zero_vat(client, db_session):
    """VAT 0% → tien_vat = 0, tong_cong = tong_tien_hang."""
    kh = _make_customer(db_session, "KH_B_VAT0")
    db_session.commit()

    res = client.post("/api/billing/invoices", json=_invoice_payload(
        kh.id, tong_tien_hang=5_000_000, ty_le_vat=0,
    ))

    assert res.status_code == 200, res.text
    data = res.json()
    assert float(data["tien_vat"]) == 0.0
    assert float(data["tong_cong"]) == 5_000_000.0


# ─── Test 11: Phát hành hóa đơn — trang_thai = 'da_phat_hanh' ──────────────

def test_issue_invoice(client, db_session):
    """PATCH /invoices/{id}/issue → trang_thai = 'da_phat_hanh'."""
    kh = _make_customer(db_session, "KH_B_ISSUE")
    db_session.commit()
    create_res = client.post("/api/billing/invoices", json=_invoice_payload(kh.id))
    assert create_res.status_code == 200
    invoice_id = create_res.json()["id"]

    issue_res = client.patch(f"/api/billing/invoices/{invoice_id}/issue")
    assert issue_res.status_code == 200, issue_res.text
    assert issue_res.json()["trang_thai"] == "da_phat_hanh"


# ─── Test 12: Hóa đơn có phap_nhan_id → trả về đúng ────────────────────────

def test_invoice_has_phap_nhan(client, db_session):
    """Hóa đơn được gán phap_nhan_id → response trả phap_nhan_id đúng."""
    kh = _make_customer(db_session, "KH_B_PN")
    pn = _make_phap_nhan(db_session, "PN_BILL")
    db_session.commit()

    res = client.post("/api/billing/invoices", json=_invoice_payload(
        kh.id, phap_nhan_id=pn.id,
    ))

    assert res.status_code == 200, res.text
    assert res.json()["phap_nhan_id"] == pn.id


# ─── Test 13: Filter theo customer_id ───────────────────────────────────────

def test_list_invoices_filter_by_customer(client, db_session):
    """?customer_id=X → chỉ trả hóa đơn của khách X."""
    kh1 = _make_customer(db_session, "KH_BL1")
    kh2 = _make_customer(db_session, "KH_BL2")
    db_session.commit()

    client.post("/api/billing/invoices", json=_invoice_payload(kh1.id, tong_tien_hang=1_000_000))
    client.post("/api/billing/invoices", json=_invoice_payload(kh2.id, tong_tien_hang=2_000_000))

    res = client.get(f"/api/billing/invoices?customer_id={kh1.id}")
    assert res.status_code == 200
    rows = res.json()
    items = rows.get("items", rows) if isinstance(rows, dict) else rows
    assert len(items) >= 1
    assert all(r["customer_id"] == kh1.id for r in items)


# ─── Test 14: GET hóa đơn không tồn tại → 404 ──────────────────────────────

def test_get_nonexistent_invoice_returns_404(client, db_session):
    """GET /invoices/999999 → 404."""
    res = client.get("/api/billing/invoices/999999")
    assert res.status_code == 404, res.text
