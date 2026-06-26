from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.deps import require_roles, get_current_user, _owned_permissions
from app.models.auth import User, UserPermission, Permission
from app.services.role_service import PermissionService, RoleService
from app.schemas.auth import (
    PermissionCreate, PermissionUpdate, PermissionResponse,
    RoleCreate, RoleUpdate, RoleResponse, RoleDetailResponse,
    RolePermissionAssignRequest, PagedResponse
)

router = APIRouter(prefix="/api/permissions", tags=["permissions"])
role_router = APIRouter(prefix="/api/roles", tags=["roles"])
admin_required = require_roles("ADMIN")


# ====================================================
# PERMISSION ENDPOINTS
# ====================================================

@router.get("", response_model=PagedResponse)
def list_permissions(
    search: str = Query(default=""),
    nhom: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = PermissionService(db)
    return service.get_permissions_paginated(
        search=search,
        nhom=nhom,
        page=page,
        page_size=page_size,
    )


@router.get("/group/{nhom}", response_model=list[PermissionResponse])
def get_permissions_by_group(
    nhom: str,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = PermissionService(db)
    return service.get_permissions_by_group(nhom)


@router.get("/{permission_id}", response_model=PermissionResponse)
def get_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = PermissionService(db)
    return service.get_permission_by_id(permission_id)


@router.post("", response_model=PermissionResponse, status_code=201)
def create_permission(
    data: PermissionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = PermissionService(db)
    return service.create_permission(data)


@router.put("/{permission_id}", response_model=PermissionResponse)
def update_permission(
    permission_id: int,
    data: PermissionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = PermissionService(db)
    return service.update_permission(permission_id, data)


@router.delete("/{permission_id}")
def delete_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = PermissionService(db)
    return service.delete_permission(permission_id)


# ====================================================
# ROLE ENDPOINTS
# ====================================================

@role_router.get("", response_model=PagedResponse)
def list_roles(
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = RoleService(db)
    return service.get_roles_paginated(
        search=search,
        page=page,
        page_size=page_size,
    )


@role_router.get("/active", response_model=list[RoleResponse])
def get_active_roles(
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = RoleService(db)
    return service.get_all_roles_active()


@role_router.post("", response_model=RoleResponse, status_code=201)
def create_role(
    data: RoleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = RoleService(db)
    return service.create_role(data)


@role_router.get("/{role_id}", response_model=RoleDetailResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = RoleService(db)
    return service.get_role_by_id(role_id)


@role_router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = RoleService(db)
    return service.update_role(role_id, data)


@role_router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    service = RoleService(db)
    return service.delete_role(role_id)


# ====================================================
# ROLE-PERMISSION ASSIGNMENT ENDPOINTS
# ====================================================

@role_router.post("/{role_id}/permissions", response_model=RoleDetailResponse)
def assign_permissions(
    role_id: int,
    data: RolePermissionAssignRequest,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    """Gán nhiều quyền cho một vai trò (thay thế tất cả quyền cũ)"""
    service = RoleService(db)
    return service.assign_permissions(role_id, data)


@role_router.post("/{role_id}/permissions/{permission_id}", response_model=RoleDetailResponse)
def add_permission_to_role(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    """Thêm một quyền vào vai trò"""
    service = RoleService(db)
    return service.add_permission_to_role(role_id, permission_id)


@role_router.delete("/{role_id}/permissions/{permission_id}", response_model=RoleDetailResponse)
def remove_permission_from_role(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_required),
):
    """Xóa một quyền từ vai trò"""
    service = RoleService(db)
    return service.remove_permission_from_role(role_id, permission_id)


# ====================================================
# USER-LEVEL PERMISSION ENDPOINTS (Trưởng phòng quản lý team)
# ====================================================

# Permissions có thể được trưởng phòng cấp cho team (không cấp được quyền cao hơn mình)
_GRANTABLE_BY_TEAM_LEAD = {
    "report.xnt_all_nv",
    "report.cong_no_all_nv",
    "sales.view_all_customers",  # SALE_ADMIN xem toàn bộ KH (bypass phân vùng NV)
}

_team_lead_required = require_roles("ADMIN", "TRUONG_PHONG_SALE_ADMIN")


class UserPermissionGrantRequest(BaseModel):
    permission_ma_quyen: str
    target_user_id: int  # NV cụ thể được phép xem — bắt buộc khi cấp bổ sung


@role_router.get("/users/{user_id}/permissions", tags=["user-permissions"])
def get_user_extra_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_team_lead_required),
):
    """Lấy danh sách quyền cá nhân (bổ sung ngoài role) của một user."""
    rows = (
        db.query(UserPermission)
        .options(
            joinedload(UserPermission.permission),
            joinedload(UserPermission.granter),
            joinedload(UserPermission.target_user),
        )
        .filter(UserPermission.user_id == user_id)
        .all()
    )
    return [
        {
            "id": r.id,
            "ma_quyen": r.permission.ma_quyen,
            "ten_quyen": r.permission.ten_quyen,
            "target_user_id": r.target_user_id,
            "target_user_name": r.target_user.ho_ten if r.target_user else None,
            "granted_by_name": r.granter.ho_ten if r.granter else None,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@role_router.post("/users/{user_id}/permissions", tags=["user-permissions"], status_code=201)
def grant_user_permission(
    user_id: int,
    body: UserPermissionGrantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_team_lead_required),
):
    """Cấp thêm quyền cho một NV cụ thể (target_user_id bắt buộc)."""
    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code != "ADMIN" and body.permission_ma_quyen not in _GRANTABLE_BY_TEAM_LEAD:
        raise HTTPException(status_code=403, detail=f"Bạn không được phép cấp quyền: {body.permission_ma_quyen}")

    perm = db.query(Permission).filter(Permission.ma_quyen == body.permission_ma_quyen).first()
    if not perm:
        raise HTTPException(status_code=404, detail="Không tìm thấy quyền này")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")

    nv_target = db.query(User).filter(User.id == body.target_user_id).first()
    if not nv_target:
        raise HTTPException(status_code=404, detail="Không tìm thấy NV mục tiêu")

    # Cho phép nhiều dòng cùng permission nhưng target khác nhau
    existing = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.permission_id == perm.id,
        UserPermission.target_user_id == body.target_user_id,
    ).first()
    if existing:
        return {"message": f"Đã có quyền xem NV {nv_target.ho_ten} rồi"}

    up = UserPermission(
        user_id=user_id,
        permission_id=perm.id,
        granted_by=current_user.id,
        target_user_id=body.target_user_id,
    )
    db.add(up)
    db.commit()
    return {"message": f"Đã cấp quyền xem NV {nv_target.ho_ten} cho {target_user.ho_ten}"}


@role_router.delete("/users/{user_id}/permissions/by-id/{up_id}", tags=["user-permissions"])
def revoke_user_permission_by_id(
    user_id: int,
    up_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_team_lead_required),
):
    """Thu hồi quyền cá nhân theo ID dòng."""
    row = db.query(UserPermission).filter(
        UserPermission.id == up_id,
        UserPermission.user_id == user_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy quyền này")

    role_code = current_user.role.ma_vai_tro if current_user.role else None
    if role_code != "ADMIN" and row.permission.ma_quyen not in _GRANTABLE_BY_TEAM_LEAD:
        raise HTTPException(status_code=403, detail="Bạn không được phép thu hồi quyền này")

    db.delete(row)
    db.commit()
    return {"message": "Đã thu hồi quyền"}
