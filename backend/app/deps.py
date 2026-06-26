import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.auth import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM = "HS256"

# In-memory JTI blacklist — cleared on restart (acceptable: access tokens expire in 60 min)
_revoked_jtis: set[str] = set()


def revoke_token(jti: str) -> None:
    _revoked_jtis.add(jti)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload["type"] = "access"
    payload["jti"] = str(uuid.uuid4())
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload["type"] = "refresh"
    payload["jti"] = str(uuid.uuid4())
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        # Chỉ chấp nhận access token, không nhận refresh token
        if payload.get("type") == "refresh":
            raise credentials_exception
        jti = payload.get("jti")
        if jti and jti in _revoked_jtis:
            raise credentials_exception
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except JWTError:
        raise credentials_exception

    from sqlalchemy.orm import selectinload, joinedload
    from app.models.auth import UserPermission, Permission as _Perm, RolePermission, Role
    user = (
        db.query(User)
        .options(
            joinedload(User.role).selectinload(Role.role_permissions).joinedload(RolePermission.permission),
            selectinload(User.user_permissions).joinedload(UserPermission.permission),
        )
        .filter(User.id == user_id, User.trang_thai == True)
        .first()
    )
    if user is None:
        raise credentials_exception
    return user


from fastapi.security import OAuth2PasswordBearer as _OAB2
from typing import Optional as _Opt

_optional_scheme = _OAB2(tokenUrl="/api/auth/login", auto_error=False)


def get_optional_user(
    token: _Opt[str] = Depends(_optional_scheme),
    db: Session = Depends(get_db),
) -> _Opt[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "refresh":
            return None
        sub = payload.get("sub")
        if sub is None:
            return None
        return db.query(User).filter(User.id == int(sub), User.trang_thai == True).first()
    except JWTError:
        return None


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện thao tác này",
        )
    return current_user


def require_roles(*allowed_roles: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        role_code = current_user.role.ma_vai_tro if current_user.role else None
        if role_code != "ADMIN" and role_code not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện thao tác này",
            )
        return current_user
    return checker


def _owned_permissions(user: User, db: Session) -> set[str]:
    """Return all ma_quyen the user has (role-level + user-level overrides)."""
    from app.models.auth import RolePermission, Permission, Role, UserPermission
    role_perms = {r[0] for r in db.query(Permission.ma_quyen).join(RolePermission).join(Role).join(User).filter(User.id == user.id).all()}
    user_perms = {r[0] for r in db.query(Permission.ma_quyen).join(UserPermission, UserPermission.permission_id == Permission.id).filter(UserPermission.user_id == user.id).all()}
    return role_perms | user_perms


def assert_has_permission(permission: str, user: User, db: Session) -> None:
    """Raise 403 if user doesn't have the given permission."""
    role_code = user.role.ma_vai_tro if user.role else None
    if role_code == "ADMIN":
        return
    if permission not in _owned_permissions(user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Bạn thiếu quyền: {permission}")


def require_permissions(*permissions: str):
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        role_code = current_user.role.ma_vai_tro if current_user.role else None
        if role_code == "ADMIN":
            return current_user
        owned = _owned_permissions(current_user, db)
        for p in permissions:
            if p not in owned:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Bạn thiếu quyền: {p}")
        return current_user
    return checker


def require_any_permission(*permissions: str):
    """Grant access if user has ANY ONE of the listed permissions (OR logic)."""
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        role_code = current_user.role.ma_vai_tro if current_user.role else None
        if role_code == "ADMIN":
            return current_user
        owned = _owned_permissions(current_user, db)
        if any(p in owned for p in permissions):
            return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền truy cập")
    return checker


# ── Sale-staff customer scoping ───────────────────────────────────────────────
# Roles that default to seeing only their own customers.
# Override: grant 'sales.view_all_customers' permission (no target_user_id) → full access.
SALE_STAFF_ROLES: frozenset[str] = frozenset({
    "SALE_ADMIN",
    "KINH_DOANH_NHAN_VIEN",
})

_BYPASS_PERM = "sales.view_all_customers"


def get_sale_visible_nv_ids(current_user: User) -> list[int] | None:
    """Return None (full access) or list of NV IDs whose customers are visible.

    SALE_STAFF_ROLES are scoped by default.  The list always includes
    current_user.id plus any NV IDs granted via 'sales.view_all_customers'
    user-permission with a target_user_id.  If a full-bypass grant exists
    (target_user_id is None) or the role itself holds the bypass permission,
    None is returned (unrestricted access).
    """
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code not in SALE_STAFF_ROLES:
        return None  # Non-sale role → unrestricted

    # Role-level bypass → full access
    for rp in (current_user.role.role_permissions if current_user.role else []):
        if rp.permission and rp.permission.ma_quyen == _BYPASS_PERM:
            return None

    visible_ids: list[int] = [current_user.id]
    for up in (current_user.user_permissions or []):
        if up.permission and up.permission.ma_quyen == _BYPASS_PERM:
            if up.target_user_id is None:
                return None  # Full bypass grant
            if up.target_user_id not in visible_ids:
                visible_ids.append(up.target_user_id)

    return visible_ids


# Backward-compat alias — use get_sale_visible_nv_ids for new code
def get_sale_scope_user_id(current_user: User) -> int | None:
    """Deprecated — returns current_user.id or None only (ignores partial grants).
    Use get_sale_visible_nv_ids() for correct multi-NV scope support.
    """
    ids = get_sale_visible_nv_ids(current_user)
    if ids is None:
        return None
    return ids[0]  # own ID only — callers should migrate to get_sale_visible_nv_ids


def build_customer_scope_subquery(current_user: User, db: Session):
    """Subquery of Customer.id values visible to this user, or None for no restriction.

    Supports partial grants: includes customers of all NV IDs in the visible list.
    Callers apply:  q.filter(SomeModel.customer_id.in_(subquery))
    Skip the filter entirely when this returns None.
    """
    from sqlalchemy import exists, or_
    from app.models.master import Customer, CustomerNhanVien

    scope_nv_ids = get_sale_visible_nv_ids(current_user)
    if scope_nv_ids is None:
        return None  # Full access — caller skips the IN filter

    return db.query(Customer.id).filter(
        or_(
            Customer.nv_phu_trach_id.in_(scope_nv_ids),
            exists().where(
                (CustomerNhanVien.customer_id == Customer.id)
                & (CustomerNhanVien.user_id.in_(scope_nv_ids))
            ),
        )
    )
