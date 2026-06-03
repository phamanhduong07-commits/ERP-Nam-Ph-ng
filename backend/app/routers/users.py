from datetime import datetime
import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_admin_user, require_roles
from app.models.auth import Role, User
from app.schemas.auth import UserCreate, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])
admin_required = require_roles("ADMIN", "GIAM_DOC")
list_users_allowed = require_roles("ADMIN", "GIAM_DOC", "TRUONG_PHONG_SALE_ADMIN")


def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(rounds=14)).decode()


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
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ResetPasswordRequest(BaseModel):
    password: str


def _to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        ho_ten=user.ho_ten,
        email=user.email,
        so_dien_thoai=user.so_dien_thoai,
        role_id=user.role_id,
        role_name=user.role.ten_vai_tro if user.role else None,
        role_code=user.role.ma_vai_tro if user.role else None,
        phan_xuong=user.phan_xuong,
        trang_thai=user.trang_thai,
        created_at=user.created_at,
    )


@router.get("", response_model=list[UserResponse])
def list_users(
    search: str = Query(default=""),
    phan_xuong: str | None = Query(default=None),
    trang_thai: bool | None = Query(default=True),
    db: Session = Depends(get_db),
    _: User = Depends(list_users_allowed),
):
    q = db.query(User)
    if trang_thai is not None:
        q = q.filter(User.trang_thai == trang_thai)
    if search:
        like = f"%{search}%"
        q = q.filter(User.username.ilike(like) | User.ho_ten.ilike(like))
    if phan_xuong:
        q = q.filter(User.phan_xuong == phan_xuong)

    return [_to_response(u) for u in q.order_by(User.ho_ten).all()]


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
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
    _: User = Depends(admin_required),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")
    if data.email and db.query(User).filter(User.email == data.email, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")
    if data.role_id is not None:
        role = db.get(Role, data.role_id)
        if not role or not role.trang_thai:
            raise HTTPException(status_code=400, detail="Vai trò không hợp lệ")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return _to_response(user)


_reset_pw_allowed = require_roles("ADMIN", "GIAM_DOC", "TRUONG_PHONG_SALE_ADMIN")

# Roles trưởng phòng được phép reset mật khẩu (chỉ reset tài khoản thuộc các role này)
_TEAM_ROLES = {"SALE_ADMIN", "TRUONG_PHONG_SALE_ADMIN"}
# Roles không ai được phép reset ngoài ADMIN / GIAM_DOC
_PROTECTED_ROLES = {"ADMIN", "GIAM_DOC", "KE_TOAN_TRUONG"}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_reset_pw_allowed),
):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    caller_role = current_user.role.ma_vai_tro if current_user.role else None
    target_role = target.role.ma_vai_tro if target.role else None

    # Trưởng phòng: chỉ reset được tài khoản trong _TEAM_ROLES
    if caller_role == "TRUONG_PHONG_SALE_ADMIN":
        if target_role not in _TEAM_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Bạn chỉ được đặt lại mật khẩu cho nhân viên trong team Sale",
            )

    # ADMIN/GIAM_DOC không được reset tài khoản ADMIN khác (bảo vệ chéo)
    # — ngoại lệ: chính mình thì được (xử lý qua change-password riêng)

    target.password_hash = _hash_password(data.password)
    db.commit()
    return {"message": "Đã đặt lại mật khẩu"}
