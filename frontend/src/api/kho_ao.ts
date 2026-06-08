import client from './client'

export interface HangLoiKhoAoRow {
  id: number
  production_output_id: number
  so_phieu: string | null
  ngay_nhap: string | null
  so_lenh: string | null
  ten_hang: string | null
  dvt: string
  so_luong: number
  trang_thai: 'cho_xu_ly' | 'dang_xu_ly' | 'da_xu_ly' | 'huy'
  nguyen_nhan: string | null
  bien_phap_xu_ly: string | null
  han_xu_ly: string | null
  ghi_chu: string | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  quy_cach: string | null
  loai_thung: string | null
  so_lop: number | null
  created_at: string | null
  updated_at: string | null
}

export interface KhoAoListParams {
  trang_thai?: string
  phap_nhan_id?: number
  phan_xuong_id?: number
  tu_ngay?: string
  den_ngay?: string
}

export const khoAoApi = {
  nhap: (production_output_id: number) =>
    client.post<HangLoiKhoAoRow>('/kho-ao/nhap', { production_output_id }),

  list: (params?: KhoAoListParams) =>
    client.get<HangLoiKhoAoRow[]>('/kho-ao', { params }),

  updateGhiChu: (id: number, ghi_chu: string | null) =>
    client.patch<HangLoiKhoAoRow>(`/kho-ao/${id}/ghi-chu`, { ghi_chu }),
}
