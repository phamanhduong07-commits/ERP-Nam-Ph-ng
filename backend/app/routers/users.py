from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User, Role

router = APIRouter(prefix="/api/users", tags=["users"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    username: str
    ho_ten: str
    email: str | None = None
    so_dien_thoai: str | None = None
    phan_xuong: str | None = None
    trang_thai: bool
    created_at: datetime
    role_name: str | None = None

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[UserResponse])
def list_users(
    search: str = Query(default=""),
    phan_xuong: str | None = Query(default=None),
    trang_thai: bool = Query(default=True),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(User).filter(User.trang_thai == trang_thai)
    if search:
        like = f"%{search}%"
        q = q.filter(
            User.username.ilike(like)
            | User.ho_ten.ilike(like)
        )
    if phan_xuong:
        q = q.filter(User.phan_xuong == phan_xuong)

    users = q.order_by(User.ho_ten).all()
    result = []
    for u in users:
        role_name = u.role.ten_vai_tro if u.role else None
        r = UserResponse(
            id=u.id,
            username=u.username,
            ho_ten=u.ho_ten,
            email=u.email,
            so_dien_thoai=u.so_dien_thoai,
            phan_xuong=u.phan_xuong,
            trang_thai=u.trang_thai,
            created_at=u.created_at,
            role_name=role_name,
        )
        result.append(r)
    return result
