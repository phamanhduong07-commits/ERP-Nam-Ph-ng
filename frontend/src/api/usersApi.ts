import client from './client'

export interface NhanVien {
  id: number
  username: string
  ho_ten: string
  email: string | null
  so_dien_thoai: string | null
  role_id: number
  phan_xuong: string | null
  trang_thai: boolean
  role_name: string | null
  role_code: string | null
  created_at: string
}

export interface UserCreatePayload {
  username: string
  ho_ten: string
  email?: string | null
  so_dien_thoai?: string | null
  password: string
  role_id: number
  phan_xuong?: string | null
}

export interface UserUpdatePayload {
  ho_ten?: string
  email?: string | null
  so_dien_thoai?: string | null
  role_id?: number
  phan_xuong?: string | null
  trang_thai?: boolean
}

export const usersApi = {
  list: (params?: { search?: string; phan_xuong?: string; trang_thai?: boolean }) =>
    client.get<NhanVien[]>('/users', { params }),
  create: (data: UserCreatePayload) => client.post<NhanVien>('/users', data),
  update: (id: number, data: UserUpdatePayload) => client.put<NhanVien>(`/users/${id}`, data),
  resetPassword: (id: number, password: string) =>
    client.post(`/users/${id}/reset-password`, { password }),
}
