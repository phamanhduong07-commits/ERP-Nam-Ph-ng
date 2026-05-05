from datetime import datetime
import bcrypt as _bcrypt
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.deps import create_access_token, create_refresh_token, get_current_user, ALGORITHM
from app.models.auth import User
from app.schemas.auth import ChangePasswordRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def _make_user_info(user: User) -> UserInfo:
    return UserInfo(
        id=user.id,
        username=user.username,
        ho_ten=user.ho_ten,
        email=user.email,
        role=user.role.ma_vai_tro,
        phan_xuong=user.phan_xuong,
    )


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == form.username,
        User.trang_thai == True
    ).first()

    if not user or not _verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng",
        )

    user.lan_dang_nhap_cuoi = datetime.utcnow()
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


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không đúng")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
    current_user.password_hash = _hash_password(data.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}
