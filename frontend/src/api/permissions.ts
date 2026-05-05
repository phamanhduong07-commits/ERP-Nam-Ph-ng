import client from './client'

export interface Role {
  id: number
  ma_vai_tro: string
  ten_vai_tro: string
  mo_ta: string | null
  trang_thai: boolean
  created_at: string
}

export interface Permission {
  id: number
  ma_quyen: string
  ten_quyen: string
  mo_ta: string | null
  nhom: string | null
  trang_thai: boolean
  created_at: string
}

export interface RolePermission {
  id: number
  permission: Permission
}

export interface RoleDetail extends Role {
  role_permissions: RolePermission[]
}

interface Paged<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export const rolesApi = {
  active: () => client.get<Role[]>('/roles/active'),
  list: (params?: { search?: string; page?: number; page_size?: number }) =>
    client.get<Paged<RoleDetail>>('/roles', { params }),
  get: (id: number) => client.get<RoleDetail>(`/roles/${id}`),
  assignPermissions: (roleId: number, permission_ids: number[]) =>
    client.post<RoleDetail>(`/roles/${roleId}/permissions`, { permission_ids }),
}

export const permissionsApi = {
  list: (params?: { search?: string; nhom?: string; page?: number; page_size?: number }) =>
    client.get<Paged<Permission>>('/permissions', { params }),
}
