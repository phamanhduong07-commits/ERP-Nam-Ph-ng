from datetime import datetime
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


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


# ====================================================
# PERMISSION SCHEMAS
# ====================================================

class PermissionBase(BaseModel):
    ma_quyen: str
    ten_quyen: str
    mo_ta: str | None = None
    nhom: str | None = None


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    ten_quyen: str | None = None
    mo_ta: str | None = None
    nhom: str | None = None
    trang_thai: bool | None = None


class PermissionResponse(PermissionBase):
    id: int
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ====================================================
# ROLE SCHEMAS
# ====================================================

class RolePermissionResponse(BaseModel):
    id: int
    permission: PermissionResponse

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    ma_vai_tro: str
    ten_vai_tro: str
    mo_ta: str | None = None


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    ten_vai_tro: str | None = None
    mo_ta: str | None = None
    trang_thai: bool | None = None


class RoleResponse(RoleBase):
    id: int
    trang_thai: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RoleDetailResponse(RoleResponse):
    role_permissions: list[RolePermissionResponse]


class RolePermissionAssignRequest(BaseModel):
    permission_ids: list[int]


# ====================================================
# PAGE RESPONSE
# ====================================================

class PagedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
