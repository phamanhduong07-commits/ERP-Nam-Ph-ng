import client from './client'

export interface NhanVien {
  id: number
  username: string
  ho_ten: string
  email: string | null
  so_dien_thoai: string | null
  phan_xuong: string | null
  trang_thai: boolean
  role_name: string
  created_at: string
}

export const usersApi = {
  list: (params?: { search?: string; phan_xuong?: string; trang_thai?: boolean }) =>
    client.get<NhanVien[]>('/users', { params }),
}
