from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import create_access_token, get_current_user
from app.models.auth import User
from app.schemas.auth import TokenResponse, UserInfo, UserCreate, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == form.username,
        User.trang_thai == True
    ).first()

    if not user or not pwd_context.verify(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng",
        )

    user.lan_dang_nhap_cuoi = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=UserInfo(
            id=user.id,
            username=user.username,
            ho_ten=user.ho_ten,
            email=user.email,
            role=user.role.ma_vai_tro,
            phan_xuong=user.phan_xuong,
        ),
    )


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        ho_ten=current_user.ho_ten,
        email=current_user.email,
        role=current_user.role.ma_vai_tro,
        phan_xuong=current_user.phan_xuong,
    )


@router.post("/change-password")
def change_password(
    old_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not pwd_context.verify(old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không đúng")
    current_user.password_hash = pwd_context.hash(new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}
