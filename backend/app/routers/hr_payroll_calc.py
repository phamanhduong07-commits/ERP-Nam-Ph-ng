from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
import calendar
from app.database import get_db
from app.models.hr import Employee, PayrollRun, AttendanceLog, RewardDiscipline, PayrollHoliday
from app.services.hr_service import PayrollService
from app.routers.logistics_hr import calculate_trip_salary_allocations
from decimal import Decimal

router = APIRouter(prefix="/api/hr/payroll", tags=["HR Payroll Calculation"])


def _d(value) -> Decimal:
    return Decimal(str(value or 0))


def _latest_contract(emp: Employee):
    contracts = [c for c in emp.contracts if c.trang_thai == "hieu_luc"]
    if not contracts:
        contracts = list(emp.contracts)
    return sorted(contracts, key=lambda x: x.ngay_hieu_luc or x.ngay_ky, reverse=True)[0] if contracts else None


def _allowance_total(contract) -> Decimal:
    if not contract:
        return Decimal("0")
    detailed = sum((
        _d(contract.phu_cap_chuyen_can),
        _d(contract.phu_cap_trach_nhiem),
        _d(contract.phu_cap_nha_o_com),
        _d(contract.phu_cap_dien_thoai),
        _d(contract.phu_cap_khac),
    ), Decimal("0"))
    legacy = _d(contract.phu_cap)
    return detailed if detailed > 0 else legacy


def _attendance_bucket() -> dict[str, Decimal]:
    return {
        "cong": Decimal("0"),
        "gio": Decimal("0"),
        "ot_weekday": Decimal("0"),
        "ot_sunday": Decimal("0"),
        "ot_sunday_extra": Decimal("0"),
        "ot_holiday": Decimal("0"),
    }


def _classify_attendance(row: AttendanceLog, holidays: set[date]) -> tuple[str, Decimal, Decimal]:
    work_hours = _d(row.tong_gio_thuc)
    work_days = _d(row.so_cong)
    if work_hours <= 0 and work_days > 0:
        work_hours = work_days * Decimal("8")
    if work_days <= 0 and work_hours > 0:
        work_days = work_hours / Decimal("8")

    if row.ngay in holidays:
        return "ot_holiday", work_days, work_hours
    if row.ngay.weekday() == 6:
        if work_hours > 8:
            return "ot_sunday_extra", work_days, work_hours
        return "ot_sunday", work_days, work_hours
    return "ot_weekday", work_days, work_hours


@router.get("/calculate-production")
def calculate_production_salary(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
):
    return PayrollService.calculate_production_salary(db, from_date, to_date)


@router.post("/generate")
def generate_payroll(
    thang: int,
    nam: int,
    db: Session = Depends(get_db)
):
    """
    Tính toán lương tự động cho tất cả nhân viên trong tháng
    """
    # Xóa dữ liệu dự thảo cũ của tháng đó (nếu có)
    db.query(PayrollRun).filter(
        PayrollRun.thang == thang,
        PayrollRun.nam == nam,
        PayrollRun.trang_thai == "du_thao"
    ).delete()

    employees = db.query(Employee).filter(Employee.trang_thai == "dang_lam").all()

    first_day = date(nam, thang, 1)
    last_day = date(nam, thang, calendar.monthrange(nam, thang)[1])
    production_rows = PayrollService.calculate_production_salary(db, first_day, last_day)
    product_salary_by_emp = {
        row["employee_id"]: Decimal(str(row.get("luong_sp") or 0))
        for row in production_rows
    }
    trip_salary_rows = calculate_trip_salary_allocations(db, first_day, last_day)
    trip_salary_by_emp = {
        emp_id: Decimal(str(row.get("tien_chuyen") or 0))
        for emp_id, row in trip_salary_rows.items()
    }
    holidays = {
        item.ngay
        for item in db.query(PayrollHoliday).filter(
            PayrollHoliday.ngay >= first_day,
            PayrollHoliday.ngay <= last_day,
            PayrollHoliday.trang_thai.is_(True),
        ).all()
    }
    attendance_rows = db.query(AttendanceLog).filter(
        AttendanceLog.ngay >= first_day,
        AttendanceLog.ngay <= last_day
    ).all()
    attendance_by_emp: dict[int, dict[str, Decimal]] = {}
    for row in attendance_rows:
        bucket = attendance_by_emp.setdefault(row.employee_id, _attendance_bucket())
        ot_key, work_days, work_hours = _classify_attendance(row, holidays)
        bucket["cong"] += work_days
        bucket["gio"] += work_hours
        bucket[ot_key] += _d(row.so_gio_ot)

    for emp in employees:
        # 1. Lương cơ bản (từ hợp đồng mới nhất)
        contract = _latest_contract(emp)
        base_salary = _d(contract.luong_co_ban) if contract else Decimal("0")

        # 2. Lương sản phẩm (Logic Điều 6 - Kết nối với sản lượng sản xuất)
        # Tạm thời để placeholder, sẽ link với module sản xuất sau
        product_salary = product_salary_by_emp.get(emp.id, Decimal("0"))

        # 3. Lương chuyến (Cho tài xế)
        trip_salary = trip_salary_by_emp.get(emp.id, Decimal("0"))

        # 4. Khen thưởng & Kỷ luật
        rewards = db.query(RewardDiscipline).filter(
            RewardDiscipline.employee_id == emp.id,
            RewardDiscipline.thang_ap_dung == thang,
            RewardDiscipline.nam_ap_dung == nam,
            RewardDiscipline.trang_thai == "da_duyet"
        ).all()

        tong_thuong = sum((r.so_tien if r.loai == "khen_thuong" else 0) for r in rewards)
        tong_phat = sum((r.so_tien if r.loai == "ky_luat" else 0) for r in rewards)

        # 5. Tính toán tổng
        phu_cap = _allowance_total(contract)
        attendance = attendance_by_emp.get(emp.id, _attendance_bucket())
        luong_co_ban_phu_cap = base_salary + phu_cap
        ngay_cong_nguyen_luong = attendance["cong"]
        gio_cong_thuc_te = attendance["gio"]
        luong_theo_ngay_cong = (base_salary / Decimal("26")) * \
            ngay_cong_nguyen_luong if base_salary > 0 else Decimal("0")
        hourly_rate = (base_salary / Decimal("26") / Decimal("8")) if base_salary > 0 else Decimal("0")
        ot_tien_ngay_thuong = hourly_rate * Decimal("1.5") * attendance["ot_weekday"]
        ot_tien_chu_nhat = hourly_rate * Decimal("2.0") * attendance["ot_sunday"]
        ot_tien_chu_nhat_tang_ca = hourly_rate * Decimal("2.5") * attendance["ot_sunday_extra"]
        ot_tien_ngay_le = hourly_rate * Decimal("3.0") * attendance["ot_holiday"]
        ot_salary = ot_tien_ngay_thuong + ot_tien_chu_nhat + ot_tien_chu_nhat_tang_ca + ot_tien_ngay_le

        # Giả định bảo hiểm 10.5% lương cơ bản
        bao_hiem = base_salary * Decimal("0.105")

        tien_chuyen_hqcv_thanh_tich = trip_salary + tong_thuong
        thu_nhap_chung = tien_chuyen_hqcv_thanh_tich + ot_salary + phu_cap
        luong_sl = product_salary + thu_nhap_chung
        luong_gio = luong_theo_ngay_cong + thu_nhap_chung
        tong_thu_nhap = luong_sl if luong_sl >= luong_gio else luong_gio
        thuc_linh = tong_thu_nhap - tong_phat - bao_hiem

        payroll_entry = PayrollRun(
            thang=thang,
            nam=nam,
            employee_id=emp.id,
            luong_co_ban=base_salary,
            luong_san_pham=product_salary,
            luong_chuyen=trip_salary,
            luong_co_ban_phu_cap=luong_co_ban_phu_cap,
            ngay_cong_nguyen_luong=ngay_cong_nguyen_luong,
            gio_cong_thuc_te=gio_cong_thuc_te,
            luong_theo_ngay_cong=luong_theo_ngay_cong,
            ot_gio_ngay_thuong=attendance["ot_weekday"],
            ot_gio_chu_nhat=attendance["ot_sunday"],
            ot_gio_chu_nhat_tang_ca=attendance["ot_sunday_extra"],
            ot_gio_ngay_le=attendance["ot_holiday"],
            ot_tien_ngay_thuong=ot_tien_ngay_thuong,
            ot_tien_chu_nhat=ot_tien_chu_nhat,
            ot_tien_chu_nhat_tang_ca=ot_tien_chu_nhat_tang_ca,
            ot_tien_ngay_le=ot_tien_ngay_le,
            phu_cap=phu_cap,
            phu_cap_chuyen_can=_d(getattr(contract, "phu_cap_chuyen_can", 0)),
            phu_cap_trach_nhiem=_d(getattr(contract, "phu_cap_trach_nhiem", 0)),
            phu_cap_nha_o_com=_d(getattr(contract, "phu_cap_nha_o_com", 0)),
            phu_cap_dien_thoai=_d(getattr(contract, "phu_cap_dien_thoai", 0)),
            phu_cap_khac=_d(getattr(contract, "phu_cap_khac", 0)),
            tien_chuyen_hqcv_thanh_tich=tien_chuyen_hqcv_thanh_tich,
            tong_thu_nhap=tong_thu_nhap,
            thuong=tong_thuong,
            tam_ung=tong_phat,
            bao_hiem=bao_hiem,
            thuc_linh=thuc_linh,
            trang_thai="du_thao"
        )
        db.add(payroll_entry)

    db.commit()
    return {"status": "success", "message": f"Đã khởi tạo bảng lương tháng {thang}/{nam}"}


@router.get("/summary")
def get_payroll_summary(
    thang: int,
    nam: int,
    db: Session = Depends(get_db)
):
    runs = db.query(PayrollRun).filter(
        PayrollRun.thang == thang,
        PayrollRun.nam == nam
    ).all()

    result = []
    for r in runs:
        ot_total = (
            (r.ot_tien_ngay_thuong or Decimal("0"))
            + (r.ot_tien_chu_nhat or Decimal("0"))
            + (r.ot_tien_chu_nhat_tang_ca or Decimal("0"))
            + (r.ot_tien_ngay_le or Decimal("0"))
        )
        common_income = (r.tien_chuyen_hqcv_thanh_tich or Decimal("0")) + ot_total + (r.phu_cap or Decimal("0"))
        luong_sl = (r.luong_san_pham or Decimal("0")) + common_income
        luong_gio = (r.luong_theo_ngay_cong or Decimal("0")) + common_income
        chenh_lech_luong = luong_sl - luong_gio
        result.append({
            "id": r.id,
            "ma_nv": r.employee.ma_nv,
            "ho_ten": r.employee.ho_ten,
            "chuc_vu": r.employee.chuc_vu.ten_chuc_vu if r.employee.chuc_vu else None,
            "luong_co_ban": r.luong_co_ban,
            "luong_san_pham": r.luong_san_pham,
            "luong_chuyen": r.luong_chuyen,
            "luong_co_ban_phu_cap": r.luong_co_ban_phu_cap,
            "ngay_cong_nguyen_luong": r.ngay_cong_nguyen_luong,
            "gio_cong_thuc_te": r.gio_cong_thuc_te,
            "luong_theo_ngay_cong": r.luong_theo_ngay_cong,
            "ot_gio_ngay_thuong": r.ot_gio_ngay_thuong,
            "ot_gio_chu_nhat": r.ot_gio_chu_nhat,
            "ot_gio_chu_nhat_tang_ca": r.ot_gio_chu_nhat_tang_ca,
            "ot_gio_ngay_le": r.ot_gio_ngay_le,
            "ot_tien_ngay_thuong": r.ot_tien_ngay_thuong,
            "ot_tien_chu_nhat": r.ot_tien_chu_nhat,
            "ot_tien_chu_nhat_tang_ca": r.ot_tien_chu_nhat_tang_ca,
            "ot_tien_ngay_le": r.ot_tien_ngay_le,
            "phu_cap": r.phu_cap,
            "phu_cap_chuyen_can": r.phu_cap_chuyen_can,
            "phu_cap_trach_nhiem": r.phu_cap_trach_nhiem,
            "phu_cap_nha_o_com": r.phu_cap_nha_o_com,
            "phu_cap_dien_thoai": r.phu_cap_dien_thoai,
            "phu_cap_khac": r.phu_cap_khac,
            "tien_chuyen_hqcv_thanh_tich": r.tien_chuyen_hqcv_thanh_tich,
            "tong_thu_nhap": r.tong_thu_nhap,
            "luong_sl": luong_sl,
            "luong_gio": luong_gio,
            "chenh_lech_luong": chenh_lech_luong,
            "loai_luong_de_xuat": "san_luong" if luong_sl >= luong_gio else "gio",
            "thuong": r.thuong,
            "tam_ung": r.tam_ung,
            "bao_hiem": r.bao_hiem,
            "thuc_linh": r.thuc_linh,
            "trang_thai": r.trang_thai
        })
    return result
