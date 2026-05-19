"""
Sprint 1.1 — Test accounting module
Covers: CashReceipt (create + approve → journal), CashPayment (create + approve → journal),
        PurchaseInvoice (manual create + cancel).
"""
from datetime import date
from decimal import Decimal

from app.models.accounting import CashReceipt, CashPayment, JournalEntry, PurchaseInvoice
from app.models.master import Customer, Supplier, PhapNhan


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_phap_nhan(db, ma="PN_ACC"):
    pn = PhapNhan(ma_phap_nhan=ma, ten_phap_nhan=f"PN {ma}", ten_viet_tat=ma)
    db.add(pn)
    db.flush()
    return pn


def _make_customer(db, ma="KH_ACC"):
    kh = Customer(ma_kh=ma, ten_viet_tat=f"KH {ma}")
    db.add(kh)
    db.flush()
    return kh


def _make_supplier(db, ma="NCC_ACC"):
    sup = Supplier(ma_ncc=ma, ten_viet_tat=f"NCC {ma}")
    db.add(sup)
    db.flush()
    return sup


# ─── Phiếu thu ──────────────────────────────────────────────────────────────

def test_create_cash_receipt_returns_cho_duyet(client, db_session):
    """Tạo phiếu thu → trạng thái 'cho_duyet', số tiền đúng."""
    kh = _make_customer(db_session, "KH_PT1")
    db_session.commit()

    res = client.post("/api/accounting/receipts", json={
        "customer_id": kh.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 500000,
        "hinh_thuc_tt": "chuyen_khoan",
    })

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["trang_thai"] == "cho_duyet"
    assert float(data["so_tien"]) == 500000.0


def test_approve_receipt_creates_balanced_journal(client, db_session):
    """Duyệt phiếu thu → JournalEntry Nợ = Có, TK 112 Nợ / 131 Có."""
    pn = _make_phap_nhan(db_session, "PN_PT2")
    kh = _make_customer(db_session, "KH_PT2")
    db_session.commit()

    create_res = client.post("/api/accounting/receipts", json={
        "customer_id": kh.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 1_000_000,
        "phap_nhan_id": pn.id,
    })
    assert create_res.status_code == 200, create_res.text
    receipt_id = create_res.json()["id"]

    approve_res = client.patch(f"/api/accounting/receipts/{receipt_id}/approve")
    assert approve_res.status_code == 200, approve_res.text
    assert approve_res.json()["trang_thai"] == "da_duyet"

    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "phieu_thu",
        JournalEntry.chung_tu_id == receipt_id,
    ).one()
    assert journal.tong_no == journal.tong_co
    tks_no = {line.so_tk for line in journal.lines if line.so_tien_no > 0}
    assert "112" in tks_no


def test_approve_already_approved_receipt_returns_400(client, db_session):
    """Duyệt phiếu thu đã duyệt → 400."""
    kh = _make_customer(db_session, "KH_PT3")
    db_session.commit()

    create_res = client.post("/api/accounting/receipts", json={
        "customer_id": kh.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 200000,
    })
    receipt_id = create_res.json()["id"]
    client.patch(f"/api/accounting/receipts/{receipt_id}/approve")

    res2 = client.patch(f"/api/accounting/receipts/{receipt_id}/approve")
    assert res2.status_code == 400


def test_cancel_receipt_changes_status(client, db_session):
    """Hủy phiếu thu đang chờ duyệt → trang_thai = huy."""
    kh = _make_customer(db_session, "KH_PT4")
    db_session.commit()

    create_res = client.post("/api/accounting/receipts", json={
        "customer_id": kh.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 300000,
    })
    receipt_id = create_res.json()["id"]

    cancel_res = client.patch(f"/api/accounting/receipts/{receipt_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["trang_thai"] == "huy"


# ─── Phiếu chi ──────────────────────────────────────────────────────────────

def test_create_cash_payment_returns_cho_chot(client, db_session):
    """Tạo phiếu chi → trạng thái cho_chot (bước 1/2 flow duyệt)."""
    sup = _make_supplier(db_session, "NCC_PC1")
    db_session.commit()

    res = client.post("/api/accounting/payments", json={
        "supplier_id": sup.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 2_000_000,
    })

    assert res.status_code == 200, res.text
    assert res.json()["trang_thai"] == "cho_chot"


def test_approve_payment_creates_balanced_journal(client, db_session):
    """Duyệt phiếu chi 2 lần (cho_chot→da_chot→da_duyet) → JournalEntry Nợ = Có."""
    pn = _make_phap_nhan(db_session, "PN_PC2")
    sup = _make_supplier(db_session, "NCC_PC2")
    db_session.commit()

    create_res = client.post("/api/accounting/payments", json={
        "supplier_id": sup.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 3_000_000,
        "phap_nhan_id": pn.id,
    })
    assert create_res.status_code == 200, create_res.text
    payment_id = create_res.json()["id"]

    # Bước 1: cho_chot → da_chot
    r1 = client.patch(f"/api/accounting/payments/{payment_id}/approve")
    assert r1.status_code == 200
    assert r1.json()["trang_thai"] == "da_chot"

    # Bước 2: da_chot → da_duyet + tạo bút toán
    r2 = client.patch(f"/api/accounting/payments/{payment_id}/approve")
    assert r2.status_code == 200
    assert r2.json()["trang_thai"] == "da_duyet"

    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "phieu_chi",
        JournalEntry.chung_tu_id == payment_id,
    ).one()
    assert journal.tong_no == journal.tong_co


# ─── Hóa đơn mua hàng (thủ công) ───────────────────────────────────────────

def test_create_purchase_invoice_manual(client, db_session):
    """Tạo hóa đơn mua hàng thủ công → tong_thanh_toan = tong_tien_hang + tien_thue."""
    pn = _make_phap_nhan(db_session, "PN_HD1")
    sup = _make_supplier(db_session, "NCC_HD1")
    db_session.commit()

    res = client.post("/api/accounting/purchase-invoices", json={
        "supplier_id": sup.id,
        "ngay_lap": date.today().isoformat(),
        "tong_tien_hang": 10_000_000,
        "thue_suat": 8,
        "co_vat": True,
        "phap_nhan_id": pn.id,
    })

    assert res.status_code == 200, res.text
    data = res.json()
    assert float(data["tien_thue"]) == 800_000.0
    assert float(data["tong_thanh_toan"]) == 10_800_000.0


def test_cancel_purchase_invoice_with_payment_blocked(client, db_session):
    """Hóa đơn đã có da_thanh_toan > 0 → không cho hủy."""
    sup = _make_supplier(db_session, "NCC_HD2")
    db_session.commit()

    create_res = client.post("/api/accounting/purchase-invoices", json={
        "supplier_id": sup.id,
        "ngay_lap": date.today().isoformat(),
        "tong_tien_hang": 5_000_000,
        "thue_suat": 8,
        "co_vat": True,
    })
    inv_id = create_res.json()["id"]

    inv = db_session.get(PurchaseInvoice, inv_id)
    inv.da_thanh_toan = Decimal("100000")
    db_session.commit()

    cancel_res = client.post(f"/api/accounting/purchase-invoices/{inv_id}/huy")
    assert cancel_res.status_code == 400
    assert "thanh toán" in cancel_res.json()["detail"].lower()


def test_invalid_thue_suat_rejected(client, db_session):
    """VAT không phải 0/5/8/10 → 422 validation error."""
    sup = _make_supplier(db_session, "NCC_HD3")
    db_session.commit()

    res = client.post("/api/accounting/purchase-invoices", json={
        "supplier_id": sup.id,
        "ngay_lap": date.today().isoformat(),
        "tong_tien_hang": 1_000_000,
        "thue_suat": 7,
        "co_vat": True,
    })
    assert res.status_code == 422
