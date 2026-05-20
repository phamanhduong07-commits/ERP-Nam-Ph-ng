from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.hr import Employee, PayrollRun, AttendanceLog, LeaveRequest
from app.models.auth import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/hr/me", tags=["HR Employee Self-Service"])


@router.get("/profile")
def get_my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ nhân viên liên kết")
    return {
        "id": emp.id,
        "employee_id": emp.id,
        "ho_ten": emp.ho_ten,
        "ma_nv": emp.ma_nv,
        "bo_phan": emp.bo_phan.ten_bo_phan if emp.bo_phan else "N/A",
        "chuc_vu": emp.chuc_vu.ten_chuc_vu if emp.chuc_vu else "N/A"
    }


@router.get("/payroll")
def get_my_payroll(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []

    runs = db.query(PayrollRun).filter(
        PayrollRun.employee_id == emp.id).order_by(
        PayrollRun.nam.desc(),
        PayrollRun.thang.desc()).all()
    return runs


@router.get("/attendance")
def get_my_attendance(
    thang: int, nam: int,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []

    logs = db.query(AttendanceLog).filter(
        AttendanceLog.employee_id == emp.id,
        func.extract('month', AttendanceLog.ngay) == thang,
        func.extract('year', AttendanceLog.ngay) == nam
    ).all()
    return logs


@router.get("/leave-requests")
def get_my_leave_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []

    return db.query(LeaveRequest).filter(LeaveRequest.employee_id ==
                                         emp.id).order_by(LeaveRequest.created_at.desc()).all()
