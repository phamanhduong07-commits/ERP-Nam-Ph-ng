"""
Sprint 2.1 — Test HR payroll module
Covers: calculate-production endpoint, generate payroll, PayrollRun CRUD.
"""
from datetime import date
from decimal import Decimal

from app.models.hr import Employee, PayrollRun, PayrollConfig
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


# ─── calculate-production endpoint ──────────────────────────────────────────

def test_calculate_production_returns_list(client, db_session):
    """GET calculate-production không có data → trả về list rỗng, không crash."""
    res = client.get(
        "/api/hr/payroll/calculate-production",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_calculate_production_with_config(client, db_session):
    """Có PayrollConfig loại san_pham → endpoint vẫn trả về 200."""
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


# ─── generate payroll ───────────────────────────────────────────────────────

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
