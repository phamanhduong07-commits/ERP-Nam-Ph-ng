from datetime import datetime, timezone
import bcrypt as _bcrypt
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.deps import create_access_token, create_refresh_token, get_current_user, revoke_token, oauth2_scheme, ALGORITHM
from app.limiter import limiter
from app.models.auth import User
from app.schemas.auth import ChangePasswordRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def _validate_password_strength(pw: str) -> None:
    """Bắt buộc: tối thiểu 8 ký tự + có ít nhất 1 chữ + 1 số (theo NIST 800-63B + thực tế VN).

    Cho phép ký tự bất kỳ (Unicode, ký tự đặc biệt) — không bắt buộc viết hoa/đặc biệt
    để tránh khó dùng cho NV phổ thông.
    """
    if not pw or len(pw) < 8:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 8 ký tự")
    has_letter = any(c.isalpha() for c in pw)
    has_digit = any(c.isdigit() for c in pw)
    if not (has_letter and has_digit):
        raise HTTPException(
            status_code=400,
            detail="Mật khẩu phải có cả chữ và số (vd: 'matkhau2026')",
        )
    # Chặn common weak passwords
    weak = {"12345678", "abcdefgh", "password", "matkhau1", "qwertyui", "11111111"}
    if pw.lower() in weak:
        raise HTTPException(status_code=400, detail="Mật khẩu quá phổ biến, vui lòng chọn mật khẩu khác")


def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(rounds=14)).decode()


def _get_user_permissions(user: User) -> tuple[list[str], dict[str, list[int]]]:
    """Merge role permissions + user-level overrides.

    Returns:
        (permissions, allowed_nv_ids)
        - permissions: quyền toàn cục (role + user-level không có target)
        - allowed_nv_ids: {"report.xnt_all_nv": [3, 7], ...} — user-level có target_user_id
    """
    perms: set[str] = set()
    allowed_nv_ids: dict[str, list[int]] = {}

    if user.role and hasattr(user.role, 'role_permissions'):
        perms.update(rp.permission.ma_quyen for rp in user.role.role_permissions)

    if hasattr(user, 'user_permissions'):
        for up in user.user_permissions:
            ma_quyen = up.permission.ma_quyen
            if up.target_user_id is None:
                perms.add(ma_quyen)
            else:
                allowed_nv_ids.setdefault(ma_quyen, [])
                if up.target_user_id not in allowed_nv_ids[ma_quyen]:
                    allowed_nv_ids[ma_quyen].append(up.target_user_id)

    return sorted(perms), allowed_nv_ids


def _make_user_info(user: User) -> UserInfo:
    permissions, allowed_nv_ids = _get_user_permissions(user)
    return UserInfo(
        id=user.id,
        username=user.username,
        ho_ten=user.ho_ten,
        email=user.email,
        role=user.role.ma_vai_tro,
        phan_xuong=user.phan_xuong,
        machine_id=user.machine_id,
        phap_nhan_id=user.phap_nhan_id,
        permissions=permissions,
        allowed_nv_ids=allowed_nv_ids,
        must_change_password=getattr(user, 'must_change_password', False),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == form.username,
        User.trang_thai == True
    ).first()

    if not user or not _verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng",
        )

    user.lan_dang_nhap_cuoi = datetime.now(timezone.utc)
    db.commit()

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=_make_user_info(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(refresh_token: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """Dùng refresh_token để lấy access_token mới mà không cần đăng nhập lại."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token không hợp lệ hoặc đã hết hạn",
    )
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.trang_thai == True).first()
    if user is None:
        raise credentials_exception

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=_make_user_info(user),
    )


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    return _make_user_info(current_user)


@router.post("/logout")
def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
):
    """Revoke current access token immediately."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        if jti:
            revoke_token(jti)
    except JWTError:
        pass
    return {"message": "Đăng xuất thành công"}


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không đúng")
    _validate_password_strength(data.new_password)
    if data.new_password == data.old_password:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải khác mật khẩu cũ")
    current_user.password_hash = _hash_password(data.new_password)
    # Clear flag must_change_password sau khi NV đổi xong
    if getattr(current_user, 'must_change_password', False):
        current_user.must_change_password = False
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}
