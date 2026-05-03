import client from './client'

export interface PhapNhan {
  id: number
  ma_phap_nhan: string
  ten_phap_nhan: string
  ten_viet_tat: string | null
  ma_so_thue: string | null
  dia_chi: string | null
  so_dien_thoai: string | null
  tai_khoan: string | null
  ngan_hang: string | null
  ky_hieu_hd: string | null
  trang_thai: boolean
  created_at: string | null
  phoi_phan_xuong_id: number | null
  ten_phoi_phan_xuong: string | null
}

export interface CreatePhapNhanPayload {
  ma_phap_nhan: string
  ten_phap_nhan: string
  ten_viet_tat?: string | null
  ma_so_thue?: string | null
  dia_chi?: string | null
  so_dien_thoai?: string | null
  tai_khoan?: string | null
  ngan_hang?: string | null
  ky_hieu_hd?: string | null
  trang_thai?: boolean
}

export const phapNhanApi = {
  list: (params?: { active_only?: boolean }) =>
    client.get<PhapNhan[]>('/phap-nhan', { params }),

  create: (data: CreatePhapNhanPayload) =>
    client.post<PhapNhan>('/phap-nhan', data),

  update: (id: number, data: CreatePhapNhanPayload) =>
    client.put<PhapNhan>(`/phap-nhan/${id}`, data),

  delete: (id: number) => client.delete(`/phap-nhan/${id}`),
}
