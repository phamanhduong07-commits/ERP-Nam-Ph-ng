"""
E2E tests — Sprint 4 Excel export endpoints (accounting.py)

Endpoints under test:
  1. GET /api/accounting/trial-balance/export
  2. GET /api/accounting/reports/production-costing/export
  3. GET /api/accounting/reports/workshop-pnl-export

Note on SQLite compatibility:
  - All three endpoints use standard ORM queries that work with SQLite in-memory.
  - No PostgreSQL-specific SQL is used at query level; service layer uses SQLAlchemy
    expressions so tests run cleanly under the conftest.py SQLite setup.
  - workshop-pnl-export raises HTTP 400 (not 200) when phan_xuong_id is omitted —
    this is intentional per router code: raise HTTPException(400, ...) before any DB call.
"""

PARAMS = "tu_ngay=2026-01-01&den_ngay=2026-05-31"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# ─── Trial Balance export ────────────────────────────────────────────────────

def test_trial_balance_export_200(client, db_session):
    """GET /api/accounting/trial-balance/export → 200 với DB rỗng (không có TK → trả file rỗng)."""
    res = client.get(f"/api/accounting/trial-balance/export?{PARAMS}")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:500]}"


def test_trial_balance_export_mime(client, db_session):
    """Content-Type phải là spreadsheetml.sheet."""
    res = client.get(f"/api/accounting/trial-balance/export?{PARAMS}")
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected xlsx MIME, got: {ct!r}"


def test_trial_balance_export_disposition(client, db_session):
    """Content-Disposition phải là attachment với đuôi .xlsx."""
    res = client.get(f"/api/accounting/trial-balance/export?{PARAMS}")
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"No 'attachment' in Content-Disposition: {cd!r}"
    assert ".xlsx" in cd, f"No .xlsx in Content-Disposition: {cd!r}"


def test_trial_balance_export_nonempty(client, db_session):
    """Response body phải > 100 bytes (XLSX container header luôn có dù không có data)."""
    res = client.get(f"/api/accounting/trial-balance/export?{PARAMS}")
    assert len(res.content) > 100, f"Response too small: {len(res.content)} bytes"


# ─── Production Costing export ────────────────────────────────────────────────

def test_production_costing_export_200(client, db_session):
    """GET /api/accounting/reports/production-costing/export → 200."""
    res = client.get(f"/api/accounting/reports/production-costing/export?{PARAMS}")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:500]}"


def test_production_costing_export_mime(client, db_session):
    """Content-Type phải là spreadsheetml.sheet."""
    res = client.get(f"/api/accounting/reports/production-costing/export?{PARAMS}")
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected xlsx MIME, got: {ct!r}"


def test_production_costing_export_disposition(client, db_session):
    """Content-Disposition phải là attachment với đuôi .xlsx."""
    res = client.get(f"/api/accounting/reports/production-costing/export?{PARAMS}")
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"No 'attachment' in Content-Disposition: {cd!r}"
    assert ".xlsx" in cd, f"No .xlsx in Content-Disposition: {cd!r}"


def test_production_costing_export_nonempty(client, db_session):
    """Response body phải > 100 bytes."""
    res = client.get(f"/api/accounting/reports/production-costing/export?{PARAMS}")
    assert len(res.content) > 100, f"Response too small: {len(res.content)} bytes"


# ─── Workshop P&L export ─────────────────────────────────────────────────────

def test_workshop_pnl_export_with_phan_xuong_200(client, db_session):
    """GET workshop-pnl-export với phan_xuong_id=1 → 200 (dù không có data)."""
    res = client.get(f"/api/accounting/reports/workshop-pnl-export?{PARAMS}&phan_xuong_id=1")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:500]}"


def test_workshop_pnl_export_with_phan_xuong_mime(client, db_session):
    """Content-Type phải là spreadsheetml.sheet khi có phan_xuong_id."""
    res = client.get(f"/api/accounting/reports/workshop-pnl-export?{PARAMS}&phan_xuong_id=1")
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected xlsx MIME, got: {ct!r}"


def test_workshop_pnl_export_with_phan_xuong_disposition(client, db_session):
    """Content-Disposition phải là attachment với đuôi .xlsx."""
    res = client.get(f"/api/accounting/reports/workshop-pnl-export?{PARAMS}&phan_xuong_id=1")
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"No 'attachment' in Content-Disposition: {cd!r}"
    assert ".xlsx" in cd, f"No .xlsx in Content-Disposition: {cd!r}"


def test_workshop_pnl_export_with_phan_xuong_nonempty(client, db_session):
    """Response body phải > 100 bytes khi có phan_xuong_id."""
    res = client.get(f"/api/accounting/reports/workshop-pnl-export?{PARAMS}&phan_xuong_id=1")
    assert len(res.content) > 100, f"Response too small: {len(res.content)} bytes"


def test_workshop_pnl_no_phan_xuong_400(client, db_session):
    """Không truyền phan_xuong_id → 400 (router raise HTTPException trước khi gọi DB).

    Router code:
        if not phan_xuong_id:
            raise HTTPException(400, "Vui lòng chọn phân xưởng")
    """
    res = client.get(f"/api/accounting/reports/workshop-pnl-export?{PARAMS}")
    assert res.status_code == 400, (
        f"Expected 400 when phan_xuong_id is missing, got {res.status_code}: {res.text[:300]}"
    )
