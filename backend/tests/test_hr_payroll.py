"""
Sprint 2.1 — Test HR payroll module
Covers:
  - PayrollConfig CRUD (san_pham, so_lop_giay)
  - PayrollRun generate, summary, formula check
  - PayrollHoliday CRUD
  - calculate-production endpoint
  - Edge cases: inactive employee, regenerate draft
"""
from datetime import date
from decimal import Decimal

from app.models.hr import Employee, PayrollRun, PayrollConfig, LaborContract, AttendanceLog
from app.models.master import PhanXuong, PhapNhan


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_phap_nhan(db, ma="PN_HR"):
    pn = PhapNhan(ma_phap_nhan=ma, ten_phap_nhan=f"PN {ma}", ten_viet_tat=ma)
    db.add(pn)
    db.flush()
    return pn


def _make_phan_xuong(db, pn_id, ma="PX_HR"):
    px = PhanXuong(ma_xuong=ma, ten_xuong=f"PX {ma}", cong_doan="cd2", phap_nhan_id=pn_id)
    db.add(px)
    db.flush()
    return px


def _make_employee(db, ma="NV001", trang_thai="dang_lam"):
    emp = Employee(
        ma_nv=ma,
        ho_ten=f"Nhân viên {ma}",
        trang_thai=trang_thai,
        ngay_vao_lam=date(2023, 1, 1),
    )
    db.add(emp)
    db.flush()
    return emp


def _make_contract(db, employee_id, luong_co_ban=10_000_000):
    """Tạo hợp đồng lao động với lương cơ bản."""
    so = f"HD-TEST-{employee_id}"
    c = LaborContract(
        employee_id=employee_id,
        so_hop_dong=so,
        loai_hop_dong="khong_thoi_han",
        ngay_ky=date(2025, 1, 1),
        ngay_hieu_luc=date(2025, 1, 1),
        luong_co_ban=Decimal(str(luong_co_ban)),
        trang_thai="hieu_luc",
    )
    db.add(c)
    db.flush()
    return c


def _make_attendance(db, employee_id, ngay, so_cong=1.0, so_gio_ot=0.0):
    """Tạo log chấm công cho nhân viên."""
    a = AttendanceLog(
        employee_id=employee_id,
        ngay=ngay,
        so_cong=Decimal(str(so_cong)),
        tong_gio_thuc=Decimal(str(so_cong * 8)),
        so_gio_ot=Decimal(str(so_gio_ot)),
    )
    db.add(a)
    db.flush()
    return a


# ─── 1. PayrollConfig — loại san_pham ───────────────────────────────────────

def test_create_payroll_config_san_pham(client):
    """Tạo config loại 'san_pham' với ma_hang + don_gia → 200 (upsert)."""
    res = client.post("/api/hr/payroll-configs", json={
        "loai": "san_pham",
        "ma_hang": "MAY_SONG_CD1",
        "ten_hang": "Máy sóng CD1",
        "don_gia": 500,
        "phan_tram_luong_sp": 100,
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["ma_hang"] == "MAY_SONG_CD1"
    assert data["loai"] == "san_pham"
    assert float(data["don_gia"]) == 500.0


def test_create_payroll_config_so_lop_giay(client):
    """Tạo config loại 'so_lop_giay' với ma_cau_hinh + gia_tri → 200."""
    res = client.post("/api/hr/payroll-configs", json={
        "loai": "so_lop_giay",
        "ma_cau_hinh": "HS_3_LOP",
        "ten_cau_hinh": "Hệ số 3 lớp",
        "gia_tri": 1.0,
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["loai"] == "so_lop_giay"
    assert data["ma_cau_hinh"] == "HS_3_LOP"
    assert float(data["gia_tri"]) == 1.0


def test_list_payroll_configs(client):
    """GET danh sách config → 200, trả về list có ít nhất 1 phần tử."""
    client.post("/api/hr/payroll-configs", json={
        "loai": "san_pham",
        "ma_hang": "LIST_TEST_HANG",
        "ten_hang": "Test list hang",
        "don_gia": 300,
    })
    res = client.get("/api/hr/payroll-configs")
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


# ─── 2. PayrollConfig — upsert & update ─────────────────────────────────────

def test_upsert_payroll_config_same_ma_hang_updates(client):
    """POST cùng ma_hang 2 lần → record cũ được update (upsert), không tạo duplicate."""
    payload = {
        "loai": "san_pham",
        "ma_hang": "UPSERT_HANG",
        "ten_hang": "Hang upsert",
        "don_gia": 100,
    }
    r1 = client.post("/api/hr/payroll-configs", json=payload)
    assert r1.status_code == 200
    id1 = r1.json()["id"]

    payload["don_gia"] = 999
    r2 = client.post("/api/hr/payroll-configs", json=payload)
    assert r2.status_code == 200
    assert r2.json()["id"] == id1, "Upsert phải cập nhật record cũ, không tạo mới"
    assert float(r2.json()["don_gia"]) == 999.0


def test_update_payroll_config_by_id(client):
    """PUT /payroll-configs/{id} cập nhật don_gia → giá trị mới trả về."""
    r = client.post("/api/hr/payroll-configs", json={
        "loai": "san_pham",
        "ma_hang": "UPDATE_HANG_ID",
        "ten_hang": "Hang update by id",
        "don_gia": 100,
    })
    cfg_id = r.json()["id"]

    up = client.put(f"/api/hr/payroll-configs/{cfg_id}", json={
        "loai": "san_pham",
        "ma_hang": "UPDATE_HANG_ID",
        "ten_hang": "Hang update by id",
        "don_gia": 750,
    })
    assert up.status_code == 200, up.text
    assert float(up.json()["don_gia"]) == 750.0


# ─── 3. PayrollHoliday ───────────────────────────────────────────────────────

def test_create_payroll_holiday(client):
    """Tạo ngày lễ → 200, trả về record đúng."""
    res = client.post("/api/hr/payroll-holidays", json={
        "ngay": "2026-01-01",
        "ten_ngay_le": "Tết Dương lịch",
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["ngay"] == "2026-01-01"
    assert data["ten_ngay_le"] == "Tết Dương lịch"


def test_list_payroll_holidays(client):
    """GET danh sách ngày lễ → 200, list."""
    client.post("/api/hr/payroll-holidays", json={
        "ngay": "2026-04-30",
        "ten_ngay_le": "Giải phóng miền Nam",
    })
    res = client.get("/api/hr/payroll-holidays")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) >= 1


# ─── 4. calculate-production endpoint ───────────────────────────────────────

def test_calculate_production_returns_list(client, db_session):
    """GET calculate-production không có data → trả về list rỗng, không crash."""
    res = client.get(
        "/api/hr/payroll/calculate-production",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_calculate_production_missing_params_returns_422(client):
    """GET calculate-production thiếu from_date/to_date → 422."""
    res = client.get("/api/hr/payroll/calculate-production")
    assert res.status_code == 422


def test_calculate_production_with_config(client, db_session):
    """Có PayrollConfig loại san_pham → endpoint vẫn trả về 200, list."""
    pn = _make_phap_nhan(db_session, "PN_HR2")
    px = _make_phan_xuong(db_session, pn.id, "PX_HR2")
    cfg = PayrollConfig(
        ma_hang="THUNG_TEST",
        ten_hang="Thùng test",
        phan_xuong_id=px.id,
        don_gia=Decimal("500"),
        loai="san_pham",
        trang_thai=True,
    )
    db_session.add(cfg)
    db_session.commit()

    res = client.get(
        "/api/hr/payroll/calculate-production",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ─── 5. generate payroll ─────────────────────────────────────────────────────

def test_generate_payroll_creates_payroll_runs(client, db_session):
    """POST generate tháng 5/2026 → tạo PayrollRun cho nhân viên đang làm."""
    emp1 = _make_employee(db_session, "NV_GEN1")
    emp2 = _make_employee(db_session, "NV_GEN2")
    db_session.commit()

    res = client.post(
        "/api/hr/payroll/generate",
        params={"thang": 5, "nam": 2026},
    )

    assert res.status_code == 200, res.text
    runs = db_session.query(PayrollRun).filter(
        PayrollRun.thang == 5, PayrollRun.nam == 2026,
    ).all()
    assert len(runs) >= 2
    emp_ids = {r.employee_id for r in runs}
    assert emp1.id in emp_ids
    assert emp2.id in emp_ids


def test_generate_payroll_skips_inactive_employee(client, db_session):
    """Nhân viên trang_thai != dang_lam → không tạo PayrollRun."""
    _make_employee(db_session, "NV_QUIT1", trang_thai="nghi_viec")
    db_session.commit()

    client.post(
        "/api/hr/payroll/generate",
        params={"thang": 4, "nam": 2026},
    )

    runs = db_session.query(PayrollRun).filter(
        PayrollRun.thang == 4, PayrollRun.nam == 2026,
    ).all()
    emp_ids = {r.employee_id for r in runs}
    inactive = db_session.query(Employee).filter(Employee.ma_nv == "NV_QUIT1").first()
    assert inactive.id not in emp_ids


def test_generate_payroll_replaces_draft(client, db_session):
    """Chạy generate 2 lần cùng tháng → draft cũ bị xóa, tạo mới."""
    emp = _make_employee(db_session, "NV_REGEN1")
    db_session.commit()

    client.post("/api/hr/payroll/generate", params={"thang": 3, "nam": 2026})
    client.post("/api/hr/payroll/generate", params={"thang": 3, "nam": 2026})

    runs = db_session.query(PayrollRun).filter(
        PayrollRun.thang == 3,
        PayrollRun.nam == 2026,
        PayrollRun.employee_id == emp.id,
    ).all()
    # Chỉ được có 1 bản ghi (draft cũ đã bị xóa)
    assert len(runs) == 1


def test_generate_payroll_uses_contract_salary(client, db_session):
    """PayrollRun.luong_co_ban phải bằng luong_co_ban trong hợp đồng hiệu lực."""
    emp = _make_employee(db_session, "NV_CONTRACT1")
    _make_contract(db_session, emp.id, luong_co_ban=8_000_000)
    db_session.commit()

    client.post("/api/hr/payroll/generate", params={"thang": 6, "nam": 2026})

    run = db_session.query(PayrollRun).filter(
        PayrollRun.employee_id == emp.id,
        PayrollRun.thang == 6,
        PayrollRun.nam == 2026,
    ).first()
    assert run is not None
    assert float(run.luong_co_ban) == 8_000_000.0


def test_generate_payroll_thuc_linh_formula(client, db_session):
    """thuc_linh = tong_thu_nhap - bao_hiem (10.5% luong_co_ban) khi không OT/thưởng/phạt."""
    emp = _make_employee(db_session, "NV_FORMULA1")
    _make_contract(db_session, emp.id, luong_co_ban=10_000_000)
    # Thêm 26 công để đủ nguyên tháng (tránh ngày weekend/lễ làm lệch)
    for day in range(1, 27):
        try:
            ngay = date(2026, 7, day)
            _make_attendance(db_session, emp.id, ngay, so_cong=1.0)
        except ValueError:
            pass
    db_session.commit()

    client.post("/api/hr/payroll/generate", params={"thang": 7, "nam": 2026})

    run = db_session.query(PayrollRun).filter(
        PayrollRun.employee_id == emp.id,
        PayrollRun.thang == 7,
        PayrollRun.nam == 2026,
    ).first()
    assert run is not None

    # thuc_linh = tong_thu_nhap - tam_ung (phat) - bao_hiem
    expected_thuc_linh = run.tong_thu_nhap - run.tam_ung - run.bao_hiem
    assert abs(float(run.thuc_linh) - float(expected_thuc_linh)) < 1, (
        f"thuc_linh={run.thuc_linh}, expected≈{expected_thuc_linh}"
    )


# ─── 6. payroll summary ──────────────────────────────────────────────────────

def test_payroll_summary_after_generate(client, db_session):
    """GET /summary sau generate → list có ma_nv của nhân viên."""
    emp = _make_employee(db_session, "NV_SUM1")
    _make_contract(db_session, emp.id, luong_co_ban=12_000_000)
    db_session.commit()

    client.post("/api/hr/payroll/generate", params={"thang": 8, "nam": 2026})

    res = client.get("/api/hr/payroll/summary?thang=8&nam=2026")
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)
    ids = [row["ma_nv"] for row in data]
    assert emp.ma_nv in ids


def test_payroll_summary_empty_for_no_runs(client):
    """GET /summary với tháng chưa có dữ liệu → list rỗng."""
    res = client.get("/api/hr/payroll/summary?thang=1&nam=2099")
    assert res.status_code == 200
    assert res.json() == []
