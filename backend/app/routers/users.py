from datetime import datetime
import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, get_admin_user, require_roles
from app.models.auth import Role, User
from app.models.hr import Employee
from app.schemas.auth import UserCreate, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])

# Manager role → roles they can see/manage (including themselves)
DEPARTMENT_MAP: dict[str, set[str]] = {
    "TRUONG_PHONG_SALE_ADMIN": {"TRUONG_PHONG_SALE_ADMIN", "SALE_ADMIN"},
    "KINH_DOANH_TO_TRUONG":    {"KINH_DOANH_TO_TRUONG",    "KINH_DOANH_NHAN_VIEN"},
    "KE_TOAN_TRUONG":          {"KE_TOAN_TRUONG",           "KE_TOAN_CONG_NO", "KETOAN_NHAN_VIEN"},
    "NHAN_SU_TO_TRUONG":       {"NHAN_SU_TO_TRUONG",        "NHAN_SU_NHAN_VIEN"},
    "KHO_TO_TRUONG":           {"KHO_TO_TRUONG",            "KHO_NHAN_VIEN"},
    "THIET_KE_TO_TRUONG":      {"THIET_KE_TO_TRUONG",       "THIET_KE_NHAN_VIEN"},
    "BGD_TO_TRUONG":           {"BGD_TO_TRUONG",            "BGD_NHAN_VIEN"},
    "SAN_XUAT_GIAM_SAT":       {"SAN_XUAT_GIAM_SAT",        "SAN_XUAT_TO_TRUONG", "SAN_XUAT_THO"},
}

_FULL_ACCESS = {"ADMIN", "BGD_GIAM_DOC"}
_ALL_MANAGERS = list(DEPARTMENT_MAP.keys())
_users_access = require_roles("ADMIN", "BGD_GIAM_DOC", *_ALL_MANAGERS)


def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(rounds=14)).decode()


def _team_roles_for(caller: User) -> set[str] | None:
    """None = unrestricted (ADMIN/GIAM_DOC). set = scoped to department."""
    code = caller.role.ma_vai_tro if caller.role else ""
    if code in _FULL_ACCESS:
        return None
    return DEPARTMENT_MAP.get(code, set())


def _assert_target_in_team(target: User, team: set[str]) -> None:
    code = target.role.ma_vai_tro if target.role else ""
    if code not in team:
        raise HTTPException(status_code=403, detail="Tài khoản này không thuộc phòng bạn quản lý")


def _assert_role_in_team(role_code: str, team: set[str]) -> None:
    if role_code not in team:
        raise HTTPException(status_code=403, detail="Vai trò này không thuộc phòng bạn quản lý")


class UserResponse(BaseModel):
    id: int
    username: str
    ho_ten: str
    email: str | None = None
    so_dien_thoai: str | None = None
    role_id: int
    role_name: str | None = None
    role_code: str | None = None
    phan_xuong: str | None = None
    phan_xuong_id: int | None = None
    ten_phan_xuong: str | None = None
    phap_nhan_id: int | None = None
    ten_phap_nhan: str | None = None
    machine_id: int | None = None
    ten_may: str | None = None
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ResetPasswordRequest(BaseModel):
    password: str


def _to_response(user: User, emp: Employee | None = None) -> UserResponse:
    # Prefer employee directory data over user account data when available
    ho_ten = emp.ho_ten if emp and emp.ho_ten else user.ho_ten
    ten_phap_nhan = (
        user.phap_nhan.ten_phap_nhan if user.phap_nhan
        else (emp.phap_nhan.ten_phap_nhan if emp and emp.phap_nhan else None)
    )
    ten_phan_xuong = (
        user.phan_xuong_obj.ten_xuong if user.phan_xuong_obj
        else (emp.phan_xuong.ten_xuong if emp and emp.phan_xuong else None)
    )
    return UserResponse(
        id=user.id,
        username=user.username,
        ho_ten=ho_ten,
        email=user.email or (emp.email if emp else None),
        so_dien_thoai=user.so_dien_thoai or (emp.so_dien_thoai if emp else None),
        role_id=user.role_id,
        role_name=user.role.ten_vai_tro if user.role else None,
        role_code=user.role.ma_vai_tro if user.role else None,
        phan_xuong=user.phan_xuong,
        phan_xuong_id=user.phan_xuong_id or (emp.phan_xuong_id if emp else None),
        ten_phan_xuong=ten_phan_xuong,
        phap_nhan_id=user.phap_nhan_id or (emp.phap_nhan_id if emp else None),
        ten_phap_nhan=ten_phap_nhan,
        machine_id=user.machine_id,
        trang_thai=user.trang_thai,
        created_at=user.created_at,
    )


class UserDropdownItem(BaseModel):
    id: int
    ho_ten: str
    username: str

    class Config:
        from_attributes = True


@router.get("/dropdown", response_model=list[UserDropdownItem])
def list_users_dropdown(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách user tối giản {id, ho_ten, username} — dùng cho filter/dropdown, không cần quyền manager."""
    rows = (
        db.query(User.id, User.ho_ten, User.username)
        .filter(User.trang_thai == True)
        .order_by(User.ho_ten)
        .all()
    )
    return [{"id": r.id, "ho_ten": r.ho_ten, "username": r.username} for r in rows]


@router.get("", response_model=list[UserResponse])
def list_users(
    search: str = Query(default=""),
    phan_xuong: str | None = Query(default=None),
    trang_thai: bool | None = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(_users_access),
):
    q = db.query(User).options(selectinload(User.role), selectinload(User.phap_nhan), selectinload(User.phan_xuong_obj))
    if trang_thai is not None:
        q = q.filter(User.trang_thai == trang_thai)
    if search:
        like = f"%{search}%"
        q = q.filter(User.username.ilike(like) | User.ho_ten.ilike(like))
    if phan_xuong:
        q = q.filter(User.phan_xuong == phan_xuong)

    team = _team_roles_for(current_user)
    if team is not None:
        allowed_ids = [r.id for r in db.query(Role.id).filter(Role.ma_vai_tro.in_(team)).all()]
        q = q.filter(User.role_id.in_(allowed_ids))

    users = q.order_by(User.ho_ten).all()

    # Batch load employee records to fill missing user fields (email, sdt, phap_nhan, phan_xuong)
    user_ids = [u.id for u in users]
    emp_map: dict[int, Employee] = {}
    if user_ids:
        emps = (
            db.query(Employee)
            .options(selectinload(Employee.phap_nhan), selectinload(Employee.phan_xuong))
            .filter(Employee.user_id.in_(user_ids))
            .all()
        )
        emp_map = {e.user_id: e for e in emps if e.user_id}

    return [_to_response(u, emp_map.get(u.id)) for u in users]


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_users_access),
):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username đã tồn tại")
    if data.email and db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    role = db.get(Role, data.role_id)
    if not role or not role.trang_thai:
        raise HTTPException(status_code=400, detail="Vai trò không hợp lệ")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")

    team = _team_roles_for(current_user)
    if team is not None:
        _assert_role_in_team(role.ma_vai_tro, team)

    user = User(
        username=data.username,
        ho_ten=data.ho_ten,
        email=data.email,
        so_dien_thoai=data.so_dien_thoai,
        password_hash=_hash_password(data.password),
        role_id=data.role_id,
        phan_xuong=data.phan_xuong,
        trang_thai=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_response(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_users_access),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    if data.email and db.query(User).filter(User.email == data.email, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    team = _team_roles_for(current_user)
    if team is not None:
        _assert_target_in_team(user, team)

    if data.role_id is not None:
        role = db.get(Role, data.role_id)
        if not role or not role.trang_thai:
            raise HTTPException(status_code=400, detail="Vai trò không hợp lệ")
        if team is not None:
            _assert_role_in_team(role.ma_vai_tro, team)

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return _to_response(user)


@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_users_access),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể vô hiệu hóa tài khoản của chính mình")

    team = _team_roles_for(current_user)
    if team is not None:
        _assert_target_in_team(user, team)

    user.trang_thai = False
    db.commit()


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_users_access),
):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    team = _team_roles_for(current_user)
    if team is not None:
        _assert_target_in_team(target, team)

    target.password_hash = _hash_password(data.password)
    db.commit()
    return {"message": "Đã đặt lại mật khẩu"}
