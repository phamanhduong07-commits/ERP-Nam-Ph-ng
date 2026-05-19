"""
Test coverage cho CD2 state machine — 15 test cases.

Chạy: pytest backend/tests/test_cd2_state.py -v
"""


# ── 1. start_printing ──────────────────────────────────────────────────────────

def test_start_printing_success(client, phieu_in_cho_in):
    """cho_in → dang_in thành công."""
    r = client.post(f"/api/cd2/phieu-in/{phieu_in_cho_in.id}/start")
    assert r.status_code == 200
    assert r.json()["trang_thai"] == "dang_in"
    assert r.json()["gio_bat_dau_in"] is not None


def test_start_printing_wrong_state(client, phieu_in_dang_in):
    """Không thể bắt đầu in nếu đã dang_in."""
    r = client.post(f"/api/cd2/phieu-in/{phieu_in_dang_in.id}/start")
    assert r.status_code == 400
    assert "dang_in" in r.json()["detail"]


def test_start_printing_not_found(client):
    """404 nếu phiếu không tồn tại."""
    r = client.post("/api/cd2/phieu-in/999999/start")
    assert r.status_code == 404


# ── 2. complete_printing ───────────────────────────────────────────────────────

def test_complete_printing_success(client, phieu_in_dang_in):
    """dang_in → cho_dinh_hinh thành công."""
    r = client.post(
        f"/api/cd2/phieu-in/{phieu_in_dang_in.id}/complete",
        json={"so_luong_in_ok": 85},
    )
    assert r.status_code == 200
    assert r.json()["trang_thai"] == "cho_dinh_hinh"
    assert r.json()["so_luong_in_ok"] == 85.0


def test_complete_printing_wrong_state(client, phieu_in_cho_in):
    """400 nếu phiếu không ở dang_in."""
    r = client.post(
        f"/api/cd2/phieu-in/{phieu_in_cho_in.id}/complete",
        json={"so_luong_in_ok": 50},
    )
    assert r.status_code == 400


def test_complete_printing_negative_quantity(client, phieu_in_dang_in):
    """422 nếu so_luong_in_ok âm (Pydantic ge=0 validation)."""
    r = client.post(
        f"/api/cd2/phieu-in/{phieu_in_dang_in.id}/complete",
        json={"so_luong_in_ok": -1},
    )
    assert r.status_code == 422


def test_complete_printing_exceeds_110_percent(client, phieu_in_dang_in):
    """400 nếu SL đạt vượt 110% SL phôi (100 → tối đa 110)."""
    r = client.post(
        f"/api/cd2/phieu-in/{phieu_in_dang_in.id}/complete",
        json={"so_luong_in_ok": 200},
    )
    assert r.status_code == 400
    assert "110%" in r.json()["detail"]


# ── 3. huy_phieu ───────────────────────────────────────────────────────────────

def test_huy_phieu_from_dang_in(client, phieu_in_dang_in):
    """dang_in → cho_in (không có máy) khi huỷ."""
    r = client.post(f"/api/cd2/phieu-in/{phieu_in_dang_in.id}/huy")
    assert r.status_code == 200
    assert r.json()["trang_thai"] in ("cho_in", "ke_hoach")
    assert r.json()["gio_bat_dau_in"] is None


def test_huy_phieu_hoan_thanh_forbidden(client, phieu_in_hoan_thanh):
    """400 nếu phiếu đã hoàn thành."""
    r = client.post(f"/api/cd2/phieu-in/{phieu_in_hoan_thanh.id}/huy")
    assert r.status_code == 400
    assert "hoàn thành" in r.json()["detail"]


# ── 4. sau_in flow ────────────────────────────────────────────────────────────

def test_start_sau_in_success(client, phieu_in_cho_dinh_hinh):
    """cho_dinh_hinh → sau_in thành công."""
    r = client.post(
        f"/api/cd2/phieu-in/{phieu_in_cho_dinh_hinh.id}/sau-in",
        json={},
    )
    assert r.status_code == 200
    assert r.json()["trang_thai"] == "sau_in"


def test_bat_dau_sau_in_no_machine(client, db_session):
    """400 nếu chưa gán máy sau in."""
    from app.models.cd2 import PhieuIn
    p = PhieuIn(so_phieu="TEST-NOMAY", trang_thai="sau_in", may_sau_in_id=None)
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)

    r = client.post(f"/api/cd2/phieu-in/{p.id}/bat-dau-sau-in")
    assert r.status_code == 400
    assert "máy sau in" in r.json()["detail"]


def test_bat_dau_sau_in_success(client, phieu_in_sau_in):
    """sau_in → dang_sau_in thành công khi đã có máy."""
    r = client.post(f"/api/cd2/phieu-in/{phieu_in_sau_in.id}/bat-dau-sau-in")
    assert r.status_code == 200
    assert r.json()["trang_thai"] == "dang_sau_in"


# ── 5. tam_dung / tiep_tuc ────────────────────────────────────────────────────

def test_tam_dung_wrong_state(client, phieu_in_cho_in):
    """400 nếu phiếu chưa đang_in/dang_sau_in."""
    r = client.post(
        f"/api/cd2/phieu-in/{phieu_in_cho_in.id}/tam-dung",
        json={"ly_do": "Hết mực"},
    )
    assert r.status_code == 400


def test_tam_dung_and_tiep_tuc(client, phieu_in_dang_in):
    """Tạm dừng → ghi DB; tiếp tục → xoá."""
    r_pause = client.post(
        f"/api/cd2/phieu-in/{phieu_in_dang_in.id}/tam-dung",
        json={"ly_do": "Test pause"},
    )
    assert r_pause.status_code == 200
    assert r_pause.json()["tam_dung_ly_do"] == "Test pause"

    r_resume = client.post(f"/api/cd2/phieu-in/{phieu_in_dang_in.id}/tiep-tuc")
    assert r_resume.status_code == 200
    assert r_resume.json()["tam_dung_luc"] is None


# ── 6. Scan validation ────────────────────────────────────────────────────────

def test_scan_so_lsx_too_long(client, db_session):
    """422 nếu so_lsx dài hơn 50 ký tự (Field max_length=50)."""
    from app.models.cd2 import MayScan
    may = MayScan(ten_may="Scanner test")
    db_session.add(may)
    db_session.commit()
    db_session.refresh(may)

    r = client.post(
        "/api/cd2/scan-logs/submit",
        json={"may_scan_id": may.id, "so_lsx": "X" * 51, "so_luong_tp": 10},
    )
    assert r.status_code == 422


# ── 7. Audit log ──────────────────────────────────────────────────────────────

def test_audit_log_written_on_start(client, phieu_in_cho_in, db_session):
    """start_printing phải ghi 1 dòng vào phieu_in_state_log."""
    from app.models.cd2 import PhieuInStateLog

    client.post(f"/api/cd2/phieu-in/{phieu_in_cho_in.id}/start")

    logs = db_session.query(PhieuInStateLog).filter_by(phieu_in_id=phieu_in_cho_in.id).all()
    assert len(logs) == 1
    assert logs[0].hanh_dong == "start_printing"
    assert logs[0].den_trang_thai == "dang_in"


def test_history_endpoint(client, phieu_in_cho_in):
    """GET /history trả về danh sách log sau khi start."""
    client.post(f"/api/cd2/phieu-in/{phieu_in_cho_in.id}/start")

    r = client.get(f"/api/cd2/phieu-in/{phieu_in_cho_in.id}/history")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["hanh_dong"] == "start_printing"
