import client from './client'

export interface HangLoiPhoiRow {
  id: number
  phieu_nhap_phoi_song_item_id: number
  so_phieu: string | null
  ngay: string | null
  ca: string | null
  so_lenh: string | null
  ten_hang: string | null
  so_luong: number
  trang_thai: 'cho_xu_ly' | 'ban_phe' | 'tan_dung' | 'da_xu_ly' | 'huy'
  ghi_chu: string | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  so_lenh_tan_dung: string | null
  production_order_id_tan_dung: number | null
  created_at: string | null
  updated_at: string | null
}

export interface KhoAoPhoiListParams {
  trang_thai?: string
  phap_nhan_id?: number
  phan_xuong_id?: number
  tu_ngay?: string
  den_ngay?: string
}

export interface UpdateTrangThaiPayload {
  trang_thai: string
  ghi_chu?: string | null
  production_order_id_tan_dung?: number | null
}

export const khoAoPhoiApi = {
  nhap: (phieu_nhap_phoi_song_item_id: number) =>
    client.post<HangLoiPhoiRow>('/kho-ao-phoi/nhap', { phieu_nhap_phoi_song_item_id }),

  list: (params?: KhoAoPhoiListParams) =>
    client.get<HangLoiPhoiRow[]>('/kho-ao-phoi', { params }),

  updateTrangThai: (id: number, payload: UpdateTrangThaiPayload) =>
    client.patch<HangLoiPhoiRow>(`/kho-ao-phoi/${id}/trang-thai`, payload),
}
