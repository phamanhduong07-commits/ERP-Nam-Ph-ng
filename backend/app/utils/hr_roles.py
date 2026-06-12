"""Shared role helpers cho HR module.

Định nghĩa 1 chỗ duy nhất để tránh drift giữa các router (ai cũng phải import từ đây).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.auth import User


# ─── Role sets ───
# Đề xuất tăng ca: chỉ tổ trưởng / tổ phó / quản lý cấp trên hơn
OVERTIME_REQUEST_ROLES = frozenset({
    "TO_TRUONG", "TO_PHO",
    "TRUONG_PHONG", "QUAN_LY", "QUAN_DOC",
    "ADMIN", "NHAN_SU", "GIAM_DOC", "BGD",
})

# HR / Admin (xem được PII nhân viên khác)
HR_ADMIN_ROLES = frozenset({"ADMIN", "NHAN_SU"})

# Trưởng phòng (duyệt cấp 1 đơn từ)
DEPT_MANAGER_ROLES = frozenset({
    "ADMIN", "NHAN_SU", "TRUONG_PHONG", "QUAN_LY", "QUAN_DOC",
})

# Ban Giám Đốc (duyệt cấp 2 — cuối)
BGD_ROLES = frozenset({"ADMIN", "GIAM_DOC", "BGD"})


# ─── Helper ───
def role_code(user: "User | None") -> str:
    """Lấy mã vai trò chuẩn hóa (UPPERCASE). Trả "" nếu user không có role."""
    if not user or not getattr(user, "role", None):
        return ""
    return (user.role.ma_vai_tro or "").upper()


def can_request_overtime(user: "User") -> bool:
    return role_code(user) in OVERTIME_REQUEST_ROLES


def is_hr_admin(user: "User") -> bool:
    return role_code(user) in HR_ADMIN_ROLES


def is_dept_manager(user: "User") -> bool:
    return role_code(user) in DEPT_MANAGER_ROLES


def is_bgd(user: "User") -> bool:
    return role_code(user) in BGD_ROLES
