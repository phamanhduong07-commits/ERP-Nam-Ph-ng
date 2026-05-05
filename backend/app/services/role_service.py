from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.models.auth import Role, Permission, RolePermission
from app.schemas.auth import (
    RoleCreate, RoleUpdate, RoleResponse, RoleDetailResponse,
    PermissionCreate, PermissionUpdate, PermissionResponse,
    RolePermissionAssignRequest, PagedResponse
)
from datetime import datetime


class PermissionService:
    def __init__(self, db: Session):
        self.db = db

    def get_permissions_paginated(
        self,
        search: str = "",
        nhom: str = "",
        page: int = 1,
        page_size: int = 20,
    ) -> PagedResponse:
        q = self.db.query(Permission)

        if search:
            like = f"%{search}%"
            q = q.filter(Permission.ma_quyen.ilike(like) | Permission.ten_quyen.ilike(like))
        
        if nhom:
            q = q.filter(Permission.nhom == nhom)

        total = q.count()
        permissions = q.order_by(Permission.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        return PagedResponse(
            items=[PermissionResponse.model_validate(p) for p in permissions],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    def get_permission_by_id(self, permission_id: int) -> PermissionResponse:
        permission = self.db.query(Permission).filter(Permission.id == permission_id).first()
        if not permission:
            raise HTTPException(status_code=404, detail="Không tìm thấy quyền")
        return PermissionResponse.model_validate(permission)

    def create_permission(self, data: PermissionCreate) -> PermissionResponse:
        existing = self.db.query(Permission).filter(Permission.ma_quyen == data.ma_quyen).first()
        if existing:
            raise HTTPException(status_code=400, detail="Mã quyền đã tồn tại")

        permission = Permission(**data.model_dump())
        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)
        return PermissionResponse.model_validate(permission)

    def update_permission(self, permission_id: int, data: PermissionUpdate) -> PermissionResponse:
        permission = self.db.query(Permission).filter(Permission.id == permission_id).first()
        if not permission:
            raise HTTPException(status_code=404, detail="Không tìm thấy quyền")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(permission, key, value)

        self.db.commit()
        self.db.refresh(permission)
        return PermissionResponse.model_validate(permission)

    def delete_permission(self, permission_id: int) -> dict:
        permission = self.db.query(Permission).filter(Permission.id == permission_id).first()
        if not permission:
            raise HTTPException(status_code=404, detail="Không tìm thấy quyền")

        self.db.delete(permission)
        self.db.commit()
        return {"message": f"Đã xóa quyền {permission.ten_quyen}"}

    def get_permissions_by_group(self, nhom: str) -> list[PermissionResponse]:
        permissions = self.db.query(Permission).filter(
            Permission.nhom == nhom,
            Permission.trang_thai == True
        ).all()
        return [PermissionResponse.model_validate(p) for p in permissions]


class RoleService:
    def __init__(self, db: Session):
        self.db = db

    def get_roles_paginated(
        self,
        search: str = "",
        page: int = 1,
        page_size: int = 20,
    ) -> PagedResponse:
        q = self.db.query(Role).options(
            joinedload(Role.role_permissions).joinedload(RolePermission.permission)
        )

        if search:
            like = f"%{search}%"
            q = q.filter(Role.ma_vai_tro.ilike(like) | Role.ten_vai_tro.ilike(like))

        total = q.count()
        roles = q.order_by(Role.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        return PagedResponse(
            items=[RoleDetailResponse.model_validate(r) for r in roles],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )

    def get_role_by_id(self, role_id: int) -> RoleDetailResponse:
        role = self.db.query(Role).options(
            joinedload(Role.role_permissions).joinedload(RolePermission.permission)
        ).filter(Role.id == role_id).first()
        
        if not role:
            raise HTTPException(status_code=404, detail="Không tìm thấy vai trò")
        
        return RoleDetailResponse.model_validate(role)

    def create_role(self, data: RoleCreate) -> RoleResponse:
        existing = self.db.query(Role).filter(Role.ma_vai_tro == data.ma_vai_tro).first()
        if existing:
            raise HTTPException(status_code=400, detail="Mã vai trò đã tồn tại")

        role = Role(**data.model_dump())
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return RoleResponse.model_validate(role)

    def update_role(self, role_id: int, data: RoleUpdate) -> RoleResponse:
        role = self.db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Không tìm thấy vai trò")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(role, key, value)

        self.db.commit()
        self.db.refresh(role)
        return RoleResponse.model_validate(role)

    def delete_role(self, role_id: int) -> dict:
        role = self.db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Không tìm thấy vai trò")

        # Check if role has users
        if role.users:
            raise HTTPException(status_code=400, detail="Không thể xóa vai trò đang được sử dụng")

        self.db.delete(role)
        self.db.commit()
        return {"message": f"Đã xóa vai trò {role.ten_vai_tro}"}

    def assign_permissions(self, role_id: int, data: RolePermissionAssignRequest) -> RoleDetailResponse:
        role = self.db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Không tìm thấy vai trò")

        # Xóa tất cả quyền cũ
        self.db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()

        # Thêm quyền mới
        for permission_id in data.permission_ids:
            permission = self.db.query(Permission).filter(Permission.id == permission_id).first()
            if not permission:
                raise HTTPException(status_code=404, detail=f"Không tìm thấy quyền ID {permission_id}")

            role_permission = RolePermission(role_id=role_id, permission_id=permission_id)
            self.db.add(role_permission)

        self.db.commit()
        self.db.refresh(role)
        
        return self.get_role_by_id(role_id)

    def add_permission_to_role(self, role_id: int, permission_id: int) -> RoleDetailResponse:
        role = self.db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Không tìm thấy vai trò")

        permission = self.db.query(Permission).filter(Permission.id == permission_id).first()
        if not permission:
            raise HTTPException(status_code=404, detail="Không tìm thấy quyền")

        # Check if already exists
        existing = self.db.query(RolePermission).filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="Quyền đã được gán cho vai trò này")

        role_permission = RolePermission(role_id=role_id, permission_id=permission_id)
        self.db.add(role_permission)
        self.db.commit()

        return self.get_role_by_id(role_id)

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> RoleDetailResponse:
        role_permission = self.db.query(RolePermission).filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id
        ).first()

        if not role_permission:
            raise HTTPException(status_code=404, detail="Không tìm thấy mối quan hệ giữa vai trò và quyền")

        self.db.delete(role_permission)
        self.db.commit()

        return self.get_role_by_id(role_id)

    def get_all_roles_active(self) -> list[RoleResponse]:
        roles = self.db.query(Role).filter(Role.trang_thai == True).all()
        return [RoleResponse.model_validate(r) for r in roles]
