from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
import re
import unicodedata
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.auth import User
from app.models.hr import Department, Position, Employee, AttendanceLog, LeaveRequest, PayrollConfig, PayrollHoliday, EmployeeHistory, EmployeeDocument, LaborContract, PayrollRun
from app.services.hr_service import PayrollService
from app.schemas import hr as schemas
from app.utils.log import get_logger
from app.services.excel_import_service import ImportField, build_template_response

logger = get_logger(__name__)

router = APIRouter(prefix="/api/hr", tags=["hr"])

HR_EMPLOYEE_IMPORT_FIELDS = [
    ImportField("ma_nv", "Ma NV", required=True, help_text="Ma nhan vien (duy nhat)"),
    ImportField("ho_ten", "Ho ten", required=True),
    ImportField("ngay_sinh", "Ngay sinh", help_text="DD/MM/YYYY"),
    ImportField("gioi_tinh", "Gioi tinh", help_text="Nam / Nu"),
    ImportField("so_dien_thoai", "So dien thoai"),
    ImportField("email", "Email"),
    ImportField("ngay_vao_lam", "Ngay vao lam", help_text="DD/MM/YYYY"),
    ImportField("ngay_nghi_viec", "Ngay nghi viec", help_text="DD/MM/YYYY, de trong neu con lam"),
    ImportField("trang_thai", "Trang thai", help_text="dang_lam / tam_nghi / da_nghi"),
    ImportField("ten_chuc_vu", "Chuc vu", help_text="Ten chuc vu (lookup theo ten)"),
    ImportField("ten_bo_phan", "Bo phan", help_text="Ten bo phan (lookup theo ten)"),
    ImportField("he_so_ca_nhan", "He so ca nhan", help_text="So thap phan, VD: 1.5"),
]


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

def _normalize_attendance_key(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or "").strip().lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("đ", "d")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")

def _attendance_value(row: dict, *keys: str):
    normalized = {_normalize_attendance_key(k): v for k, v in row.items()}
    for key in keys:
        value = normalized.get(_normalize_attendance_key(key))
        if value not in (None, ""):
            return value
    return None

def _parse_attendance_date(value: object) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    if not text:
        raise ValueError("empty date")
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        pass

    match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", text)
    if match:
        first = int(match.group(1))
        second = int(match.group(2))
        year = int(match.group(3))
        if year < 100:
            year += 2000
        day = first if first > 12 or second <= 12 else second
        month = second if first > 12 or second <= 12 else first
        return date(year, month, day)
    raise ValueError("invalid date")

def _parse_attendance_datetime(value: object, ngay: date) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        pass
    match = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", text)
    if match:
        return datetime(
            ngay.year,
            ngay.month,
            ngay.day,
            int(match.group(1)),
            int(match.group(2)),
            int(match.group(3) or 0),
        )
    return None

def _decimal_value(row: dict, *keys: str) -> Decimal:
    value = _attendance_value(row, *keys)
    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value).replace(",", "."))

def _contract_allowance_total(contract: LaborContract) -> Decimal:
    detailed = sum((
        contract.phu_cap_chuyen_can or Decimal("0"),
        contract.phu_cap_trach_nhiem or Decimal("0"),
        contract.phu_cap_nha_o_com or Decimal("0"),
        contract.phu_cap_dien_thoai or Decimal("0"),
        contract.phu_cap_khac or Decimal("0"),
    ), Decimal("0"))
    legacy = contract.phu_cap or Decimal("0")
    return detailed if detailed > 0 else legacy

# --- Departments ---
@router.get("/departments", response_model=List[schemas.Department])
def list_departments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Department).all()

@router.post("/departments", response_model=schemas.Department)
def create_department(body: schemas.DepartmentCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if db.query(Department).filter(Department.ma_bo_phan == body.ma_bo_phan).first():
        raise HTTPException(400, "Mã bộ phận đã tồn tại")
    db_dept = Department(**body.model_dump())
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    logger.info("created department id=%s ma_bo_phan=%s", db_dept.id, db_dept.ma_bo_phan)
    return db_dept

@router.put("/departments/{id}", response_model=schemas.Department)
def update_department(id: int, body: schemas.DepartmentUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    db_dept = db.get(Department, id)
    if not db_dept:
        logger.warning("department id=%s not found", id)
        raise HTTPException(404, "Khong tim thay bo phan")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(db_dept, k, v)
    db.commit()
    db.refresh(db_dept)
    logger.info("updated department id=%s", id)
    return db_dept

# --- Positions ---
@router.get("/positions", response_model=List[schemas.Position])
def list_positions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Position).all()

@router.post("/positions", response_model=schemas.Position)
def create_position(body: schemas.PositionCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    is_hr_admin = _role_code(current_user) in ("ADMIN", "NHAN_SU")

    # Trưởng phòng Sale chỉ thấy nhân viên trong team sale
    caller_role = _role_code(current_user)
    if caller_role == "TRUONG_PHONG_SALE_ADMIN":
        from app.models.auth import User as AuthUser, Role as AuthRole
        sale_user_ids = (
            db.query(AuthUser.id)
            .join(AuthRole, AuthRole.id == AuthUser.role_id)
            .filter(AuthRole.ma_vai_tro.in_(["SALE_ADMIN", "TRUONG_PHONG_SALE_ADMIN"]))
            .scalar_subquery()
        )
        q = q.filter(Employee.user_id.in_(sale_user_ids))

    employees = q.all()
    result = []
    for e in employees:
        row = {
            "id": e.id,
            "ma_nv": e.ma_nv,
            "ho_ten": e.ho_ten,
            "ngay_sinh": e.ngay_sinh.isoformat() if e.ngay_sinh else None,
            "gioi_tinh": e.gioi_tinh,
            "so_dien_thoai": e.so_dien_thoai,
            "email": e.email,
            "trang_thai": e.trang_thai,
            "ngay_vao_lam": e.ngay_vao_lam.isoformat() if e.ngay_vao_lam else None,
            "ngay_nghi_viec": e.ngay_nghi_viec.isoformat() if e.ngay_nghi_viec else None,
            "phap_nhan_id": e.phap_nhan_id,
            "phan_xuong_id": e.phan_xuong_id,
            "bo_phan_id": e.bo_phan_id,
            "chuc_vu_id": e.chuc_vu_id,
            "ten_bo_phan": e.bo_phan.ten_bo_phan if e.bo_phan else None,
            "ten_chuc_vu": e.chuc_vu.ten_chuc_vu if e.chuc_vu else None,
            "ten_phan_xuong": e.phan_xuong.ten_xuong if e.phan_xuong else None,
            "ten_phap_nhan": e.phap_nhan.ten_phap_nhan if e.phap_nhan else None,
            "has_account": e.user_id is not None,
        }
        # Wage + PII + account: HR/Admin only — salary coeff, CCCD, bank, fingerprint
        if is_hr_admin:
            row["he_so_ca_nhan"] = float(e.he_so_ca_nhan or 0)
            row["cccd"] = e.cccd
            row["ngay_cap"] = e.ngay_cap.isoformat() if e.ngay_cap else None
            row["noi_cap"] = e.noi_cap
            row["dia_chi"] = e.dia_chi
            row["que_quan"] = e.que_quan
            row["so_tk_ngan_hang"] = e.so_tk_ngan_hang
            row["ten_ngan_hang"] = e.ten_ngan_hang
            row["chi_nhanh_ngan_hang"] = e.chi_nhanh_ngan_hang
            row["ma_van_tay"] = e.ma_van_tay
            row["username"] = e.user.username if e.user else None
            row["user_status"] = e.user.trang_thai if e.user else None
        result.append(row)
    return result

@router.get("/employees/import-template")
def employee_import_template(_: User = Depends(get_current_user)):
    """Tải file Excel mẫu để import nhân viên."""
    return build_template_response("mau_import_nhan_vien.xlsx", HR_EMPLOYEE_IMPORT_FIELDS)


@router.get("/employees/{id}")
def get_employee(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(Employee).filter(Employee.id == id).first()
    if not e:
        raise HTTPException(404, "Không tìm thấy nhân viên")
    is_hr_admin = _role_code(current_user) in ("ADMIN", "NHAN_SU")
    row: dict = {
        "id": e.id,
        "ma_nv": e.ma_nv,
        "ho_ten": e.ho_ten,
        "ngay_sinh": e.ngay_sinh.isoformat() if e.ngay_sinh else None,
        "gioi_tinh": e.gioi_tinh,
        "so_dien_thoai": e.so_dien_thoai,
        "email": e.email,
        "trang_thai": e.trang_thai,
        "ngay_vao_lam": e.ngay_vao_lam.isoformat() if e.ngay_vao_lam else None,
        "ngay_nghi_viec": e.ngay_nghi_viec.isoformat() if e.ngay_nghi_viec else None,
        "phap_nhan_id": e.phap_nhan_id,
        "phan_xuong_id": e.phan_xuong_id,
        "bo_phan_id": e.bo_phan_id,
        "chuc_vu_id": e.chuc_vu_id,
        "ten_bo_phan": e.bo_phan.ten_bo_phan if e.bo_phan else None,
        "ten_chuc_vu": e.chuc_vu.ten_chuc_vu if e.chuc_vu else None,
        "ten_phan_xuong": e.phan_xuong.ten_xuong if e.phan_xuong else None,
        "ten_phap_nhan": e.phap_nhan.ten_phap_nhan if e.phap_nhan else None,
        "has_account": e.user_id is not None,
    }
    if is_hr_admin:
        row["he_so_ca_nhan"] = float(e.he_so_ca_nhan or 0)
        row["cccd"] = e.cccd
        row["ngay_cap"] = e.ngay_cap.isoformat() if e.ngay_cap else None
        row["noi_cap"] = e.noi_cap
        row["dia_chi"] = e.dia_chi
        row["que_quan"] = e.que_quan
        row["so_tk_ngan_hang"] = e.so_tk_ngan_hang
        row["ten_ngan_hang"] = e.ten_ngan_hang
        row["chi_nhanh_ngan_hang"] = e.chi_nhanh_ngan_hang
        row["ma_van_tay"] = e.ma_van_tay
        row["username"] = e.user.username if e.user else None
        row["user_status"] = e.user.trang_thai if e.user else None
    return row

@router.post("/employees", response_model=schemas.Employee)
def create_employee(body: schemas.EmployeeCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "NHAN_SU"))):
    if db.query(Employee).filter(Employee.ma_nv == body.ma_nv).first():
        raise HTTPException(400, "Mã nhân viên đã tồn tại")
    db_emp = Employee(**body.model_dump())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    logger.info("created employee id=%s ma_nv=%s", db_emp.id, db_emp.ma_nv)
    return db_emp

@router.post("/employees/bulk")
def bulk_create_employees(body: schemas.EmployeeBulkCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "NHAN_SU"))):
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
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU"))
):
    from app.models.auth import Role, User as AuthUser
    db_emp = db.query(Employee).filter(Employee.id == id).first()
    if not db_emp:
        logger.warning("employee id=%s not found", id)
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
    logger.info("updated employee id=%s", id)
    return db_emp

@router.get("/employees/{id}/history")
def get_employee_history(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "NHAN_SU"))):
    return db.query(EmployeeHistory).filter(EmployeeHistory.employee_id == id).order_by(EmployeeHistory.created_at.desc()).all()

# --- Contracts & Warnings ---
@router.get("/contracts/expiring")
def list_expiring_contracts(days: int = 30, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
def bulk_create_attendance(logs: List[schemas.AttendanceLogCreate], db: Session = Depends(get_db), _: User = Depends(get_current_user)):
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
def import_attendance(rows: List[dict], db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    saved = 0
    errors = []
    for idx, row in enumerate(rows, start=1):
        ma_nv = _attendance_value(row, "ma_nv", "MA_NV", "Mã Nhân Viên", "Ma Nhan Vien", "ma_van_tay")
        ma_nv = str(ma_nv).strip() if ma_nv is not None else None
        emp = db.query(Employee).filter(
            or_(Employee.ma_nv == ma_nv, Employee.ma_van_tay == ma_nv)
        ).first() if ma_nv else None
        if not emp:
            errors.append({"row": idx, "ma_nv": ma_nv, "error": "Khong tim thay ma NV"})
            continue

        ngay_raw = _attendance_value(row, "ngay", "Ngày")
        try:
            ngay = _parse_attendance_date(ngay_raw)
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

        gio_vao = _parse_attendance_datetime(_attendance_value(row, "gio_vao", "Giờ vào", "Gio vao"), ngay)
        gio_ra = _parse_attendance_datetime(_attendance_value(row, "gio_ra", "Giờ ra", "Gio ra"), ngay)
        if gio_vao:
            log.gio_vao = gio_vao
        if gio_ra:
            log.gio_ra = gio_ra

        numeric_fields = {
            "so_cong": ("so_cong", "Công", "Cong"),
            "so_gio_ot": ("so_gio_ot", "Tăng ca", "Tang ca"),
            "tong_gio_thuc": ("tong_gio_thuc", "Tổng giờ", "Tong gio"),
        }
        for field, aliases in numeric_fields.items():
            value = _attendance_value(row, *aliases)
            if value not in (None, ""):
                setattr(log, field, Decimal(str(value).replace(",", ".")))

        log.trang_thai = _attendance_value(row, "trang_thai", "Trạng thái") or log.trang_thai or "hop_le"
        log.ghi_chu = _attendance_value(row, "ghi_chu", "Ghi chú") or log.ghi_chu
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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
def create_leave_request(body: schemas.LeaveRequestCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    db_req = LeaveRequest(**body.model_dump())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

@router.post("/leave-requests/{id}/approve")
def approve_leave_request(
    id: int,
    y_kien: Optional[str] = None,
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "QUAN_DOC")),
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
    req.ngay_duyet = datetime.now(timezone.utc)
    if req.trang_thai == "bgd_duyet":
        _sync_leave_to_attendance(req, db)
    db.commit()
    return {"status": req.trang_thai}

@router.put("/leave-requests/{id}/approve")
def approve_leave_request_body(
    id: int,
    body: schemas.LeaveApprovalRequest,
    current_user: User = Depends(require_roles("ADMIN", "NHAN_SU", "GIAM_DOC", "QUAN_DOC")),
    db: Session = Depends(get_db),
):
    req = db.get(LeaveRequest, id)
    if not req:
        raise HTTPException(404, "Khong tim thay don")
    if body.trang_thai not in {"phong_ban_duyet", "bgd_duyet", "tu_choi", "huy"}:
        raise HTTPException(400, "Trang thai duyet khong hop le")
    req.trang_thai = body.trang_thai
    req.y_kien_duyet = body.y_kien_duyet
    req.ngay_duyet = datetime.now(timezone.utc)
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
def list_payroll_configs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(PayrollConfig).all()

@router.post("/payroll-configs", response_model=schemas.PayrollConfig)
def create_payroll_config(body: schemas.PayrollConfigCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
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
def update_payroll_config(id: int, body: schemas.PayrollConfigCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    db_cfg = db.get(PayrollConfig, id)
    if not db_cfg:
        raise HTTPException(404, "Khong tim thay cau hinh luong")
    for k, v in body.model_dump().items():
        setattr(db_cfg, k, v)
    db.commit()
    db.refresh(db_cfg)
    return db_cfg

@router.post("/payroll-configs/bulk")
def bulk_create_payroll_configs(body: schemas.PayrollConfigBulkCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
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

@router.get("/payroll-holidays", response_model=List[schemas.PayrollHoliday])
def list_payroll_holidays(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PayrollHoliday)
    if from_date:
        q = q.filter(PayrollHoliday.ngay >= from_date)
    if to_date:
        q = q.filter(PayrollHoliday.ngay <= to_date)
    return q.order_by(PayrollHoliday.ngay).all()

@router.post("/payroll-holidays", response_model=schemas.PayrollHoliday)
def create_payroll_holiday(body: schemas.PayrollHolidayCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    holiday = db.query(PayrollHoliday).filter(PayrollHoliday.ngay == body.ngay).first()
    if holiday:
        for k, v in body.model_dump().items():
            setattr(holiday, k, v)
    else:
        holiday = PayrollHoliday(**body.model_dump())
        db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday

@router.delete("/payroll-holidays/{id}")
def delete_payroll_holiday(id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    holiday = db.get(PayrollHoliday, id)
    if not holiday:
        raise HTTPException(404, "Khong tim thay ngay le")
    db.delete(holiday)
    db.commit()
    return {"ok": True}

@router.post("/contracts/import-allowances")
def import_contract_allowances(rows: List[dict], db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    updated = 0
    created = 0
    errors = []
    for idx, row in enumerate(rows, start=1):
        ma_nv = _attendance_value(row, "ma_nv", "Mã NV", "Mã Nhân Viên", "Ma Nhan Vien")
        ma_nv = str(ma_nv).strip() if ma_nv is not None else None
        emp = db.query(Employee).filter(Employee.ma_nv == ma_nv).first() if ma_nv else None
        if not emp:
            errors.append({"row": idx, "ma_nv": ma_nv, "error": "Khong tim thay ma NV"})
            continue

        contract = sorted(emp.contracts, key=lambda x: x.ngay_hieu_luc or x.ngay_ky, reverse=True)
        current = contract[0] if contract else None
        if not current:
            current = LaborContract(
                employee_id=emp.id,
                so_hop_dong=f"AUTO-{emp.ma_nv}",
                loai_hop_dong="khong_thoi_han",
                ngay_ky=date.today(),
                ngay_hieu_luc=emp.ngay_vao_lam or date.today(),
                trang_thai="hieu_luc",
            )
            db.add(current)
            created += 1
        else:
            updated += 1

        base_salary = _attendance_value(row, "luong_co_ban", "Lương cơ bản", "Luong co ban")
        if base_salary not in (None, ""):
            current.luong_co_ban = Decimal(str(base_salary).replace(",", "."))
        current.phu_cap_chuyen_can = _decimal_value(row, "phu_cap_chuyen_can", "Chuyên cần", "Chuyen can")
        current.phu_cap_trach_nhiem = _decimal_value(row, "phu_cap_trach_nhiem", "Trách nhiệm", "Trach nhiem")
        current.phu_cap_nha_o_com = _decimal_value(row, "phu_cap_nha_o_com", "Nhà ở/Cơm", "Nha o/Com")
        current.phu_cap_dien_thoai = _decimal_value(row, "phu_cap_dien_thoai", "Điện thoại", "Dien thoai")
        current.phu_cap_khac = _decimal_value(row, "phu_cap_khac", "Hỗ trợ khác", "Ho tro khac")
        current.phu_cap = _contract_allowance_total(current)

    if errors:
        db.rollback()
        raise HTTPException(400, {"message": "Import phu cap co loi", "errors": errors})
    db.commit()
    return {"ok": True, "created": created, "updated": updated}

@router.post("/employees/{id}/issue-account")
def issue_employee_account(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "NHAN_SU"))):
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
def toggle_account_status(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "NHAN_SU"))):
    from app.models.auth import User
    emp = db.get(Employee, id)
    if not emp or not emp.user_id:
        raise HTTPException(400, "Nhân viên chưa có tài khoản")

    user = db.get(User, emp.user_id)
    user.trang_thai = not user.trang_thai
    db.commit()
    return {"status": "success", "new_status": user.trang_thai}


# --- Payroll History Import ---

HR_PAYROLL_IMPORT_FIELDS = [
    ImportField("ma_nv", "Ma NV", required=True),
    ImportField("thang", "Thang", required=True, help_text="1-12"),
    ImportField("nam", "Nam", required=True, help_text="VD: 2025"),
    ImportField("luong_co_ban", "Luong co ban"),
    ImportField("luong_san_pham", "Luong san pham"),
    ImportField("phu_cap", "Phu cap"),
    ImportField("phu_cap_chuyen_can", "Chuyen can"),
    ImportField("phu_cap_trach_nhiem", "Trach nhiem"),
    ImportField("tong_thu_nhap", "Tong thu nhap"),
    ImportField("thuong", "Thuong"),
    ImportField("bao_hiem", "Bao hiem"),
    ImportField("thue_tncn", "Thue TNCN"),
    ImportField("tam_ung", "Tam ung"),
    ImportField("luong_thuc_nhan", "Luong thuc nhan"),
    ImportField("ghi_chu", "Ghi chu"),
]


@router.get("/payroll/import-history-template")
def payroll_import_template(_: User = Depends(get_current_user)):
    return build_template_response("mau_import_lich_su_luong.xlsx", HR_PAYROLL_IMPORT_FIELDS)


def _parse_money(value: object) -> Decimal:
    """Parse a money value from Excel cell: strip commas, convert to Decimal. Returns 0 if empty."""
    if value is None or str(value).strip() == "":
        return Decimal("0")
    text = str(value).replace(",", "").strip()
    try:
        return Decimal(text)
    except Exception:
        return Decimal("0")


@router.post("/payroll/import-history")
async def import_payroll_history(
    file: UploadFile = File(...),
    commit: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Import lich su luong (PayrollRun) tu file Excel.
    Upsert theo khoa (employee_id, thang, nam).
    Tra ve: {"created": N, "updated": N, "errors": [...]}
    """
    from io import BytesIO
    from openpyxl import load_workbook

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Chi chap nhan file Excel .xlsx/.xls")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File rong")

    try:
        wb = load_workbook(filename=BytesIO(raw), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Khong doc duoc file Excel: {exc}")

    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)

    # Build header map from first row
    try:
        header_row = next(rows_iter)
    except StopIteration:
        raise HTTPException(status_code=400, detail="File khong co du lieu")

    # Normalize header labels to field names using HR_PAYROLL_IMPORT_FIELDS
    label_to_field: dict[str, str] = {
        field.label.strip().lower(): field.name
        for field in HR_PAYROLL_IMPORT_FIELDS
    }
    col_index: dict[str, int] = {}  # field_name -> column index
    for col_i, header_val in enumerate(header_row):
        if header_val is None:
            continue
        normalized = str(header_val).strip().lower()
        field_name = label_to_field.get(normalized)
        if field_name:
            col_index[field_name] = col_i

    # Validate required columns present
    required_fields = [f.name for f in HR_PAYROLL_IMPORT_FIELDS if f.required]
    missing_cols = [f for f in required_fields if f not in col_index]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Thieu cot bat buoc: {', '.join(missing_cols)}"
        )

    created_count = 0
    updated_count = 0
    errors: list[dict] = []

    # Collect valid rows to process (upsert) — only if no row-level errors when commit=True
    pending: list[tuple[object | None, dict]] = []  # (existing_obj_or_None, values_dict)

    for row_i, row in enumerate(rows_iter, start=2):
        # Skip completely blank rows
        if all(v is None or str(v).strip() == "" for v in row):
            continue

        def _cell(field_name: str):
            idx = col_index.get(field_name)
            if idx is None:
                return None
            return row[idx] if idx < len(row) else None

        ma_nv_raw = _cell("ma_nv")
        ma_nv = str(ma_nv_raw).strip() if ma_nv_raw is not None else None

        # Parse thang / nam
        try:
            thang_val = _cell("thang")
            thang = int(float(str(thang_val).replace(",", "").strip()))
            if not 1 <= thang <= 12:
                raise ValueError("Thang phai tu 1 den 12")
        except Exception as exc:
            errors.append({"row": row_i, "ma_nv": ma_nv, "error": f"Thang khong hop le: {exc}"})
            continue

        try:
            nam_val = _cell("nam")
            nam = int(float(str(nam_val).replace(",", "").strip()))
        except Exception as exc:
            errors.append({"row": row_i, "ma_nv": ma_nv, "error": f"Nam khong hop le: {exc}"})
            continue

        # Lookup employee
        if not ma_nv:
            errors.append({"row": row_i, "ma_nv": None, "error": "Ma NV trong"})
            continue

        emp = db.query(Employee).filter(Employee.ma_nv == ma_nv).first()
        if not emp:
            errors.append({"row": row_i, "ma_nv": ma_nv, "error": f"Khong tim thay NV ma_nv={ma_nv!r}"})
            continue

        # Build values dict for money fields
        money_map = {
            "luong_co_ban": "luong_co_ban",
            "luong_san_pham": "luong_san_pham",
            "phu_cap": "phu_cap",
            "phu_cap_chuyen_can": "phu_cap_chuyen_can",
            "phu_cap_trach_nhiem": "phu_cap_trach_nhiem",
            "tong_thu_nhap": "tong_thu_nhap",
            "thuong": "thuong",
            "bao_hiem": "bao_hiem",
            "thue_tncn": "thue_tncn",
            "tam_ung": "tam_ung",
            # "luong_thuc_nhan" in Excel maps to "thuc_linh" in model
            "luong_thuc_nhan": "thuc_linh",
        }

        values: dict = {
            "employee_id": emp.id,
            "thang": thang,
            "nam": nam,
        }
        for excel_field, model_field in money_map.items():
            values[model_field] = _parse_money(_cell(excel_field))

        ghi_chu_val = _cell("ghi_chu")
        if ghi_chu_val is not None and str(ghi_chu_val).strip():
            values["ghi_chu_import"] = str(ghi_chu_val).strip()

        # Upsert lookup
        existing = db.query(PayrollRun).filter(
            PayrollRun.employee_id == emp.id,
            PayrollRun.thang == thang,
            PayrollRun.nam == nam,
        ).first()

        pending.append((existing, values))
        if existing:
            updated_count += 1
        else:
            created_count += 1

    wb.close()

    if commit:
        for existing_obj, vals in pending:
            if existing_obj:
                for field, value in vals.items():
                    if hasattr(existing_obj, field):
                        setattr(existing_obj, field, value)
            else:
                # Only set fields that exist on the model
                safe_vals = {k: v for k, v in vals.items() if hasattr(PayrollRun, k)}
                db.add(PayrollRun(**safe_vals))
        db.commit()

    return {
        "created": created_count,
        "updated": updated_count,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# Import nhân viên bulk từ Excel
# ---------------------------------------------------------------------------

@router.post("/employees/import")
async def import_employees(
    commit: bool = Query(default=True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "NHAN_SU")),
):
    """
    Import nhân viên bulk từ file Excel (.xlsx/.xls).
    Upsert theo ma_nv: tồn tại → update, chưa có → create.
    Lookup Position theo ten_chuc_vu (ilike), Department theo ten_bo_phan (ilike).
    Trả về: {"created": N, "updated": N, "errors": [{"row": i, "error": "..."}]}
    """
    from io import BytesIO
    from datetime import datetime as _dt
    from decimal import Decimal as _Decimal, InvalidOperation
    from openpyxl import load_workbook

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Chi chap nhan file Excel .xlsx/.xls")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File rong")

    try:
        wb = load_workbook(BytesIO(raw), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Khong doc duoc file Excel: {exc}") from exc

    ws = wb.active
    rows_iter = iter(ws.rows)

    # Đọc header row — map label → field name
    try:
        header_cells = next(rows_iter)
    except StopIteration:
        raise HTTPException(status_code=400, detail="File khong co du lieu")

    label_to_field: dict[str, str] = {
        f.label.strip().lower(): f.name for f in HR_EMPLOYEE_IMPORT_FIELDS
    }

    col_index: dict[str, int] = {}  # field_name → column index (0-based)
    for idx, cell in enumerate(header_cells):
        raw_label = str(cell.value or "").strip().lower()
        if raw_label in label_to_field:
            col_index[label_to_field[raw_label]] = idx

    missing = [f.label for f in HR_EMPLOYEE_IMPORT_FIELDS if f.required and f.name not in col_index]
    if missing:
        raise HTTPException(status_code=400, detail=f"Thieu cot bat buoc: {', '.join(missing)}")

    def _cell_val(row_cells, field_name: str):
        idx = col_index.get(field_name)
        if idx is None or idx >= len(row_cells):
            return None
        return row_cells[idx].value

    def _parse_date_val(value) -> date | None:
        if value is None:
            return None
        if isinstance(value, _dt):
            return value.date()
        if isinstance(value, date):
            return value
        text = str(value).strip()
        if not text:
            return None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
            try:
                return _dt.strptime(text, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Khong nhan dang duoc ngay: {text!r}")

    def _parse_decimal_val(value) -> _Decimal | None:
        if value is None:
            return None
        text = str(value).replace(",", ".").strip()
        if not text:
            return None
        try:
            return _Decimal(text)
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("Phai la so thap phan") from exc

    def _parse_text_val(value) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    # Caches để tránh query lặp trong cùng file
    position_cache: dict[str, int | None] = {}
    department_cache: dict[str, int | None] = {}

    n_created = 0
    n_updated = 0
    errors: list[dict] = []
    objects_to_save: list[tuple] = []  # (existing | None, values_dict)

    for row_idx, row_cells in enumerate(rows_iter, start=2):
        # Bỏ qua dòng trắng
        if all(c.value is None or str(c.value).strip() == "" for c in row_cells):
            continue

        row_errors: list[str] = []
        values: dict = {}

        # ma_nv (bắt buộc)
        ma_nv = _parse_text_val(_cell_val(row_cells, "ma_nv"))
        if not ma_nv:
            row_errors.append("Ma NV: bat buoc")
        else:
            values["ma_nv"] = ma_nv

        # ho_ten (bắt buộc)
        ho_ten = _parse_text_val(_cell_val(row_cells, "ho_ten"))
        if not ho_ten:
            row_errors.append("Ho ten: bat buoc")
        else:
            values["ho_ten"] = ho_ten

        # ngay_sinh
        try:
            v = _parse_date_val(_cell_val(row_cells, "ngay_sinh"))
            if v is not None:
                values["ngay_sinh"] = v
        except ValueError as exc:
            row_errors.append(f"Ngay sinh: {exc}")

        # gioi_tinh
        v = _parse_text_val(_cell_val(row_cells, "gioi_tinh"))
        if v is not None:
            values["gioi_tinh"] = v

        # so_dien_thoai
        v = _parse_text_val(_cell_val(row_cells, "so_dien_thoai"))
        if v is not None:
            values["so_dien_thoai"] = v

        # email
        v = _parse_text_val(_cell_val(row_cells, "email"))
        if v is not None:
            values["email"] = v

        # ngay_vao_lam
        try:
            v = _parse_date_val(_cell_val(row_cells, "ngay_vao_lam"))
            if v is not None:
                values["ngay_vao_lam"] = v
        except ValueError as exc:
            row_errors.append(f"Ngay vao lam: {exc}")

        # ngay_nghi_viec
        try:
            v = _parse_date_val(_cell_val(row_cells, "ngay_nghi_viec"))
            if v is not None:
                values["ngay_nghi_viec"] = v
        except ValueError as exc:
            row_errors.append(f"Ngay nghi viec: {exc}")

        # trang_thai
        v = _parse_text_val(_cell_val(row_cells, "trang_thai"))
        if v is not None:
            valid_statuses = {"dang_lam", "tam_nghi", "da_nghi"}
            if v not in valid_statuses:
                row_errors.append(
                    f"Trang thai: phai la {'/'.join(sorted(valid_statuses))}, nhan duoc '{v}'"
                )
            else:
                values["trang_thai"] = v

        # ten_chuc_vu → chuc_vu_id (lookup ilike)
        ten_chuc_vu = _parse_text_val(_cell_val(row_cells, "ten_chuc_vu"))
        if ten_chuc_vu:
            cache_key = ten_chuc_vu.lower()
            if cache_key not in position_cache:
                pos = db.query(Position).filter(
                    Position.ten_chuc_vu.ilike(ten_chuc_vu)
                ).first()
                position_cache[cache_key] = pos.id if pos else None
            chuc_vu_id = position_cache[cache_key]
            if chuc_vu_id is None:
                row_errors.append(f"Chuc vu '{ten_chuc_vu}': khong tim thay trong he thong")
            else:
                values["chuc_vu_id"] = chuc_vu_id

        # ten_bo_phan → bo_phan_id (lookup ilike)
        ten_bo_phan = _parse_text_val(_cell_val(row_cells, "ten_bo_phan"))
        if ten_bo_phan:
            cache_key = ten_bo_phan.lower()
            if cache_key not in department_cache:
                dept = db.query(Department).filter(
                    Department.ten_bo_phan.ilike(ten_bo_phan)
                ).first()
                department_cache[cache_key] = dept.id if dept else None
            bo_phan_id = department_cache[cache_key]
            if bo_phan_id is None:
                row_errors.append(f"Bo phan '{ten_bo_phan}': khong tim thay trong he thong")
            else:
                values["bo_phan_id"] = bo_phan_id

        # he_so_ca_nhan
        try:
            v = _parse_decimal_val(_cell_val(row_cells, "he_so_ca_nhan"))
            if v is not None:
                values["he_so_ca_nhan"] = v
        except ValueError as exc:
            row_errors.append(f"He so ca nhan: {exc}")

        if row_errors:
            errors.append({"row": row_idx, "error": "; ".join(row_errors)})
            continue

        # Upsert theo ma_nv
        existing = db.query(Employee).filter(
            Employee.ma_nv == values.get("ma_nv")
        ).first()

        if existing:
            objects_to_save.append((existing, values))
            n_updated += 1
        else:
            objects_to_save.append((None, values))
            n_created += 1

    wb.close()

    if commit:
        for existing_emp, vals in objects_to_save:
            if existing_emp:
                for field_name, field_val in vals.items():
                    setattr(existing_emp, field_name, field_val)
            else:
                db.add(Employee(**vals))
        db.commit()

    return {"created": n_created, "updated": n_updated, "errors": errors}
