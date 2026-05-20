"""
Smoke tests — Reports module
Covers: GET /api/reports/* endpoints — chỉ verify 200 + data structure đúng.
Không cần seed data phức tạp: báo cáo trả về list/rows rỗng khi DB trống vẫn là 200.
"""


# ─── Helpers ────────────────────────────────────────────────────────────────

TODAY = "2026-05-20"
LAST_MONTH = "2026-04-01"


# ── 1. debt-summary ──────────────────────────────────────────────────────────

def test_debt_summary_accessible(client, db_session):
    """GET /api/reports/debt-summary → 200, có keys ar và ap."""
    res = client.get("/api/reports/debt-summary")
    assert res.status_code == 200
    data = res.json()
    assert "ar" in data
    assert "ap" in data
    assert "summary" in data["ar"]
    assert "rows" in data["ar"]


def test_debt_summary_with_date_param(client, db_session):
    """Truyền as_of_date → vẫn 200."""
    res = client.get(f"/api/reports/debt-summary?as_of_date={TODAY}")
    assert res.status_code == 200
    assert res.json()["as_of_date"] == TODAY


# ── 2. revenue ───────────────────────────────────────────────────────────────

def test_revenue_report_accessible(client, db_session):
    """GET /api/reports/revenue → 200, có theo_ky và top_khach_hang."""
    res = client.get(f"/api/reports/revenue?tu_ngay={LAST_MONTH}&den_ngay={TODAY}")
    assert res.status_code == 200
    data = res.json()
    assert "tong_doanh_thu" in data
    assert "theo_ky" in data
    assert "top_khach_hang" in data
    assert isinstance(data["theo_ky"], list)


def test_revenue_report_missing_params(client, db_session):
    """Thiếu query params bắt buộc → 422."""
    res = client.get("/api/reports/revenue")
    assert res.status_code == 422


# ── 3. inventory-movement ────────────────────────────────────────────────────

def test_inventory_movement_accessible(client, db_session):
    """GET /api/reports/inventory-movement → 200, có rows và summary."""
    res = client.get(
        f"/api/reports/inventory-movement?tu_ngay={LAST_MONTH}&den_ngay={TODAY}"
    )
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert "summary" in data
    assert isinstance(data["rows"], list)
    assert "tong_nhap" in data["summary"]
    assert "tong_xuat" in data["summary"]


def test_inventory_movement_with_warehouse_filter(client, db_session):
    """Lọc theo warehouse_id=999 (không tồn tại) → 200, rows rỗng."""
    res = client.get(
        f"/api/reports/inventory-movement?tu_ngay={LAST_MONTH}&den_ngay={TODAY}&warehouse_id=999"
    )
    assert res.status_code == 200
    assert res.json()["rows"] == []


# ── 4. production-performance ────────────────────────────────────────────────

def test_production_performance_accessible(client, db_session):
    """GET /api/reports/production-performance → 200, có rows và summary."""
    res = client.get(
        f"/api/reports/production-performance?tu_ngay={LAST_MONTH}&den_ngay={TODAY}"
    )
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert "summary" in data
    assert isinstance(data["rows"], list)
    assert "so_lenh" in data["summary"]


# ── 5. order-progress ────────────────────────────────────────────────────────

def test_order_progress_accessible(client, db_session):
    """GET /api/reports/order-progress → 200, có rows và summary."""
    res = client.get(
        f"/api/reports/order-progress?tu_ngay={LAST_MONTH}&den_ngay={TODAY}"
    )
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert "summary" in data
    assert isinstance(data["rows"], list)
    assert "so_don" in data["summary"]


def test_order_progress_with_customer_filter(client, db_session):
    """Lọc theo customer_id=999 (không tồn tại) → 200, rows rỗng."""
    res = client.get(
        f"/api/reports/order-progress?tu_ngay={LAST_MONTH}&den_ngay={TODAY}&customer_id=999"
    )
    assert res.status_code == 200
    assert res.json()["rows"] == []


# ── 6. delivery-report ───────────────────────────────────────────────────────

def test_delivery_report_accessible(client, db_session):
    """GET /api/reports/delivery-report → 200, có rows, by_xe, summary."""
    res = client.get(
        f"/api/reports/delivery-report?tu_ngay={LAST_MONTH}&den_ngay={TODAY}"
    )
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert "by_xe" in data
    assert "summary" in data
    assert "tong_chuyen" in data["summary"]
