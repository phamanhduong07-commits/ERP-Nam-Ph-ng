"""
Sprint 9 — Test TSCĐ module
Covers: FixedAsset CRUD (dùng accounting.FixedAsset),
        run-depreciation batch, idempotent (skip đã KH).
"""
from datetime import date


def _make_asset(client, ma="TS001", thang=12, gia=12000000):
    res = client.post("/api/fixed-assets", json={
        "ma_ts": ma,
        "ten_ts": f"Tài sản {ma}",
        "ngay_mua": date.today().isoformat(),
        "nguyen_gia": gia,
        "so_thang_khau_hao": thang,
    })
    assert res.status_code == 201, res.text
    return res.json()


# ─── CRUD ─────────────────────────────────────────────────────────────────────

def test_create_asset_returns_201(client, db_session):
    """Tạo TSCĐ hợp lệ → 201, da_khau_hao_thang = 0 ban đầu."""
    a = _make_asset(client, "TS_C1")
    assert a["ma_ts"] == "TS_C1"
    assert a["da_khau_hao_thang"] == 0
    assert float(a["gia_tri_da_khau_hao"]) == 0.0
    assert a["trang_thai"] == "dang_su_dung"


def test_nguyen_gia_zero_returns_422(client, db_session):
    """nguyen_gia <= 0 → 422."""
    res = client.post("/api/fixed-assets", json={
        "ma_ts": "TS_ERR", "ten_ts": "X",
        "ngay_mua": date.today().isoformat(),
        "nguyen_gia": 0, "so_thang_khau_hao": 12,
    })
    assert res.status_code == 422


def test_so_thang_zero_returns_422(client, db_session):
    """so_thang_khau_hao <= 0 → 422."""
    res = client.post("/api/fixed-assets", json={
        "ma_ts": "TS_ERR2", "ten_ts": "X",
        "ngay_mua": date.today().isoformat(),
        "nguyen_gia": 1000000, "so_thang_khau_hao": 0,
    })
    assert res.status_code == 422


def test_list_assets(client, db_session):
    """GET /fixed-assets → list."""
    _make_asset(client, "TS_L1")
    res = client.get("/api/fixed-assets")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) >= 1


def test_get_asset_by_id(client, db_session):
    """GET /fixed-assets/{id} → đúng bản ghi."""
    a = _make_asset(client, "TS_G1")
    res = client.get(f"/api/fixed-assets/{a['id']}")
    assert res.status_code == 200
    assert res.json()["ma_ts"] == "TS_G1"


def test_patch_asset_updates_trang_thai(client, db_session):
    """PATCH → cập nhật trang_thai."""
    a = _make_asset(client, "TS_P1")
    res = client.patch(f"/api/fixed-assets/{a['id']}", json={"trang_thai": "thanh_ly"})
    assert res.status_code == 200
    assert res.json()["trang_thai"] == "thanh_ly"


# ─── Depreciation ─────────────────────────────────────────────────────────────

def test_run_depreciation_calculates_correctly(client, db_session):
    """12tr / 12 tháng → mỗi tháng KH 1tr."""
    _make_asset(client, "TS_KH1", thang=12, gia=12000000)
    res = client.post("/api/fixed-assets/run-depreciation", json={"ky": "2026-05"})
    assert res.status_code == 200
    data = res.json()
    assert data["so_tscd_da_kh"] >= 1
    assert float(data["tong_so_tien_kh"]) >= 1000000


def test_run_depreciation_idempotent(client, db_session):
    """Chạy KH 2 lần cùng kỳ → lần 2 không tạo thêm entry."""
    _make_asset(client, "TS_KH2", thang=6, gia=6000000)
    r1 = client.post("/api/fixed-assets/run-depreciation", json={"ky": "2026-04"})
    r2 = client.post("/api/fixed-assets/run-depreciation", json={"ky": "2026-04"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r2.json()["so_tscd_da_kh"] == 0


def test_depreciation_entry_list(client, db_session):
    """GET /fixed-assets/{id}/depreciation → list entries với so_tien_kh đúng."""
    a = _make_asset(client, "TS_KH3", thang=3, gia=3000000)
    client.post("/api/fixed-assets/run-depreciation", json={"ky": "2026-03"})
    res = client.get(f"/api/fixed-assets/{a['id']}/depreciation")
    assert res.status_code == 200
    entries = res.json()
    assert len(entries) >= 1
    assert float(entries[0]["so_tien_kh"]) == 1000000.0


def test_invalid_ky_format_returns_422(client, db_session):
    """ky sai định dạng → 422."""
    res = client.post("/api/fixed-assets/run-depreciation", json={"ky": "05-2026"})
    assert res.status_code == 422
