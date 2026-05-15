from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.hr import Department, Position, Employee, AttendanceLog, LeaveRequest, PayrollConfig, EmployeeHistory, EmployeeDocument, LaborContract
from app.services.hr_service import PayrollService
from app.schemas import hr as schemas

router = APIRouter(prefix="/api/hr", tags=["hr"])

def _role_code(user: User) -> str | None:
    return user.role.ma_vai_tro if getattr(user, "role", None) else None

def _sync_leave_to_attendance(req: LeaveRequest, db: Session):
    if req.loai_don != "nghi_phep" or req.trang_thai != "bgd_duyet":
        return
    current = req.ngay_bat_dau.date()
    end = req.ngay_ket_thuc.date()
    while current <= end:
        log = db.query(AttendanceLog).filter(
            AttendanceLog.employee_id == req.employee_id,
            AttendanceLog.ngay == current,
        ).first()
        if not log:
            log = AttendanceLog(employee_id=req.employee_id, ngay=current)
            db.add(log)
        log.trang_thai = "nghi_phep"
        log.so_cong = Decimal("1")
        log.ghi_chu = req.ly_do or "Tu dong cap nhat tu don nghi phep da duyet"
        current += timedelta(days=1)

# --- Departments ---
@router.get("/departments", response_model=List[schemas.Department])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/departments", response_model=schemas.Department)
def create_department(body: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    if db.query(Department).filter(Department.ma_bo_phan == body.ma_bo_phan).first():
        raise HTTPException(400, "Mã bộ phận đã tồn tại")
    db_dept = Department(**body.model_dump())
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept

@router.put("/departments/{id}", response_model=schemas.Department)
def update_department(id: int, body: schemas.DepartmentUpdate, db: Session = Depends(get_db)):
    db_dept = db.get(Department, id)
    if not db_dept:
        raise HTTPException(404, "Khong tim thay bo phan")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(db_dept, k, v)
    db.commit()
    db.refresh(db_dept)
    return db_dept

# --- Positions ---
@router.get("/positions", response_model=List[schemas.Position])
def list_positions(db: Session = Depends(get_db)):
    return db.query(Position).all()

@router.post("/positions", response_model=schemas.Position)
def create_position(body: schemas.PositionCreate, db: Session = Depends(get_db)):
    if db.query(Position).filter(Position.ma_chuc_vu == body.ma_chuc_vu).first():
        raise HTTPException(400, "Mã chức vụ đã tồn tại")
    db_pos = Position(**body.model_dump())
    db.add(db_pos)
    db.commit()
    db.refresh(db_pos)
    return db_pos

# --- Employees ---
@router.get("/employees")
def list_employees(
    search: str = Query(default=""),
    phan_xuong_id: Optional[int] = None,
    phap_nhan_id: Optional[int] = None,
    bo_phan_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Employee)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Employee.ma_nv.ilike(like), Employee.ho_ten.ilike(like)))
    if phan_xuong_id:
        q = q.filter(Employee.phan_xuong_id == phan_xuong_id)
    if phap_nhan_id:
        q = q.filter(Employee.phap_nhan_id == phap_nhan_id)
    if bo_phan_id:
        q = q.filter(Employee.bo_phan_id == bo_phan_id)
    
    employees = q.all()
    # Manual serialization to include related names
    result = []
    for e in employees:
        result.append({
            "id": e.id,
            "ma_nv": e.ma_nv,
            "ho_ten": e.ho_ten,
            "ngay_sinh": e.ngay_sinh.isoformat() if e.ngay_sinh else None,
            "gioi_tinh": e.gioi_tinh,
            "so_dien_thoai": e.so_dien_thoai,
            "email": e.email,
            "cccd": e.cccd,
            "ngay_cap": e.ngay_cap.isoformat() if e.ngay_cap else None,
            "noi_cap": e.noi_cap,
            "dia_chi": e.dia_chi,
            "que_quan": e.que_quan,
            "so_tk_ngan_hang": e.so_tk_ngan_hang,
            "ten_ngan_hang": e.ten_ngan_hang,
            "chi_nhanh_ngan_hang": e.chi_nhanh_ngan_hang,
            "trang_thai": e.trang_thai,
            "ngay_vao_lam": e.ngay_vao_lam.isoformat() if e.ngay_vao_lam else None,
            "ngay_nghi_viec": e.ngay_nghi_viec.isoformat() if e.ngay_nghi_viec else None,
            "phap_nhan_id": e.phap_nhan_id,
            "phan_xuong_id": e.phan_xuong_id,
            "bo_phan_id": e.bo_phan_id,
            "chuc_vu_id": e.chuc_vu_id,
            "ma_van_tay": e.ma_van_tay,
            "he_so_ca_nhan": float(e.he_so_ca_nhan or 0),
            "ten_bo_phan": e.bo_phan.ten_bo_phan if e.bo_phan else None,
            "ten_chuc_vu": e.chuc_vu.ten_chuc_vu if e.chuc_vu else None,
            "ten_phan_xuong": e.phan_xuong.ten_xuong if e.phan_xuong else None,
            "ten_phap_nhan": e.phap_nhan.ten_phap_nhan if e.phap_nhan else None,
            "has_account": e.user_id is not None,
            "username": e.user.username if e.user else None,
            "user_status": e.user.trang_thai if e.user else None,
            "user_id": e.user_id
        })
    return result

@router.get("/employees/{id}")
def get_employee(id: int, db: Session = Depends(get_db)):
    e = db.query(Employee).filter(Employee.id == id).first()
    if not e:
        raise HTTPException(404, "Không tìm thấy nhân viên")
    return e

@router.post("/employees", response_model=schemas.Employee)
def create_employee(body: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    if db.query(Employee).filter(Employee.ma_nv == body.ma_nv).first():
        raise HTTPException(400, "Mã nhân viên đã tồn tại")
    db_emp = Employee(**body.model_dump())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp

@router.post("/employees/bulk")
def bulk_create_employees(body: schemas.EmployeeBulkCreate, db: Session = Depends(get_db)):
    created = 0
    updated = 0
    errors = []
    for idx, item in enumerate(body.items, start=1):
        data = item.model_dump()
        try:
            db_emp = db.query(Employee).filter(Employee.ma_nv == item.ma_nv).first()
            if db_emp:
                for k, v in data.items():
                    setattr(db_emp, k, v)
                updated += 1
            else:
                db.add(Employee(**data))
                created += 1
        except Exception as exc:
            errors.append({"row": idx, "ma_nv": item.ma_nv, "error": str(exc)})
    if errors:
        db.rollback()
        raise HTTPException(400, {"message": "Import nhan vien co loi", "errors": errors})
    db.commit()
    return {"ok": True, "created": created, "updated": updated}

@router.put("/employees/{id}", response_model=schemas.Employee)
def update_employee(
    id: int, 
    body: schemas.EmployeeUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.auth import Role, User as AuthUser
    db_emp = db.query(Employee).filter(Employee.id == id).first()
    if not db_emp:
        raise HTTPException(404, "Không tìm thấy nhân viên")
    
    # Ghi log nếu thay đổi hệ số
    if body.he_so_ca_nhan is not None and body.he_so_ca_nhan != db_emp.he_so_ca_nhan:
        history = EmployeeHistory(
            employee_id=id,
            loai="he_so",
            gia_tri_cu=str(db_emp.he_so_ca_nhan),
            gia_tri_moi=str(body.he_so_ca_nhan),
            ly_do="Cập nhật hệ số lương",
            created_by=current_user.id
        )
        db.add(history)

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(db_emp, k, v)
    
    # Matrix Role Assignment
    if db_emp.user_id and db_emp.bo_phan_id and db_emp.chuc_vu_id:
        user = db.get(AuthUser, db_emp.user_id)
        if user and user.role and user.role.ma_vai_tro != 'ADMIN':
            dept = db.get(Department, db_emp.bo_phan_id)
            pos = db.get(Position, db_emp.chuc_vu_id)
            if dept and pos:
                role_code = f"{dept.ma_bo_phan}_{pos.ma_chuc_vu}"
                new_role = db.query(Role).filter(Role.ma_vai_tro == role_code).first()
                if new_role:
                    user.role_id = new_role.id

    db.commit()
    db.refresh(db_emp)
    return db_emp

@router.get("/employees/{id}/history")
def get_employee_history(id: int, db: Session = Depends(get_db)):
    return db.query(EmployeeHistory).filter(EmployeeHistory.employee_id == id).order_by(EmployeeHistory.created_at.desc()).all()

# --- Contracts & Warnings ---
@router.get("/contracts/expiring")
def list_expiring_contracts(days: int = 30, db: Session = Depends(get_db)):
    from datetime import timedelta
    limit_date = date.today() + timedelta(days=days)
    contracts = db.query(LaborContract).filter(
        LaborContract.trang_thai == "hieu_luc",
        LaborContract.ngay_het_han <= limit_date,
        LaborContract.ngay_het_han >= date.today()
    ).all()
    
    result = []
    for c in contracts:
        result.append({
            "id": c.id,
            "employee_id": c.employee_id,
            "ho_ten": c.employee.ho_ten,
            "so_hop_dong": c.so_hop_dong,
            "ngay_het_han": c.ngay_het_han.isoformat(),
            "con_lai": (c.ngay_het_han - date.today()).days
        })
    return result

# --- Attendance Logs ---
@router.get("/attendance", response_model=List[schemas.AttendanceLog])
def list_attendance(
    employee_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    q = db.query(AttendanceLog)
    if employee_id:
        q = q.filter(AttendanceLog.employee_id == employee_id)
    if from_date:
        q = q.filter(AttendanceLog.ngay >= from_date)
    if to_date:
        q = q.filter(AttendanceLog.ngay <= to_date)
    return q.order_by(AttendanceLog.ngay.desc()).all()

@router.post("/attendance/bulk")
def bulk_create_attendance(logs: List[schemas.AttendanceLogCreate], db: Session = Depends(get_db)):
    """Dùng để import dữ liệu từ máy chấm công"""
    for log in logs:
        # Check if exists
        existing = db.query(AttendanceLog).filter(
            AttendanceLog.employee_id == log.employee_id,
            AttendanceLog.ngay == log.ngay
        ).first()
        if existing:
            for k, v in log.model_dump().items():
                setattr(existing, k, v)
        else:
            db.add(AttendanceLog(**log.model_dump()))
    db.commit()
    return {"ok": True, "count": len(logs)}

@router.post("/attendance/import")
def import_attendance(rows: List[dict], db: Session = Depends(get_db)):
    saved = 0
    errors = []
    for idx, row in enumerate(rows, start=1):
        ma_nv = row.get("ma_nv") or row.get("MA_NV")
        emp = db.query(Employee).filter(Employee.ma_nv == ma_nv).first() if ma_nv else None
        if not emp:
            errors.append({"row": idx, "ma_nv": ma_nv, "error": "Khong tim thay ma NV"})
            continue

        ngay_raw = row.get("ngay")
        try:
            ngay = date.fromisoformat(str(ngay_raw)[:10])
        except Exception:
            errors.append({"row": idx, "ngay": ngay_raw, "error": "Ngay khong hop le"})
            continue

        log = db.query(AttendanceLog).filter(
            AttendanceLog.employee_id == emp.id,
            AttendanceLog.ngay == ngay,
        ).first()
        if not log:
            log = AttendanceLog(employee_id=emp.id, ngay=ngay)
            db.add(log)

        for field in ("gio_vao", "gio_ra"):
            value = row.get(field)
            if value:
                try:
                    setattr(log, field, datetime.fromisoformat(str(value).replace("Z", "+00:00")))
                except Exception:
                    pass
        for field in ("so_cong", "so_gio_ot"):
            if row.get(field) not in (None, ""):
                setattr(log, field, Decimal(str(row.get(field))))
        log.trang_thai = row.get("trang_thai") or log.trang_thai or "hop_le"
        log.ghi_chu = row.get("ghi_chu") or log.ghi_chu
        saved += 1

    if errors:
        db.rollback()
        raise HTTPException(400, {"message": "Import cham cong co loi", "errors": errors})
    db.commit()
    return {"ok": True, "count": saved}

# --- Leave Requests ---
@router.get("/leave-requests")
def list_leave_requests(
    trang_thai: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(LeaveRequest)
    if trang_thai:
        q = q.filter(LeaveRequest.trang_thai == trang_thai)
    
    requests = q.order_by(LeaveRequest.created_at.desc()).all()
    result = []
    for r in requests:
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "ho_ten": r.employee.ho_ten if r.employee else None,
            "employee": {
                "ho_ten": r.employee.ho_ten if r.employee else None,
                "ma_nv": r.employee.ma_nv if r.employee else None,
            },
            "loai_don": r.loai_don,
            "ngay_bat_dau": r.ngay_bat_dau.isoformat() if r.ngay_bat_dau else None,
            "ngay_ket_thuc": r.ngay_ket_thuc.isoformat() if r.ngay_ket_thuc else None,
            "tong_ngay": float(r.tong_ngay) if r.tong_ngay else 0,
            "ly_do": r.ly_do,
            "trang_thai": r.trang_thai,
            "y_kien_duyet": r.y_kien_duyet,
        })
    return result

@router.post("/leave-requests", response_model=schemas.LeaveRequest)
def create_leave_request(body: schemas.LeaveRequestCreate, db: Session = Depends(get_db)):
    db_req = LeaveRequest(**body.model_dump())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

@router.post("/leave-requests/{id}/approve")
def approve_leave_request(
    id: int, 
    y_kien: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.get(LeaveRequest, id)
    if not req:
        raise HTTPException(404, "Không tìm thấy đơn")
    
    # Logic phê duyệt: 
    # 1. Nếu nghỉ >= 3 ngày, cần BGD duyệt cuối cùng.
    # 2. Nếu nghỉ < 3 ngày, HR/Dept duyệt là xong.
    
    is_long_leave = req.tong_ngay >= 3
    
    if _role_code(current_user) in ['ADMIN', 'GIAM_DOC']:
        # BGD duyệt thẳng
        req.trang_thai = "bgd_duyet"
        req.nguoi_duyet_bgd_id = current_user.id
    else:
        # Dept/HR duyệt
        if is_long_leave:
            req.trang_thai = "phong_ban_duyet" # Chờ BGD
        else:
            req.trang_thai = "bgd_duyet" # Coi như hoàn tất
        req.nguoi_duyet_dept_id = current_user.id
    
    req.y_kien_duyet = y_kien
    req.ngay_duyet = datetime.utcnow()
    if req.trang_thai == "bgd_duyet":
        _sync_leave_to_attendance(req, db)
    db.commit()
    return {"status": req.trang_thai}

@router.put("/leave-requests/{id}/approve")
def approve_leave_request_body(
    id: int,
    body: schemas.LeaveApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = db.get(LeaveRequest, id)
    if not req:
        raise HTTPException(404, "Khong tim thay don")
    if body.trang_thai not in {"phong_ban_duyet", "bgd_duyet", "tu_choi", "huy"}:
        raise HTTPException(400, "Trang thai duyet khong hop le")
    req.trang_thai = body.trang_thai
    req.y_kien_duyet = body.y_kien_duyet
    req.ngay_duyet = datetime.utcnow()
    approver_id = body.nguoi_duyet_id or current_user.id
    if req.trang_thai == "phong_ban_duyet":
        req.nguoi_duyet_dept_id = approver_id
    elif req.trang_thai == "bgd_duyet":
        req.nguoi_duyet_bgd_id = approver_id
        _sync_leave_to_attendance(req, db)
    db.commit()
    return {"status": req.trang_thai}

# --- Payroll Config ---
@router.get("/payroll-configs", response_model=List[schemas.PayrollConfig])
def list_payroll_configs(db: Session = Depends(get_db)):
    return db.query(PayrollConfig).all()

@router.post("/payroll-configs", response_model=schemas.PayrollConfig)
def create_payroll_config(body: schemas.PayrollConfigCreate, db: Session = Depends(get_db)):
    db_cfg = db.query(PayrollConfig).filter(PayrollConfig.ma_hang == body.ma_hang).first()
    if db_cfg:
        for k, v in body.model_dump().items():
            setattr(db_cfg, k, v)
    else:
        db_cfg = PayrollConfig(**body.model_dump())
        db.add(db_cfg)
    db.commit()
    db.refresh(db_cfg)
    return db_cfg

@router.put("/payroll-configs/{id}", response_model=schemas.PayrollConfig)
def update_payroll_config(id: int, body: schemas.PayrollConfigCreate, db: Session = Depends(get_db)):
    db_cfg = db.get(PayrollConfig, id)
    if not db_cfg:
        raise HTTPException(404, "Khong tim thay cau hinh luong")
    for k, v in body.model_dump().items():
        setattr(db_cfg, k, v)
    db.commit()
    db.refresh(db_cfg)
    return db_cfg

@router.post("/payroll-configs/bulk")
def bulk_create_payroll_configs(body: schemas.PayrollConfigBulkCreate, db: Session = Depends(get_db)):
    created = 0
    updated = 0
    for item in body.items:
        cfg = db.query(PayrollConfig).filter(PayrollConfig.ma_hang == item.ma_hang).first()
        if cfg:
            for k, v in item.model_dump().items():
                setattr(cfg, k, v)
            updated += 1
        else:
            db.add(PayrollConfig(**item.model_dump()))
            created += 1
    db.commit()
    return {"ok": True, "created": created, "updated": updated}

@router.post("/employees/{id}/issue-account")
def issue_employee_account(id: int, db: Session = Depends(get_db)):
    from app.models.auth import Role, User
    import bcrypt
    
    emp = db.get(Employee, id)
    if not emp: raise HTTPException(404, "Không tìm thấy nhân viên")
    if emp.user_id: raise HTTPException(400, "Nhân viên đã có tài khoản")
    
    # Mật khẩu mặc định: 123456
    hashed = bcrypt.hashpw("123456".encode(), bcrypt.gensalt()).decode()
    
    # Tìm vai trò theo ma trận: Phòng ban + Chức vụ
    role = None
    if emp.bo_phan and emp.chuc_vu:
        role_code = f"{emp.bo_phan.ma_bo_phan}_{emp.chuc_vu.ma_chuc_vu}"
        role = db.query(Role).filter(Role.ma_vai_tro == role_code).first()

    # Nếu không tìm thấy vai trò ma trận, dùng quyền NHAN_VIEN hoặc quyền mặc định
    if not role:
        role = db.query(Role).filter(Role.ma_vai_tro == "NHAN_VIEN").first()
    if not role:
        role = db.query(Role).filter(Role.trang_thai == True).first()
    
    new_user = User(
        username=emp.ma_nv,
        ho_ten=emp.ho_ten,
        password_hash=hashed,
        role_id=role.id if role else 1,
        trang_thai=True
    )
    db.add(new_user)
    db.flush()
    
    emp.user_id = new_user.id
    db.commit()
    return {"status": "success", "username": emp.ma_nv}

@router.post("/employees/{id}/toggle-account-status")
def toggle_account_status(id: int, db: Session = Depends(get_db)):
    from app.models.auth import User
    emp = db.get(Employee, id)
    if not emp or not emp.user_id:
        raise HTTPException(400, "Nhân viên chưa có tài khoản")
    
    user = db.get(User, emp.user_id)
    user.trang_thai = not user.trang_thai
    db.commit()
    return {"status": "success", "new_status": user.trang_thai}
