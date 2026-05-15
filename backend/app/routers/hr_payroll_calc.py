from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import calendar
from app.database import get_db
from app.models.hr import Employee, PayrollRun, AttendanceLog, FuelLog, RewardDiscipline
from app.models.warehouse_doc import DeliveryOrder
from app.models.master import DonGiaVanChuyen
from app.services.hr_service import PayrollService
from app.routers.logistics_hr import calculate_trip_salary_allocations
from decimal import Decimal

router = APIRouter(prefix="/api/hr/payroll", tags=["HR Payroll Calculation"])

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
    attendance_rows = db.query(AttendanceLog).filter(
        AttendanceLog.ngay >= first_day,
        AttendanceLog.ngay <= last_day
    ).all()
    attendance_by_emp: dict[int, dict[str, Decimal]] = {}
    for row in attendance_rows:
        bucket = attendance_by_emp.setdefault(row.employee_id, {"cong": Decimal("0"), "ot": Decimal("0")})
        bucket["cong"] += row.so_cong or Decimal("0")
        bucket["ot"] += row.so_gio_ot or Decimal("0")

    for emp in employees:
        # 1. Lương cơ bản (từ hợp đồng mới nhất)
        contract = sorted(emp.contracts, key=lambda x: x.ngay_ky, reverse=True)
        base_salary = contract[0].luong_co_ban if contract else Decimal(0)
        
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
        phu_cap = contract[0].phu_cap if contract else Decimal(0)
        attendance = attendance_by_emp.get(emp.id, {"cong": Decimal("0"), "ot": Decimal("0")})
        ot_salary = Decimal("0")
        if attendance["ot"] > 0 and base_salary > 0:
            ot_salary = (base_salary / Decimal("26") / Decimal("8")) * Decimal("1.5") * attendance["ot"]
        phu_cap = phu_cap + ot_salary
        
        # Giả định bảo hiểm 10.5% lương cơ bản
        bao_hiem = base_salary * Decimal("0.105")
        
        thuc_linh = base_salary + product_salary + trip_salary + phu_cap + tong_thuong - tong_phat - bao_hiem

        payroll_entry = PayrollRun(
            thang=thang,
            nam=nam,
            employee_id=emp.id,
            luong_co_ban=base_salary,
            luong_san_pham=product_salary,
            luong_chuyen=trip_salary,
            phu_cap=phu_cap,
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
        result.append({
            "id": r.id,
            "ma_nv": r.employee.ma_nv,
            "ho_ten": r.employee.ho_ten,
            "luong_co_ban": r.luong_co_ban,
            "luong_san_pham": r.luong_san_pham,
            "luong_chuyen": r.luong_chuyen,
            "phu_cap": r.phu_cap,
            "bao_hiem": r.bao_hiem,
            "thuc_linh": r.thuc_linh,
            "trang_thai": r.trang_thai
        })
    return result
