from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_quyen: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ten_quyen: Mapped[str] = mapped_column(String(255), nullable=False)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    nhom: Mapped[str | None] = mapped_column(String(50))
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    role_permissions: Mapped[list["RolePermission"]] = relationship(
        "RolePermission", back_populates="permission", cascade="all, delete-orphan")
    user_permissions: Mapped[list["UserPermission"]] = relationship(
        "UserPermission", back_populates="permission", cascade="all, delete-orphan")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id"), nullable=False)
    permission_id: Mapped[int] = mapped_column(Integer, ForeignKey("permissions.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    role: Mapped["Role"] = relationship("Role", back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="role_permissions")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ma_vai_tro: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    ten_vai_tro: Mapped[str] = mapped_column(String(100), nullable=False)
    mo_ta: Mapped[str | None] = mapped_column(Text)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    users: Mapped[list["User"]] = relationship("User", back_populates="role")
    role_permissions: Mapped[list["RolePermission"]] = relationship(
        "RolePermission", back_populates="role", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ho_ten: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), unique=True)
    so_dien_thoai: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id"), nullable=False)
    phan_xuong: Mapped[str | None] = mapped_column(String(50))
    phan_xuong_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phan_xuong.id"), nullable=True)
    phap_nhan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("phap_nhan.id"), nullable=True)
    bo_phan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("hr_departments.id"), nullable=True)
    trang_thai: Mapped[bool] = mapped_column(Boolean, default=True)
    machine_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lan_dang_nhap_cuoi: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Khi cấp tài khoản mới (random password), force NV đổi pass lần đầu login
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(
            timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc))

    role: Mapped["Role"] = relationship("Role", back_populates="users")
    phan_xuong_obj: Mapped["PhanXuong | None"] = relationship("PhanXuong", foreign_keys="User.phan_xuong_id")
    phap_nhan: Mapped["PhapNhan | None"] = relationship("PhapNhan", foreign_keys="User.phap_nhan_id")
    user_permissions: Mapped[list["UserPermission"]] = relationship(
        "UserPermission", foreign_keys="UserPermission.user_id",
        back_populates="user", cascade="all, delete-orphan")


class UserPermission(Base):
    """Per-user permission overrides — granted on top of role permissions."""
    __tablename__ = "user_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission_id: Mapped[int] = mapped_column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    granted_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    # NV cụ thể được phép xem (NULL = tất cả — không dùng khi cấp mới)
    target_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="user_permissions")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="user_permissions")
    granter: Mapped["User | None"] = relationship("User", foreign_keys=[granted_by])
    target_user: Mapped["User | None"] = relationship("User", foreign_keys=[target_user_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    hanh_dong: Mapped[str] = mapped_column(String(20), nullable=False)
    bang: Mapped[str] = mapped_column(String(100), nullable=False)
    ban_ghi_id: Mapped[str | None] = mapped_column(String(50))
    du_lieu_cu: Mapped[dict | None] = mapped_column(JSON)
    du_lieu_moi: Mapped[dict | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
