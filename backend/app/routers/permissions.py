from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import require_roles
from app.models.auth import User
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
