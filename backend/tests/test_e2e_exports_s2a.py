"""
E2E tests — Sprint 2A: Excel Export Endpoints
Tests 3 export endpoints:
  1. GET /api/reports/revenue/export
  2. GET /api/reports/inventory-movement/export
  3. GET /api/reports/debt-summary/export

Each endpoint is verified for:
  - status_code == 200
  - Content-Type contains spreadsheetml (xlsx MIME)
  - Content-Disposition has attachment + .xlsx filename
  - Response body is non-empty (len > 100 bytes)

Auth is injected automatically by the `client` fixture (conftest.py).
DB is an in-memory SQLite; endpoints return empty-row xlsx on empty DB — still valid.
"""

TU_NGAY = "2026-01-01"
DEN_NGAY = "2026-05-31"

REVENUE_URL = f"/api/reports/revenue/export?tu_ngay={TU_NGAY}&den_ngay={DEN_NGAY}"
INVENTORY_URL = f"/api/reports/inventory-movement/export?tu_ngay={TU_NGAY}&den_ngay={DEN_NGAY}"
DEBT_URL = "/api/reports/debt-summary/export"


# ── 1. Revenue export ────────────────────────────────────────────────────────

def test_revenue_export_status_200(client, db_session):
    res = client.get(REVENUE_URL)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"


def test_revenue_export_mime_xlsx(client, db_session):
    res = client.get(REVENUE_URL)
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected xlsx MIME, got: {ct!r}"


def test_revenue_export_content_disposition(client, db_session):
    res = client.get(REVENUE_URL)
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"Expected 'attachment' in Content-Disposition, got: {cd!r}"
    assert ".xlsx" in cd, f"Expected '.xlsx' in Content-Disposition, got: {cd!r}"


def test_revenue_export_nonempty_body(client, db_session):
    res = client.get(REVENUE_URL)
    assert len(res.content) > 100, (
        f"Response body too small ({len(res.content)} bytes) — likely empty/error"
    )


# ── 2. Inventory-movement export ─────────────────────────────────────────────

def test_inventory_movement_export_status_200(client, db_session):
    res = client.get(INVENTORY_URL)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"


def test_inventory_movement_export_mime_xlsx(client, db_session):
    res = client.get(INVENTORY_URL)
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected xlsx MIME, got: {ct!r}"


def test_inventory_movement_export_content_disposition(client, db_session):
    res = client.get(INVENTORY_URL)
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"Expected 'attachment' in Content-Disposition, got: {cd!r}"
    assert ".xlsx" in cd, f"Expected '.xlsx' in Content-Disposition, got: {cd!r}"


def test_inventory_movement_export_nonempty_body(client, db_session):
    res = client.get(INVENTORY_URL)
    assert len(res.content) > 100, (
        f"Response body too small ({len(res.content)} bytes) — likely empty/error"
    )


# ── 3. Debt-summary export ───────────────────────────────────────────────────

def test_debt_summary_export_status_200(client, db_session):
    res = client.get(DEBT_URL)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"


def test_debt_summary_export_mime_xlsx(client, db_session):
    res = client.get(DEBT_URL)
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected xlsx MIME, got: {ct!r}"


def test_debt_summary_export_content_disposition(client, db_session):
    res = client.get(DEBT_URL)
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"Expected 'attachment' in Content-Disposition, got: {cd!r}"
    assert ".xlsx" in cd, f"Expected '.xlsx' in Content-Disposition, got: {cd!r}"


def test_debt_summary_export_nonempty_body(client, db_session):
    res = client.get(DEBT_URL)
    assert len(res.content) > 100, (
        f"Response body too small ({len(res.content)} bytes) — likely empty/error"
    )


# ── Optional: debt-summary export with explicit as_of_date param ─────────────

def test_debt_summary_export_with_date_param(client, db_session):
    res = client.get(f"{DEBT_URL}?as_of_date=2026-05-31")
    assert res.status_code == 200, f"Expected 200 with as_of_date param, got {res.status_code}"
    assert "spreadsheetml" in res.headers.get("content-type", "")
