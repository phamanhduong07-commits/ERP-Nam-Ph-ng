import client from './client'
import type { PagedResponse } from './types'
export type { PagedResponse } from './types'   // re-export để các file khác vẫn import từ đây được

export interface Customer {
  id: number
  ma_kh: string
  ten_viet_tat: string
  ten_don_vi: string | null
  dien_thoai: string | null
  dia_chi: string | null
  dia_chi_giao_hang: string | null
  ma_so_thue: string | null
  no_tran: number
  so_ngay_no: number
  trang_thai: boolean
}

export const customersApi = {
  list: (params?: { search?: string; page?: number; page_size?: number }) =>
    client.get<PagedResponse<Customer>>('/customers', { params }),
  all: () => client.get<Customer[]>('/customers/all'),
  get: (id: number) => client.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => client.post<Customer>('/customers', data),
  update: (id: number, data: Partial<Customer>) => client.put<Customer>(`/customers/${id}`, data),
}
