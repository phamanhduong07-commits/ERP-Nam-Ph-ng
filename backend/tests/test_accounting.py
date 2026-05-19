"""
Tests for accounting module — Tier A (tiền bạc rủi ro cao):
  - JournalEntry (bút toán thủ công — balanced / unbalanced)
  - CashReceipt (phiếu thu — create, approve, cancel, get, list)
  - CashPayment (phiếu chi — create, approve, cancel, get, list)
  - PurchaseInvoice (hóa đơn mua hàng — create, cancel, validation)
  - AR Ledger / AP Ledger (sổ công nợ)
  - FixedAsset (tài sản cố định)
  - Cash Book & Trial Balance (báo cáo tài chính)

Pattern:
  - dùng fixture `client` + `db_session` từ conftest.py
  - helper _make_* để tạo prerequisite data
  - mỗi test độc lập, không chia sẻ state
"""
from datetime import date
from decimal import Decimal

from app.models.accounting import CashReceipt, CashPayment, JournalEntry, PurchaseInvoice
from app.models.master import Customer, Supplier, PhapNhan


# ─── helpers ──────────────────────────────────────────────────────────────────

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


# ─── JournalEntry — bút toán thủ công ────────────────────────────────────────

def test_create_journal_entry_balanced(client, db_session):
    """POST /api/accounting/journal-entries với Nợ = Có → 200, entry được lưu."""
    payload = {
        "ngay_but_toan": date.today().isoformat(),
        "dien_giai": "Bút toán test cân bằng",
        "lines": [
            {"so_tk": "111", "so_tien_no": 1000000, "so_tien_co": 0},
            {"so_tk": "131", "so_tien_no": 0, "so_tien_co": 1000000},
        ],
    }
    res = client.post("/api/accounting/journal-entries", json=payload)
    assert res.status_code == 200, res.text

    # Verify entry trong DB
    entry = db_session.query(JournalEntry).filter(
        JournalEntry.loai_but_toan == "tong_hop"
    ).first()
    assert entry is not None
    assert float(entry.tong_no) == float(entry.tong_co)


def test_create_journal_entry_unbalanced_returns_422(client, db_session):
    """Bút toán Nợ != Có → 422 validation error (Pydantic model_validator)."""
    payload = {
        "ngay_but_toan": date.today().isoformat(),
        "dien_giai": "Bút toán không cân bằng",
        "lines": [
            {"so_tk": "111", "so_tien_no": 1000000, "so_tien_co": 0},
            {"so_tk": "131", "so_tien_no": 0, "so_tien_co": 500000},  # sai: 1M != 500K
        ],
    }
    res = client.post("/api/accounting/journal-entries", json=payload)
    assert res.status_code == 422, res.text


def test_create_journal_entry_empty_lines_returns_422(client, db_session):
    """Bút toán không có dòng → 422."""
    payload = {
        "ngay_but_toan": date.today().isoformat(),
        "dien_giai": "Không có dòng",
        "lines": [],
    }
    res = client.post("/api/accounting/journal-entries", json=payload)
    assert res.status_code == 422, res.text


def test_list_journal_entries(client, db_session):
    """GET /api/accounting/journal-entries → 200, trả về dict với 'total' và 'items'."""
    # Tạo 1 entry trực tiếp qua DB
    entry = JournalEntry(
        so_but_toan="BT202501-0001",
        ngay_but_toan=date.today(),
        dien_giai="Entry test list",
        loai_but_toan="tong_hop",
        tong_no=Decimal("500000"),
        tong_co=Decimal("500000"),
    )
    db_session.add(entry)
    db_session.commit()

    res = client.get("/api/accounting/journal-entries")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 1


def test_list_journal_entries_filter_by_loai(client, db_session):
    """Filter ?loai_but_toan=phieu_thu → chỉ trả về entries đúng loại."""
    entry1 = JournalEntry(
        so_but_toan="BT202501-0010",
        ngay_but_toan=date.today(),
        dien_giai="Entry phieu_thu",
        loai_but_toan="phieu_thu",
        tong_no=Decimal("200000"),
        tong_co=Decimal("200000"),
    )
    entry2 = JournalEntry(
        so_but_toan="BT202501-0011",
        ngay_but_toan=date.today(),
        dien_giai="Entry tong_hop",
        loai_but_toan="tong_hop",
        tong_no=Decimal("300000"),
        tong_co=Decimal("300000"),
    )
    db_session.add_all([entry1, entry2])
    db_session.commit()

    res = client.get("/api/accounting/journal-entries?loai_but_toan=phieu_thu")
    assert res.status_code == 200, res.text
    data = res.json()
    for item in data["items"]:
        assert item["loai_but_toan"] == "phieu_thu"


# ─── Phiếu thu (CashReceipt) ─────────────────────────────────────────────────

def test_create_cash_receipt_returns_cho_duyet(client, db_session):
    """Tạo phiếu thu → trạng thái 'cho_duyet', số tiền đúng, so_phieu dạng PT..."""
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
    assert data["so_phieu"].startswith("PT")
    assert data["customer_id"] == kh.id


def test_create_cash_receipt_zero_amount_rejected(client, db_session):
    """Số tiền = 0 → 422 (validator 'so_tien > 0')."""
    kh = _make_customer(db_session, "KH_PT2Z")
    db_session.commit()

    res = client.post("/api/accounting/receipts", json={
        "customer_id": kh.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 0,
    })
    assert res.status_code == 422, res.text


def test_list_cash_receipts(client, db_session):
    """GET /api/accounting/receipts → 200."""
    kh = _make_customer(db_session, "KH_PTLIST")
    receipt = CashReceipt(
        so_phieu="PT202501-0099",
        ngay_phieu=date.today(),
        customer_id=kh.id,
        so_tien=Decimal("3000000"),
        tk_no="112",
        tk_co="131",
    )
    db_session.add(receipt)
    db_session.commit()

    res = client.get("/api/accounting/receipts")
    assert res.status_code == 200, res.text
    data = res.json()
    # AccountingService.list_receipts trả về paginated dict
    if isinstance(data, list):
        assert len(data) >= 1
    else:
        assert "items" in data or "total" in data


def test_get_cash_receipt_by_id(client, db_session):
    """GET /api/accounting/receipts/{id} → 200, đúng field."""
    kh = _make_customer(db_session, "KH_PTGET")
    receipt = CashReceipt(
        so_phieu="PT202501-0098",
        ngay_phieu=date.today(),
        customer_id=kh.id,
        so_tien=Decimal("1500000"),
        tk_no="112",
        tk_co="131",
    )
    db_session.add(receipt)
    db_session.commit()
    db_session.refresh(receipt)

    res = client.get(f"/api/accounting/receipts/{receipt.id}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == receipt.id
    assert data["so_phieu"] == "PT202501-0098"
    assert float(data["so_tien"]) == 1500000.0


def test_get_cash_receipt_404(client, db_session):
    """GET phiếu thu không tồn tại → 404."""
    res = client.get("/api/accounting/receipts/999999")
    assert res.status_code == 404, res.text


def test_approve_receipt_creates_balanced_journal(client, db_session):
    """Duyệt phiếu thu → JournalEntry Nợ = Có, TK 112 bên Nợ."""
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
    client.patch(f"/api/accounting/receipts/{receipt_id}/approve")  # lần 1

    res2 = client.patch(f"/api/accounting/receipts/{receipt_id}/approve")  # lần 2
    assert res2.status_code == 400, res2.text


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
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["trang_thai"] == "huy"


# ─── Phiếu chi (CashPayment) ─────────────────────────────────────────────────

def test_create_cash_payment_returns_cho_chot(client, db_session):
    """Tạo phiếu chi → trạng thái cho_chot, so_phieu dạng PC..."""
    sup = _make_supplier(db_session, "NCC_PC1")
    db_session.commit()

    res = client.post("/api/accounting/payments", json={
        "supplier_id": sup.id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": 2_000_000,
    })

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["trang_thai"] == "cho_chot"
    assert data["so_phieu"].startswith("PC")
    assert float(data["so_tien"]) == 2_000_000.0


def test_create_cash_payment_negative_rejected(client, db_session):
    """Số tiền âm hoặc 0 → 422."""
    sup = _make_supplier(db_session, "NCC_PC1Z")
    db_session.commit()

    for so_tien in [0, -100000]:
        res = client.post("/api/accounting/payments", json={
            "supplier_id": sup.id,
            "ngay_phieu": date.today().isoformat(),
            "so_tien": so_tien,
        })
        assert res.status_code == 422, f"Expected 422 for so_tien={so_tien}, got {res.status_code}"


def test_list_cash_payments(client, db_session):
    """GET /api/accounting/payments → 200."""
    sup = _make_supplier(db_session, "NCC_PCLIST")
    payment = CashPayment(
        so_phieu="PC202501-0099",
        ngay_phieu=date.today(),
        supplier_id=sup.id,
        so_tien=Decimal("4000000"),
        tk_no="331",
        tk_co="112",
    )
    db_session.add(payment)
    db_session.commit()

    res = client.get("/api/accounting/payments")
    assert res.status_code == 200, res.text
    data = res.json()
    if isinstance(data, list):
        assert len(data) >= 1
    else:
        assert "items" in data or "total" in data


def test_get_cash_payment_by_id(client, db_session):
    """GET /api/accounting/payments/{id} → 200, đúng field."""
    sup = _make_supplier(db_session, "NCC_PCGET")
    payment = CashPayment(
        so_phieu="PC202501-0098",
        ngay_phieu=date.today(),
        supplier_id=sup.id,
        so_tien=Decimal("2200000"),
        tk_no="331",
        tk_co="112",
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)

    res = client.get(f"/api/accounting/payments/{payment.id}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == payment.id
    assert data["so_phieu"] == "PC202501-0098"
    assert float(data["so_tien"]) == 2200000.0


def test_approve_payment_creates_balanced_journal(client, db_session):
    """Duyệt phiếu chi qua 2 bước (cho_chot→da_chot→da_duyet) → JournalEntry cân bằng."""
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
    assert r1.status_code == 200, r1.text
    assert r1.json()["trang_thai"] == "da_chot"

    # Bước 2: da_chot → da_duyet + tạo bút toán
    r2 = client.patch(f"/api/accounting/payments/{payment_id}/approve")
    assert r2.status_code == 200, r2.text
    assert r2.json()["trang_thai"] == "da_duyet"

    journal = db_session.query(JournalEntry).filter(
        JournalEntry.chung_tu_loai == "phieu_chi",
        JournalEntry.chung_tu_id == payment_id,
    ).one()
    assert journal.tong_no == journal.tong_co


def test_cancel_payment_changes_status(client, db_session):
    """Hủy phiếu chi → trang_thai = huy."""
    sup = _make_supplier(db_session, "NCC_PCCANCEL")
    payment = CashPayment(
        so_phieu="PC202501-0097",
        ngay_phieu=date.today(),
        supplier_id=sup.id,
        so_tien=Decimal("600000"),
        tk_no="331",
        tk_co="112",
        trang_thai="cho_chot",
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)

    res = client.patch(f"/api/accounting/payments/{payment.id}/cancel")
    assert res.status_code == 200, res.text
    assert res.json()["trang_thai"] == "huy"


# ─── Sổ công nợ — AR Ledger ───────────────────────────────────────────────────

def test_ar_ledger_returns_list(client, db_session):
    """GET /api/accounting/ar/ledger → 200, trả về list."""
    res = client.get("/api/accounting/ar/ledger")
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)


def test_ar_ledger_filter_by_customer(client, db_session):
    """GET /api/accounting/ar/ledger?customer_id=X → 200, entries thuộc KH đó."""
    kh = _make_customer(db_session, "KH_ARLEDGER")
    db_session.commit()

    res = client.get(f"/api/accounting/ar/ledger?customer_id={kh.id}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)
    for row in data:
        assert row.get("customer_id") == kh.id


# ─── Hóa đơn mua hàng ────────────────────────────────────────────────────────

def test_create_purchase_invoice_manual(client, db_session):
    """POST /api/accounting/purchase-invoices → tong_thanh_toan = tong_tien_hang + tien_thue."""
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


def test_list_purchase_invoices(client, db_session):
    """GET /api/accounting/purchase-invoices → 200."""
    sup = _make_supplier(db_session, "NCC_INVLIST")
    inv = PurchaseInvoice(
        supplier_id=sup.id,
        ngay_lap=date.today(),
        tong_tien_hang=Decimal("1000000"),
        tien_thue=Decimal("80000"),
        tong_thanh_toan=Decimal("1080000"),
        da_thanh_toan=Decimal("0"),
    )
    db_session.add(inv)
    db_session.commit()

    res = client.get("/api/accounting/purchase-invoices")
    assert res.status_code == 200, res.text
    data = res.json()
    if isinstance(data, list):
        assert len(data) >= 1
    else:
        assert "items" in data or "total" in data


def test_get_purchase_invoice_by_id(client, db_session):
    """GET /api/accounting/purchase-invoices/{id} → 200, đúng field."""
    sup = _make_supplier(db_session, "NCC_INVGET")
    inv = PurchaseInvoice(
        supplier_id=sup.id,
        ngay_lap=date.today(),
        so_hoa_don="HD-2026-0001",
        tong_tien_hang=Decimal("3000000"),
        tien_thue=Decimal("240000"),
        tong_thanh_toan=Decimal("3240000"),
        da_thanh_toan=Decimal("0"),
    )
    db_session.add(inv)
    db_session.commit()
    db_session.refresh(inv)

    res = client.get(f"/api/accounting/purchase-invoices/{inv.id}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == inv.id
    assert data["so_hoa_don"] == "HD-2026-0001"
    assert float(data["tong_tien_hang"]) == 3000000.0


def test_cancel_purchase_invoice_with_payment_blocked(client, db_session):
    """Hóa đơn đã có da_thanh_toan > 0 → không cho hủy → 400."""
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
    assert cancel_res.status_code == 400, cancel_res.text
    assert "thanh toán" in cancel_res.json()["detail"].lower()


def test_cancel_purchase_invoice_no_payment(client, db_session):
    """Hóa đơn không có TT → hủy thành công, trang_thai = huy."""
    sup = _make_supplier(db_session, "NCC_HD2B")
    db_session.commit()

    create_res = client.post("/api/accounting/purchase-invoices", json={
        "supplier_id": sup.id,
        "ngay_lap": date.today().isoformat(),
        "tong_tien_hang": 2_000_000,
        "thue_suat": 8,
        "co_vat": True,
    })
    inv_id = create_res.json()["id"]

    cancel_res = client.post(f"/api/accounting/purchase-invoices/{inv_id}/huy")
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json()["trang_thai"] == "huy"


def test_cancel_purchase_invoice_404(client, db_session):
    """Hủy HĐ không tồn tại → 404."""
    res = client.post("/api/accounting/purchase-invoices/999999/huy")
    assert res.status_code == 404, res.text


def test_invalid_thue_suat_rejected(client, db_session):
    """VAT không phải 0/5/8/10 → 422 validation error."""
    sup = _make_supplier(db_session, "NCC_HD3")
    db_session.commit()

    res = client.post("/api/accounting/purchase-invoices", json={
        "supplier_id": sup.id,
        "ngay_lap": date.today().isoformat(),
        "tong_tien_hang": 1_000_000,
        "thue_suat": 7,  # không hợp lệ
        "co_vat": True,
    })
    assert res.status_code == 422, res.text


def test_purchase_invoice_co_vat_false_zeroes_tax(client, db_session):
    """co_vat=False → tien_thue = 0, tong_thanh_toan = tong_tien_hang."""
    sup = _make_supplier(db_session, "NCC_HD4")
    db_session.commit()

    res = client.post("/api/accounting/purchase-invoices", json={
        "supplier_id": sup.id,
        "ngay_lap": date.today().isoformat(),
        "tong_tien_hang": 3_000_000,
        "co_vat": False,
        "thue_suat": 8,
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert float(data["tien_thue"]) == 0.0
    assert float(data["tong_thanh_toan"]) == 3_000_000.0


# ─── Sổ quỹ tiền mặt ─────────────────────────────────────────────────────────

def test_cash_book_returns_structure(client, db_session):
    """GET /api/accounting/cash-book?tu_ngay=...&den_ngay=... → 200."""
    res = client.get(
        "/api/accounting/cash-book",
        params={"tu_ngay": "2026-01-01", "den_ngay": "2026-12-31"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "so_du_dau" in data or "entries" in data


# ─── Bảng cân đối phát sinh ───────────────────────────────────────────────────

def test_trial_balance_returns_list(client, db_session):
    """GET /api/accounting/trial-balance → 200, list."""
    res = client.get(
        "/api/accounting/trial-balance",
        params={"tu_ngay": "2026-01-01", "den_ngay": "2026-12-31"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)


# ─── Tài sản cố định ─────────────────────────────────────────────────────────

def test_create_fixed_asset(client, db_session):
    """POST /api/accounting/fixed-assets → 200, trang_thai = dang_su_dung."""
    payload = {
        "ma_ts": "TSCD-TEST-001",
        "ten_ts": "Máy cắt test",
        "ngay_mua": date.today().isoformat(),
        "nguyen_gia": 50000000,
        "so_thang_khau_hao": 60,
    }
    res = client.post("/api/accounting/fixed-assets", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["ma_ts"] == "TSCD-TEST-001"
    assert float(data["nguyen_gia"]) == 50000000.0
    assert data["trang_thai"] == "dang_su_dung"
    assert data["da_khau_hao_thang"] == 0


def test_list_fixed_assets(client, db_session):
    """GET /api/accounting/fixed-assets → 200, list."""
    res = client.get("/api/accounting/fixed-assets")
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)


def test_get_fixed_asset_by_id(client, db_session):
    """GET /api/accounting/fixed-assets/{id} → 200."""
    create_res = client.post("/api/accounting/fixed-assets", json={
        "ma_ts": "TSCD-TEST-002",
        "ten_ts": "Máy dán test",
        "ngay_mua": date.today().isoformat(),
        "nguyen_gia": 30000000,
        "so_thang_khau_hao": 36,
    })
    assert create_res.status_code == 200, create_res.text
    asset_id = create_res.json()["id"]

    res = client.get(f"/api/accounting/fixed-assets/{asset_id}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == asset_id
    assert data["ma_ts"] == "TSCD-TEST-002"


def test_get_fixed_asset_404(client, db_session):
    """GET tài sản không tồn tại → 404."""
    res = client.get("/api/accounting/fixed-assets/999999")
    assert res.status_code == 404, res.text
