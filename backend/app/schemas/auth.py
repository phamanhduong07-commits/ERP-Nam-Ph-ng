from datetime import datetime
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserInfo"


class UserInfo(BaseModel):
    id: int
    username: str
    ho_ten: str
    email: str | None
    role: str
    phan_xuong: str | None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    ho_ten: str
    email: EmailStr | None = None
    so_dien_thoai: str | None = None
    password: str
    role_id: int
    phan_xuong: str | None = None


class UserUpdate(BaseModel):
    ho_ten: str | None = None
    email: EmailStr | None = None
    so_dien_thoai: str | None = None
    role_id: int | None = None
    phan_xuong: str | None = None
    trang_thai: bool | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    ho_ten: str
    email: str | None
    so_dien_thoai: str | None
    role_id: int
    phan_xuong: str | None
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True
