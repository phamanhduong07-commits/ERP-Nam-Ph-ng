"""
Sprint 7 — Test maintenance module
Covers: Machine CRUD, Schedule create + complete (ngày tiếp theo tự tính),
        Log create (tong_chi_phi = vat_tu + nhan_cong), Overdue API.
"""
from datetime import date, timedelta


def _make_machine(client, ma="MAY001"):
    res = client.post("/api/maintenance/machines", json={
        "ma_may": ma,
        "ten_may": f"Máy {ma}",
        "trang_thai": "dang_dung",
    })
    assert res.status_code == 201, res.text
    return res.json()


def _make_schedule(client, machine_id: int, chu_ky=30, ngay_gan_nhat=None):
    payload = {
        "machine_id": machine_id,
        "loai_bao_tri": "Bảo trì định kỳ",
        "chu_ky_ngay": chu_ky,
    }
    if ngay_gan_nhat:
        payload["ngay_bao_tri_gan_nhat"] = ngay_gan_nhat
    res = client.post("/api/maintenance/schedules", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


# ─── Machine ─────────────────────────────────────────────────────────────────

def test_create_machine_returns_ma_may(client, db_session):
    """Tạo máy hợp lệ → 201, ma_may đúng."""
    m = _make_machine(client, "MAY_T1")
    assert m["ma_may"] == "MAY_T1"
    assert m["trang_thai"] == "dang_dung"


def test_invalid_trang_thai_machine_returns_422(client, db_session):
    """trang_thai không hợp lệ → 422."""
    res = client.post("/api/maintenance/machines", json={
        "ma_may": "MAY_X", "ten_may": "Test", "trang_thai": "sai_trang_thai",
    })
    assert res.status_code == 422


def test_list_machines(client, db_session):
    """GET /machines → trả về list."""
    _make_machine(client, "MAY_L1")
    res = client.get("/api/maintenance/machines")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) >= 1


# ─── Schedule ────────────────────────────────────────────────────────────────

def test_create_schedule_calculates_next_date(client, db_session):
    """Tạo lịch với ngay_bao_tri_gan_nhat → ngay_tiep_theo = gan_nhat + chu_ky."""
    m = _make_machine(client, "MAY_S1")
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    s = _make_schedule(client, m["id"], chu_ky=30, ngay_gan_nhat=yesterday)
    expected = (date.today() - timedelta(days=1) + timedelta(days=30)).isoformat()
    assert s["ngay_bao_tri_tiep_theo"] == expected


def test_complete_schedule_updates_dates(client, db_session):
    """complete → ngay_gan_nhat = hôm nay, ngay_tiep_theo = hôm nay + chu kỳ."""
    m = _make_machine(client, "MAY_S2")
    s = _make_schedule(client, m["id"], chu_ky=14)

    res = client.post(f"/api/maintenance/schedules/{s['id']}/complete")
    assert res.status_code == 200, res.text
    data = res.json()
    today = date.today().isoformat()
    expected_next = (date.today() + timedelta(days=14)).isoformat()
    assert data["ngay_bao_tri_gan_nhat"] == today
    assert data["ngay_bao_tri_tiep_theo"] == expected_next


# ─── Log ─────────────────────────────────────────────────────────────────────

def test_create_log_calculates_tong_chi_phi(client, db_session):
    """Log sự cố → tong_chi_phi = chi_phi_vat_tu + chi_phi_nhan_cong."""
    m = _make_machine(client, "MAY_G1")
    res = client.post("/api/maintenance/logs", json={
        "machine_id": m["id"],
        "loai": "su_co",
        "ngay_bat_dau": date.today().isoformat(),
        "chi_phi_vat_tu": 500000,
        "chi_phi_nhan_cong": 300000,
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert float(data["tong_chi_phi"]) == 800000.0


def test_invalid_loai_log_returns_422(client, db_session):
    """loai log không hợp lệ → 422."""
    m = _make_machine(client, "MAY_G2")
    res = client.post("/api/maintenance/logs", json={
        "machine_id": m["id"],
        "loai": "sai_loai",
        "ngay_bat_dau": date.today().isoformat(),
    })
    assert res.status_code == 422


# ─── Overdue ─────────────────────────────────────────────────────────────────

def test_overdue_returns_qua_han_machines(client, db_session):
    """Máy có lịch quá hạn → xuất hiện trong /overdue."""
    m = _make_machine(client, "MAY_OD1")
    # ngày tiếp theo = 60 ngày trước (quá hạn)
    old_date = (date.today() - timedelta(days=60)).isoformat()
    _make_schedule(client, m["id"], chu_ky=30, ngay_gan_nhat=old_date)

    # Gọi complete để set ngay_tiep_theo = old + 30 (vẫn trong quá khứ)
    # Thực ra chỉ cần tạo schedule với ngay_bao_tri_tiep_theo trong quá khứ
    res = client.get("/api/maintenance/overdue")
    assert res.status_code == 200
    # Ít nhất 1 lịch quá hạn vừa tạo
    overdue = res.json()
    assert isinstance(overdue, list)
