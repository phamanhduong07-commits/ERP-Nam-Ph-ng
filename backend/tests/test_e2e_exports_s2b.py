"""
E2E tests — Excel export endpoints (Sprint 2B)

Covers:
  - GET /api/reports/production-performance/export
  - GET /api/reports/order-progress/export

4 assertions per endpoint:
  1. HTTP 200
  2. Content-Type contains "spreadsheetml"
  3. Content-Disposition has "attachment" + ".xlsx"
  4. Response body size > 100 bytes (non-empty file)

Auth: client fixture injects mock ADMIN user via dependency_overrides.
Data: empty DB is fine — both endpoints return an empty Excel sheet when no rows.
"""

PARAMS = "tu_ngay=2026-01-01&den_ngay=2026-05-31"


# ── 1. Báo cáo năng suất sản xuất ─────────────────────────────────────────────

def test_production_performance_export_200(client, db_session):
    """Status 200."""
    res = client.get(f"/api/reports/production-performance/export?{PARAMS}")
    assert res.status_code == 200


def test_production_performance_export_mime(client, db_session):
    """Content-Type phải là spreadsheetml (Excel OOXML)."""
    res = client.get(f"/api/reports/production-performance/export?{PARAMS}")
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected spreadsheetml in Content-Type, got: {ct!r}"


def test_production_performance_export_disposition(client, db_session):
    """Content-Disposition phải có attachment và đuôi .xlsx."""
    res = client.get(f"/api/reports/production-performance/export?{PARAMS}")
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"Expected 'attachment' in Content-Disposition, got: {cd!r}"
    assert ".xlsx" in cd, f"Expected '.xlsx' in Content-Disposition, got: {cd!r}"


def test_production_performance_export_nonempty(client, db_session):
    """File trả về phải có ít nhất 100 bytes (ZIP header của OOXML)."""
    res = client.get(f"/api/reports/production-performance/export?{PARAMS}")
    assert len(res.content) > 100, f"Response body too small: {len(res.content)} bytes"


# ── 2. Báo cáo tiến độ đơn hàng ──────────────────────────────────────────────

def test_order_progress_export_200(client, db_session):
    """Status 200."""
    res = client.get(f"/api/reports/order-progress/export?{PARAMS}")
    assert res.status_code == 200


def test_order_progress_export_mime(client, db_session):
    """Content-Type phải là spreadsheetml (Excel OOXML)."""
    res = client.get(f"/api/reports/order-progress/export?{PARAMS}")
    ct = res.headers.get("content-type", "")
    assert "spreadsheetml" in ct, f"Expected spreadsheetml in Content-Type, got: {ct!r}"


def test_order_progress_export_disposition(client, db_session):
    """Content-Disposition phải có attachment và đuôi .xlsx."""
    res = client.get(f"/api/reports/order-progress/export?{PARAMS}")
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd, f"Expected 'attachment' in Content-Disposition, got: {cd!r}"
    assert ".xlsx" in cd, f"Expected '.xlsx' in Content-Disposition, got: {cd!r}"


def test_order_progress_export_nonempty(client, db_session):
    """File trả về phải có ít nhất 100 bytes (ZIP header của OOXML)."""
    res = client.get(f"/api/reports/order-progress/export?{PARAMS}")
    assert len(res.content) > 100, f"Response body too small: {len(res.content)} bytes"
