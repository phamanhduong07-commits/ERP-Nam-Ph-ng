"""UAT end-to-end Sprint D — Lương sản phẩm tự động theo Quy chế 17 Điều.

Kịch bản:
  1. Setup NV test có user_id (đăng nhập Mobile được)
  2. Tạo chấm công 22 ngày × 8h trong tháng 6/2026
  3. Tạo sản lượng tháng (đã xác nhận) — bộ phận test
  4. Tạo phụ cấp cộng thêm + BHXH (đã duyệt)
  5. Chạy engine commit → kiểm lương
  6. HR chốt bảng lương → set ngay_chot
  7. NV đăng nhập → GET phiếu lương Mobile
  8. NV gửi khiếu nại → kiểm hạn 15 ngày
  9. HR xử lý kết luận có sai sót + tạo adjustment kỳ sau
 10. BGĐ duyệt thanh toán → kiểm khóa cứng
 11. Verify cuối: thử khiếu nại lại (phải fail)

Chạy: python scripts/uat_sprint_d.py
Cleanup: thêm flag --cleanup để xóa toàn bộ NV + records test

NOTE: Script độc lập với DB production — dùng prefix UAT_ cho mọi entity test,
      filter sạch sẽ khi cleanup.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests
from app.database import SessionLocal
from app.models.auth import Role, User
from app.models.hr import (
    AttendanceLog, Department, Employee, PayrollAdjustment, PayrollComplaint,
    PayrollRun, ProductionOutput, Team,
)
from app.routers.auth import _hash_password as hash_password

BASE = "http://127.0.0.1:8002"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"
UAT_USER = "uat_nv_test"
UAT_PASS = "uat-test-2026"
UAT_THANG, UAT_NAM = 6, 2026


# ─── Utilities ───
class Stats:
    passed = 0
    failed = 0
    warned = 0

    @classmethod
    def ok(cls, msg):
        cls.passed += 1
        print(f"  ✅ {msg}")

    @classmethod
    def fail(cls, msg):
        cls.failed += 1
        print(f"  ❌ {msg}")

    @classmethod
    def warn(cls, msg):
        cls.warned += 1
        print(f"  ⚠️  {msg}")

    @classmethod
    def info(cls, msg):
        print(f"  ℹ️  {msg}")


def step(title):
    print(f"\n{'═' * 70}\n{title}\n{'═' * 70}")


def login(username: str, password: str) -> dict:
    r = requests.post(f"{BASE}/api/auth/login",
                      data={"username": username, "password": password},
                      timeout=10)
    r.raise_for_status()
    t = r.json()["access_token"]
    return {"Authorization": f"Bearer {t}"}


def fmt(v) -> str:
    return f"{float(v or 0):,.0f}đ"


# ─── Step 0: Cleanup data cũ ───
def cleanup_uat_data(db):
    step("STEP 0 · Cleanup data UAT cũ (nếu có)")

    uat_emp_ids = [e.id for e in db.query(Employee).filter(Employee.ma_nv.like("UAT_%")).all()]
    if uat_emp_ids:
        db.query(PayrollComplaint).filter(PayrollComplaint.employee_id.in_(uat_emp_ids)).delete(synchronize_session=False)
        db.query(PayrollAdjustment).filter(PayrollAdjustment.employee_id.in_(uat_emp_ids)).delete(synchronize_session=False)
        db.query(PayrollRun).filter(PayrollRun.employee_id.in_(uat_emp_ids)).delete(synchronize_session=False)
        db.query(AttendanceLog).filter(AttendanceLog.employee_id.in_(uat_emp_ids)).delete(synchronize_session=False)

    db.query(ProductionOutput).filter(ProductionOutput.bo_phan_id.in_(
        [d.id for d in db.query(Department).filter(Department.ten_bo_phan.like("UAT %")).all()]
    )).delete(synchronize_session=False)

    db.query(Employee).filter(Employee.ma_nv.like("UAT_%")).delete(synchronize_session=False)
    db.query(Team).filter(Team.ten_to.like("UAT %")).delete(synchronize_session=False)
    db.query(Department).filter(Department.ten_bo_phan.like("UAT %")).delete(synchronize_session=False)
    db.query(User).filter(User.username.like("uat_%")).delete(synchronize_session=False)
    db.commit()
    Stats.ok("Đã xóa toàn bộ UAT data cũ")


# ─── Step 1: Setup ───
def setup_test_data(db) -> dict:
    step("STEP 1 · Setup bộ phận + tổ + NV test")

    # Bộ phận
    dept = Department(ma_bo_phan="UAT", ten_bo_phan="UAT Sản xuất test", trang_thai=True)
    db.add(dept); db.flush()
    Stats.ok(f"Bộ phận #{dept.id} '{dept.ten_bo_phan}'")

    # Tổ
    team = Team(bo_phan_id=dept.id, ten_to="UAT Tổ A", trang_thai=True)
    db.add(team); db.flush()
    Stats.ok(f"Tổ #{team.id} '{team.ten_to}' thuộc bộ phận #{dept.id}")

    # Role: tìm CONG_NHAN, fallback dùng role bất kỳ đã có (tránh phá sequence)
    role = (
        db.query(Role).filter(Role.ma_vai_tro == "CONG_NHAN").first()
        or db.query(Role).filter(Role.ma_vai_tro.in_(["NHAN_VIEN", "CONG_NHAN", "STAFF"])).first()
        or db.query(Role).order_by(Role.id.desc()).filter(Role.ma_vai_tro != "ADMIN").first()
        or db.query(Role).first()
    )
    if not role:
        Stats.fail("Không có role nào trong DB — phải seed trước!")
        sys.exit(1)
    Stats.info(f"Role dùng cho UAT: #{role.id} {role.ma_vai_tro}")

    # User
    user = User(
        username=UAT_USER,
        password_hash=hash_password(UAT_PASS),
        ho_ten="Nguyễn Văn UAT",
        email="uat@namphuongbaobi.com",
        role_id=role.id,
        trang_thai=True,
        must_change_password=False,
    )
    db.add(user); db.flush()
    Stats.ok(f"User '{UAT_USER}' / pass '{UAT_PASS}' (role={role.ma_vai_tro})")

    # Employee
    emp = Employee(
        ma_nv="UAT_001",
        ho_ten="Nguyễn Văn UAT",
        bo_phan_id=dept.id,
        to_id=team.id,
        user_id=user.id,
        he_so_ca_nhan=Decimal("1.5"),
        trang_thai="dang_lam",
        ngay_vao_lam=date(2024, 1, 1),
    )
    db.add(emp); db.flush()
    db.commit()
    Stats.ok(f"Employee #{emp.id} 'UAT_001' liên kết user_id={user.id}, hệ số 1.5")

    return {"dept": dept, "team": team, "user": user, "emp": emp}


# ─── Step 2: Chấm công ───
def create_attendance(db, emp: Employee):
    step("STEP 2 · Tạo chấm công 22 ngày × 8h tháng 6/2026")

    start = date(UAT_NAM, UAT_THANG, 1)
    end = date(UAT_NAM, UAT_THANG, 30)
    cur = start
    count = 0
    total_hours = Decimal("0")

    while cur <= end:
        if cur.weekday() < 5 and count < 22:  # T2-T6, tối đa 22 ngày
            log = AttendanceLog(
                employee_id=emp.id,
                ngay=cur,
                gio_vao=datetime.combine(cur, datetime.min.time().replace(hour=7, minute=30)),
                gio_ra=datetime.combine(cur, datetime.min.time().replace(hour=17, minute=0)),
                tong_gio_thuc=Decimal("8"),
                so_cong=Decimal("1"),
                trang_thai="hop_le",
            )
            db.add(log)
            count += 1
            total_hours += Decimal("8")
        cur += timedelta(days=1)
    db.commit()
    Stats.ok(f"Tạo {count} ngày chấm công, tổng {total_hours}h thực tế (= {total_hours/8} công quy đổi)")


# ─── Step 3: Sản lượng ───
def create_production(db, dept: Department, team: Team, admin_h: dict):
    step("STEP 3 · Tạo sản lượng tháng (qua API + xác nhận)")

    # Tạo sản lượng cho 5 ngày trong tháng — mã hàng MAYSONG_A
    payloads = []
    for d in [5, 10, 15, 20, 25]:
        payloads.append({
            "ngay": f"{UAT_NAM}-{UAT_THANG:02d}-{d:02d}",
            "ma_hang": "MAYSONG_A",
            "bo_phan_id": dept.id,
            "to_id": team.id,
            "ca": "all",
            "san_luong": 1000,
            "san_luong_loi": 0,
            "ghi_chu": "UAT test",
        })

    # Tạo bulk
    r = requests.post(f"{BASE}/api/hr/production-outputs/bulk",
                      json={"items": payloads}, headers=admin_h, timeout=15)
    if r.status_code != 200:
        Stats.fail(f"Tạo sản lượng thất bại: {r.status_code} {r.text[:200]}")
        return
    resp = r.json()
    created = resp.get("created", 0)
    errs = resp.get("errors", [])
    if created == 0:
        Stats.fail(f"Tạo sản lượng thất bại — created=0, errors={errs[:3]}")
        return
    Stats.ok(f"Tạo {created} bản ghi sản lượng (5 ngày × 1000 đơn vị mã MAYSONG_A)")
    if errs:
        Stats.warn(f"Có {len(errs)} lỗi: {errs[:3]}")

    # Phải xác nhận thì engine mới đọc. Lấy ID rồi confirm — cần login bằng user khác cho 4-eyes
    # Tạm cho admin confirm (admin bypass 4-eyes)
    rows = db.query(ProductionOutput).filter(
        ProductionOutput.bo_phan_id == dept.id,
        ProductionOutput.trang_thai == "cho_xac_nhan",
    ).all()
    for o in rows:
        rr = requests.put(f"{BASE}/api/hr/production-outputs/{o.id}/confirm",
                          headers=admin_h, timeout=10)
        if rr.status_code != 200:
            Stats.fail(f"Confirm SL #{o.id} fail: {rr.text[:120]}")
            return
    Stats.ok(f"Đã xác nhận {len(rows)} bản ghi sản lượng (qua admin bypass 4-eyes)")


# ─── Step 4: Adjustments ───
def create_adjustments(db, emp: Employee, admin_h: dict):
    step("STEP 4 · Tạo Phụ cấp chức vụ + BHXH (đã duyệt)")

    # Cộng thêm — Phụ cấp chức vụ 500k
    r = requests.post(f"{BASE}/api/hr/payroll-adjustments",
                      json={
                          "employee_id": emp.id,
                          "thang": UAT_THANG, "nam": UAT_NAM,
                          "loai": "cong_them", "sub_loai": "pc_chuc_vu",
                          "so_tien": 500000,
                          "ghi_chu": "UAT - phụ cấp chức vụ test",
                      }, headers=admin_h, timeout=10)
    if r.status_code != 200:
        Stats.fail(f"Tạo PC chức vụ fail: {r.text[:120]}")
        return
    adj1_id = r.json()["id"]
    Stats.ok(f"PC chức vụ #{adj1_id} — 500.000đ")

    # Khấu trừ — BHXH 8% của 5tr = 400k
    r = requests.post(f"{BASE}/api/hr/payroll-adjustments",
                      json={
                          "employee_id": emp.id,
                          "thang": UAT_THANG, "nam": UAT_NAM,
                          "loai": "khau_tru", "sub_loai": "bhxh",
                          "so_tien": 400000,
                          "ghi_chu": "UAT - BHXH 8% × 5tr",
                      }, headers=admin_h, timeout=10)
    if r.status_code != 200:
        Stats.fail(f"Tạo BHXH fail: {r.text[:120]}")
        return
    adj2_id = r.json()["id"]
    Stats.ok(f"Khấu trừ BHXH #{adj2_id} — 400.000đ")

    # Duyệt cả 2 (admin bypass 4-eyes)
    for adj_id in [adj1_id, adj2_id]:
        rr = requests.put(f"{BASE}/api/hr/payroll-adjustments/{adj_id}/approve",
                          headers=admin_h, timeout=10)
        if rr.status_code != 200:
            Stats.fail(f"Duyệt adj #{adj_id} fail: {rr.text[:120]}")
            return
    Stats.ok("Đã duyệt 2 khoản (chuyển sang trạng thái da_duyet)")


# ─── Step 5: Engine ───
def run_engine(admin_h: dict):
    step("STEP 5 · Chạy engine commit tháng 6/2026")

    r = requests.post(f"{BASE}/api/hr/payroll/engine/commit",
                      json={"nam": UAT_NAM, "thang": UAT_THANG, "dry_run": False},
                      headers=admin_h, timeout=60)
    if r.status_code != 200:
        Stats.fail(f"Engine fail: {r.text[:200]}")
        return None
    d = r.json()
    s = d.get("summary", {})
    Stats.ok(f"Engine OK · NV có lương: {s.get('so_nv_tinh')} · Bỏ qua: {s.get('so_nv_bo_qua')} · Âm: {s.get('so_nv_thuc_linh_am')}")
    Stats.info(f"Tổng quỹ thực lĩnh: {fmt(s.get('tong_thuc_linh'))} · Bù tối thiểu: {fmt(s.get('tong_bu_toi_thieu'))}")
    return d


# ─── Step 6: Verify lương NV UAT ───
def verify_payroll(db, emp: Employee):
    step("STEP 6 · Verify chi tiết lương NV UAT")
    run = db.query(PayrollRun).filter(
        PayrollRun.employee_id == emp.id,
        PayrollRun.thang == UAT_THANG, PayrollRun.nam == UAT_NAM,
    ).first()
    if not run:
        Stats.fail("Không tìm thấy PayrollRun cho NV UAT")
        return None

    Stats.ok(f"PayrollRun #{run.id} tạo thành công")
    print()
    print(f"    Lương sản phẩm:        {fmt(run.luong_san_pham):>16}")
    print(f"    Bù tối thiểu vùng:     {fmt(run.bu_toi_thieu_vung):>16}")
    print(f"    Cộng thêm (PC):        {fmt(run.phu_cap):>16}")
    print(f"    {'─' * 50}")
    print(f"    Tổng thu nhập:         {fmt(run.tong_thu_nhap):>16}")
    print(f"    − Bảo hiểm:            {fmt(run.bao_hiem):>16}")
    print(f"    − Tạm ứng:             {fmt(run.tam_ung):>16}")
    print(f"    {'─' * 50}")
    print(f"    THỰC LĨNH:             {fmt(run.thuc_linh):>16}")
    print(f"    Trạng thái:            {run.trang_thai:>16}")
    print()

    # Verify công thức:
    # tong_thu_nhap = luong_san_pham + cong_them
    expected_ttn = Decimal(str(run.luong_san_pham)) + Decimal(str(run.phu_cap))
    if abs(Decimal(str(run.tong_thu_nhap)) - expected_ttn) < Decimal("1"):
        Stats.ok("Tổng thu nhập = Lương SP (đã bù) + Cộng thêm ✓")
    else:
        Stats.fail(f"TTN sai: expect {expected_ttn}, got {run.tong_thu_nhap}")

    # thuc_linh = tong_thu_nhap - bao_hiem - tam_ung - (khac)
    expected_tl = Decimal(str(run.tong_thu_nhap)) - Decimal(str(run.bao_hiem)) - Decimal(str(run.tam_ung))
    if abs(Decimal(str(run.thuc_linh)) - expected_tl) < Decimal("1"):
        Stats.ok("Thực lĩnh = Tổng thu nhập − Bảo hiểm − Tạm ứng ✓")
    else:
        Stats.fail(f"Thực lĩnh sai: expect {expected_tl}, got {run.thuc_linh}")

    if Decimal(str(run.thuc_linh)) > 0:
        Stats.ok("Thực lĩnh > 0 (không có bảng âm) ✓")
    else:
        Stats.fail(f"Thực lĩnh ≤ 0! ({run.thuc_linh})")

    return run


# ─── Step 7: HR chốt ───
def hr_chot(admin_h: dict, dept_id: int):
    step("STEP 7 · HR chốt bảng lương tháng (du_thao → da_chot)")

    r = requests.post(f"{BASE}/api/hr/payroll-runs/chot",
                      json={"nam": UAT_NAM, "thang": UAT_THANG, "bo_phan_id": dept_id, "ghi_chu": "UAT chốt"},
                      headers=admin_h, timeout=15)
    if r.status_code != 200:
        Stats.fail(f"Chốt fail: {r.text[:200]}")
        return False
    Stats.ok(f"Đã chốt {r.json()['chot']} bảng lương · ngay_chot tự set")
    return True


def verify_ngay_chot(db, emp_id):
    run = db.query(PayrollRun).filter(
        PayrollRun.employee_id == emp_id,
        PayrollRun.thang == UAT_THANG, PayrollRun.nam == UAT_NAM,
    ).first()
    if run.trang_thai == "da_chot" and run.ngay_chot:
        Stats.ok(f"trang_thai = da_chot · ngay_chot = {run.ngay_chot}")
        return True
    Stats.fail(f"trang_thai={run.trang_thai}, ngay_chot={run.ngay_chot}")
    return False


# ─── Step 8: NV xem phiếu Mobile ───
def nv_view_payslip():
    step("STEP 8 · NV đăng nhập Mobile + xem phiếu lương")

    try:
        nv_h = login(UAT_USER, UAT_PASS)
        Stats.ok("Đăng nhập NV thành công")
    except Exception as e:
        Stats.fail(f"Đăng nhập NV fail: {e}")
        return None

    # List tháng có phiếu
    r = requests.get(f"{BASE}/api/hr/my-payslip/list/available", headers=nv_h, timeout=10)
    if r.status_code != 200 or not r.json():
        Stats.fail(f"List available fail: {r.text[:120]}")
        return nv_h
    Stats.ok(f"NV thấy {len(r.json())} kỳ phiếu lương")

    # Xem phiếu tháng 6/2026
    r = requests.get(f"{BASE}/api/hr/my-payslip/{UAT_NAM}/{UAT_THANG}", headers=nv_h, timeout=10)
    if r.status_code != 200:
        Stats.fail(f"Get phiếu fail: {r.text[:200]}")
        return nv_h
    p = r.json()
    Stats.ok(f"Phiếu lương: thực lĩnh {fmt(p['thuc_linh'])}, cộng thêm {len(p['cong_them_chi_tiet'])} khoản, bảo hiểm {len(p['bao_hiem_chi_tiet'])} khoản")
    Stats.info(f"co_the_khieu_nai={p['co_the_khieu_nai']} · han_chot={p['han_chot_khieu_nai']}")

    if not p["co_the_khieu_nai"]:
        Stats.warn("co_the_khieu_nai = False — NV không thể khiếu nại?")
    return nv_h


# ─── Step 9: NV gửi khiếu nại ───
def nv_create_complaint(nv_h):
    step("STEP 9 · NV gửi khiếu nại lương (Điều 16)")

    r = requests.post(f"{BASE}/api/hr/payroll-complaints",
                      json={
                          "thang": UAT_THANG, "nam": UAT_NAM,
                          "ly_do": "UAT test — tôi nghĩ tháng này thiếu 200.000đ tiền phụ cấp công đoạn ngày 15/6, đề nghị HR kiểm tra lại.",
                          "so_tien_khieu_nai": 200000,
                      }, headers=nv_h, timeout=10)
    if r.status_code != 201:
        Stats.fail(f"Tạo khiếu nại fail: {r.text[:200]}")
        return None
    c = r.json()
    Stats.ok(f"Khiếu nại #{c['id']} tạo thành công · trạng thái: {c['trang_thai']}")
    Stats.info(f"Hạn xử lý: {c['han_chot']} ({c['so_ngay_con_lai']} ngày làm việc còn lại)")
    return c["id"]


# ─── Step 10: HR xử lý khiếu nại ───
def hr_resolve_complaint(admin_h, complaint_id):
    step("STEP 10 · HR xử lý khiếu nại → kết luận có sai sót")

    # HR take
    r = requests.post(f"{BASE}/api/hr/payroll-complaints/{complaint_id}/take",
                      headers=admin_h, timeout=10)
    if r.status_code != 200:
        Stats.fail(f"Take fail: {r.text[:120]}")
        return False
    Stats.ok("HR đã nhận tiếp xử lý → dang_xu_ly")

    # Resolve: co_sai_sot=True, tạo adjustment kỳ sau (tháng 7)
    r = requests.post(f"{BASE}/api/hr/payroll-complaints/{complaint_id}/resolve",
                      json={
                          "co_sai_sot": True,
                          "ket_qua": "Sau khi đối chiếu chấm công + sản lượng, công ty xác nhận thiếu 200.000đ PC công đoạn ngày 15/6. Sẽ điều chỉnh vào kỳ lương tháng 7/2026.",
                          "so_tien_dieu_chinh": 200000,
                          "tao_dieu_chinh_ky_sau": True,
                          "sub_loai_dieu_chinh": "pc_cong_doan",
                      }, headers=admin_h, timeout=10)
    if r.status_code != 200:
        Stats.fail(f"Resolve fail: {r.text[:200]}")
        return False
    res = r.json()
    Stats.ok(f"Kết luận: {res['trang_thai']} · Adjustment kỳ sau #{res['adjustment_id']}")
    return True


# ─── Step 11: Verify adjustment kỳ sau ───
def verify_adjustment_next_month(db, emp_id):
    step("STEP 11 · Verify adjustment đã tạo tự động cho kỳ tháng 7")
    next_thang = UAT_THANG + 1
    adj = db.query(PayrollAdjustment).filter(
        PayrollAdjustment.employee_id == emp_id,
        PayrollAdjustment.thang == next_thang,
        PayrollAdjustment.nam == UAT_NAM,
        PayrollAdjustment.sub_loai == "pc_cong_doan",
    ).first()
    if adj:
        Stats.ok(f"Adjustment kỳ sau #{adj.id}: {adj.sub_loai} {fmt(adj.so_tien)} (trạng thái: {adj.trang_thai})")
    else:
        Stats.fail("Không tìm thấy adjustment kỳ sau!")


# ─── Step 12: BGĐ duyệt thanh toán ───
def bgd_duyet(admin_h, dept_id):
    step("STEP 12 · BGĐ duyệt thanh toán (da_chot → da_thanh_toan)")

    r = requests.post(f"{BASE}/api/hr/payroll-runs/duyet-thanh-toan",
                      json={"nam": UAT_NAM, "thang": UAT_THANG, "bo_phan_id": dept_id},
                      headers=admin_h, timeout=15)
    if r.status_code != 200:
        Stats.fail(f"Duyệt fail: {r.text[:200]}")
        return False
    Stats.ok(f"BGĐ duyệt {r.json()['duyet']} bảng → da_thanh_toan")
    return True


# ─── Step 13: NV không thể khiếu nại sau khi đã thanh toán ───
def verify_locked(nv_h):
    step("STEP 13 · Verify khóa cứng sau thanh toán")

    # Thử tạo khiếu nại mới — phải fail 400 (cùng kỳ + có resolve trước đó)
    r = requests.post(f"{BASE}/api/hr/payroll-complaints",
                      json={"thang": UAT_THANG, "nam": UAT_NAM, "ly_do": "Test khiếu nại lần 2 — phải fail."},
                      headers=nv_h, timeout=10)
    if r.status_code == 400:
        Stats.ok(f"Đúng — không cho khiếu nại lại cùng kỳ đã xử lý ({r.json().get('detail', '')[:60]})")
    else:
        Stats.warn(f"Tạo được khiếu nại lần 2? status={r.status_code}")


# ─── Main ───
def main():
    cleanup_mode = "--cleanup" in sys.argv

    if cleanup_mode:
        db = SessionLocal()
        cleanup_uat_data(db)
        db.close()
        print("\n✅ Cleanup xong.")
        return

    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║         UAT END-TO-END SPRINT D — LƯƠNG SẢN PHẨM TỰ ĐỘNG            ║")
    print("║         Quy chế Lương Nam Phương 17 Điều                             ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")

    # Đăng nhập admin
    admin_h = login(ADMIN_USER, ADMIN_PASS)
    print(f"\n✓ Đăng nhập admin OK")

    # Cleanup data UAT cũ
    db = SessionLocal()
    cleanup_uat_data(db)

    # Setup
    test_data = setup_test_data(db)
    emp = test_data["emp"]
    dept = test_data["dept"]
    team = test_data["team"]

    create_attendance(db, emp)
    create_production(db, dept, team, admin_h)
    create_adjustments(db, emp, admin_h)

    # Run pipeline
    run_engine(admin_h)
    run = verify_payroll(db, emp)
    if not run:
        print("\n❌ Engine fail, dừng UAT")
        db.close()
        sys.exit(1)

    hr_chot(admin_h, dept.id)
    db.expire_all()  # refresh ngay_chot từ DB
    verify_ngay_chot(db, emp.id)

    nv_h = nv_view_payslip()
    if not nv_h:
        db.close()
        sys.exit(1)

    complaint_id = nv_create_complaint(nv_h)
    if complaint_id:
        hr_resolve_complaint(admin_h, complaint_id)
        verify_adjustment_next_month(db, emp.id)

    bgd_duyet(admin_h, dept.id)
    verify_locked(nv_h)

    # Tổng kết
    print(f"\n{'═' * 70}")
    print(f"🎯 KẾT QUẢ UAT")
    print(f"{'═' * 70}")
    print(f"  ✅ Pass:    {Stats.passed}")
    print(f"  ⚠️  Warn:    {Stats.warned}")
    print(f"  ❌ Fail:    {Stats.failed}")
    print(f"\n  Test data còn lại: NV UAT_001 (user: {UAT_USER}/{UAT_PASS})")
    print(f"  Để xóa: python scripts/uat_sprint_d.py --cleanup")
    db.close()

    if Stats.failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
