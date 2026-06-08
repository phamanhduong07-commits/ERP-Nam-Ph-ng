import client from './client'
import type { PagedResponse } from './types'
export type { PagedResponse } from './types'   // re-export để các file khác vẫn import từ đây được

export interface Customer {
  id: number
  ma_kh: string
  ten_viet_tat: string
  ten_don_vi: string | null
  dia_chi: string | null
  dia_chi_giao_hang: string | null
  dien_thoai: string | null
  fax: string | null
  ma_so_thue: string | null
  nguoi_dai_dien: string | null
  nguoi_lien_he: string | null
  so_dien_thoai_lh: string | null
  no_tran: number
  so_ngay_no: number
  xep_loai: string | null
  la_khach_vip: boolean
  ghi_chu: string | null
  trang_thai: boolean
  nv_ids: number[]
  email: string | null
  phap_nhan: string | null
  ke_toan_phu_trach: string | null
  dieu_khoan_tt: string | null
  sa_cskh: string | null
}

export interface SaleUser {
  id: number
  ho_ten: string
  username: string
}

export const customersApi = {
  list: (params?: { search?: string; page?: number; page_size?: number; nv_id?: number; trang_thai?: boolean }) =>
    client.get<PagedResponse<Customer>>('/customers', { params }),
  all: () => client.get<Customer[]>('/customers/all'),
  get: (id: number) => client.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => client.post<Customer>('/customers', data),
  update: (id: number, data: Partial<Customer>) => client.put<Customer>(`/customers/${id}`, data),
  saleUsers: () => client.get<SaleUser[]>('/customers/sale-users'),
  import: (file: File, commit: boolean) => {
    const fd = new FormData(); fd.append('file', file); fd.append('commit', String(commit))
    return client.post<Record<string, unknown>>('/customers/import-excel', fd)
  },
}
