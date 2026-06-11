"""
Integration tests for critical ERP fixes.

Group 1 — Cash receipt validation (overpayment guard + invoice status transitions)
Group 2 — Period closing idempotency (perform_closing called twice → only 1 JournalEntry)

All tests use `client` + `db_session` fixtures from conftest.py (SQLite in-memory).
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.accounting import AccountingPeriodLock, CashReceipt, ChartOfAccounts, JournalEntry
from app.models.billing import SalesInvoice
from app.models.master import Customer, PhapNhan


# ─── Shared helpers ──────────────────────────────────────────────────────────

def _make_customer(db, ma="KH_E2E") -> Customer:
    kh = Customer(ma_kh=ma, ten_viet_tat=f"KH {ma}")
    db.add(kh)
    db.flush()
    return kh


def _make_phap_nhan(db, ma="PN_E2E") -> PhapNhan:
    pn = PhapNhan(ma_phap_nhan=ma, ten_phap_nhan=f"PN {ma}", ten_viet_tat=ma)
    db.add(pn)
    db.flush()
    return pn


def _ensure_chart_of_accounts(db, *so_tks: str) -> None:
    """Ensure ChartOfAccounts rows exist for the given account codes.

    CashReceipt.tk_no / tk_co FK-reference chart_of_accounts.so_tk so
    the rows must exist before creating a receipt through the API.
    """
    existing = {
        row.so_tk
        for row in db.query(ChartOfAccounts.so_tk)
        .filter(ChartOfAccounts.so_tk.in_(list(so_tks)))
        .all()
    }
    for so_tk in so_tks:
        if so_tk not in existing:
            db.add(ChartOfAccounts(
                so_tk=so_tk,
                ten_tk=f"TK {so_tk}",
                loai_tk="tai_san" if so_tk.startswith("1") else "no_phai_tra",
                cap=1,
                trang_thai=True,
            ))
    db.flush()


def _make_sales_invoice(
    db,
    customer_id: int,
    tong_cong: float = 1_000_000,
    da_thanh_toan: float = 0,
    trang_thai: str = "da_phat_hanh",
) -> SalesInvoice:
    """Seed a SalesInvoice directly into the DB (bypasses billing router)."""
    inv = SalesInvoice(
        ngay_hoa_don=date.today(),
        customer_id=customer_id,
        tong_tien_hang=Decimal(str(tong_cong)),
        tien_vat=Decimal("0"),
        tong_cong=Decimal(str(tong_cong)),
        da_thanh_toan=Decimal(str(da_thanh_toan)),
        trang_thai=trang_thai,
        ty_le_vat=Decimal("0"),
    )
    db.add(inv)
    db.flush()
    return inv


def _receipt_payload(
    customer_id: int,
    invoice_id: int,
    so_tien: float,
    tk_no: str = "112",
    tk_co: str = "131",
) -> dict:
    return {
        "customer_id": customer_id,
        "sales_invoice_id": invoice_id,
        "ngay_phieu": date.today().isoformat(),
        "so_tien": so_tien,
        "tk_no": tk_no,
        "tk_co": tk_co,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GROUP 1 — Cash receipt validation
# ═══════════════════════════════════════════════════════════════════════════════

def test_cash_receipt_first_partial_payment_ok(client, db_session):
    """Thanh toán một phần (600k / 1M) → 201, da_thanh_toan=600k, trang_thai='da_tt_mot_phan'."""
    _ensure_chart_of_accounts(db_session, "112", "131")
    kh = _make_customer(db_session, "KH_CR1")
    inv = _make_sales_invoice(db_session, customer_id=kh.id, tong_cong=1_000_000)
    db_session.commit()

    res = client.post(
        "/api/accounting/receipts",
        json=_receipt_payload(kh.id, inv.id, so_tien=600_000),
    )

    assert res.status_code in (200, 201), res.text

    # Reload invoice from DB to verify side-effects
    db_session.expire(inv)
    db_session.refresh(inv)
    assert float(inv.da_thanh_toan) == 600_000.0
    assert inv.trang_thai == "da_tt_mot_phan"


def test_cash_receipt_overpayment_blocked(client, db_session):
    """Thanh toán vượt quá số còn lại → 400.

    Scenario: invoice 1M, đã thu 600k → còn 400k.
    POST receipt 500k (> 400k remaining) phải bị từ chối với HTTP 400.
    """
    _ensure_chart_of_accounts(db_session, "112", "131")
    kh = _make_customer(db_session, "KH_CR2")
    # Seed invoice with 600k already paid — 400k remaining
    inv = _make_sales_invoice(
        db_session,
        customer_id=kh.id,
        tong_cong=1_000_000,
        da_thanh_toan=600_000,
        trang_thai="da_tt_mot_phan",
    )
    db_session.commit()

    res = client.post(
        "/api/accounting/receipts",
        json=_receipt_payload(kh.id, inv.id, so_tien=500_000),  # exceeds 400k remaining
    )

    assert res.status_code == 400, (
        f"Expected 400 when overpaying, got {res.status_code}: {res.text}"
    )


def test_cash_receipt_full_payment_closes_invoice(client, db_session):
    """Thanh toán đủ phần còn lại → trang_thai chuyển thành 'da_tt_du'."""
    _ensure_chart_of_accounts(db_session, "112", "131")
    kh = _make_customer(db_session, "KH_CR3")
    # Invoice 1M — 600k already paid → 400k remaining
    inv = _make_sales_invoice(
        db_session,
        customer_id=kh.id,
        tong_cong=1_000_000,
        da_thanh_toan=600_000,
        trang_thai="da_tt_mot_phan",
    )
    db_session.commit()

    res = client.post(
        "/api/accounting/receipts",
        json=_receipt_payload(kh.id, inv.id, so_tien=400_000),
    )

    assert res.status_code in (200, 201), res.text

    db_session.expire(inv)
    db_session.refresh(inv)
    assert float(inv.da_thanh_toan) == 1_000_000.0
    assert inv.trang_thai == "da_tt_du", (
        f"Expected 'da_tt_du' after full payment, got '{inv.trang_thai}'"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GROUP 2 — Period closing idempotency
# ═══════════════════════════════════════════════════════════════════════════════

def test_period_closing_locks_and_requires_unlock_before_reclosing(db_session):
    """Gọi perform_closing hai lần cho cùng tháng/năm → chỉ có đúng 1 JournalEntry 'ket_chuyen'.

    Vì không có phát sinh doanh thu/chi phí thực tế trong tháng, perform_closing
    sẽ tạo một entry trống (tong_no=0, tong_co=0) — điều quan trọng là lần gọi
    thứ hai DELETE entry cũ và tạo lại, không tạo thêm bản mới.
    """
    from app.services.accounting_service import AccountingService

    pn = _make_phap_nhan(db_session, "PN_CLOSE")
    db_session.commit()

    svc = AccountingService(db_session)

    # First call
    first = svc.perform_closing(thang=1, nam=2026, phap_nhan_id=pn.id, user_id=1)
    lock = db_session.get(AccountingPeriodLock, first["period_lock_id"])
    assert lock is not None
    assert lock.trang_thai == "locked"

    # Second call for the same period — should replace, not duplicate
    with pytest.raises(HTTPException):
        svc.perform_closing(thang=1, nam=2026, phap_nhan_id=pn.id, user_id=1)

    svc.unlock_period(
        thang=1,
        nam=2026,
        phap_nhan_id=pn.id,
        user_id=1,
        ly_do_mo_khoa="Sua so lieu test",
    )
    rerun = svc.perform_closing(thang=1, nam=2026, phap_nhan_id=pn.id, user_id=1)
    assert rerun["period_lock_id"] == first["period_lock_id"]

    count = (
        db_session.query(JournalEntry)
        .filter(
            JournalEntry.loai_but_toan == "ket_chuyen",
            JournalEntry.phap_nhan_id == pn.id,
        )
        .count()
    )
    assert count == 1, (
        f"Expected exactly 1 'ket_chuyen' entry after two calls, found {count}. "
        "Second call should replace the first, not create a duplicate."
    )
