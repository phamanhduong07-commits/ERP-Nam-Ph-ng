import client from './client'
import type { PagedResponse } from './customers'

export interface Supplier {
  id: number
  ma_ncc: string
  ten_viet_tat: string
  ten_don_vi: string | null
  dia_chi: string | null
  dien_thoai: string | null
  fax: string | null
  di_dong: string | null
  ma_so_thue: string | null
  nguoi_dai_dien: string | null
  phan_loai: string | null
  ma_ncc_amis: string | null
  ghi_chu: string | null
  trang_thai: boolean
  created_at: string
}

export type SupplierCreate = Omit<Supplier, 'id' | 'created_at'>

export const suppliersApi = {
  list: (params?: { search?: string; page?: number; page_size?: number; trang_thai?: boolean }) =>
    client.get<PagedResponse<Supplier>>('/suppliers', { params }),
  all: () => client.get<Supplier[]>('/suppliers/all'),
  get: (id: number) => client.get<Supplier>(`/suppliers/${id}`),
  create: (data: SupplierCreate) => client.post<Supplier>('/suppliers', data),
  update: (id: number, data: Partial<SupplierCreate>) => client.put<Supplier>(`/suppliers/${id}`, data),
  import: (file: File, commit: boolean) => {
    const fd = new FormData(); fd.append('file', file); fd.append('commit', String(commit))
    return client.post<any>('/suppliers/import-excel', fd)
  },
}
