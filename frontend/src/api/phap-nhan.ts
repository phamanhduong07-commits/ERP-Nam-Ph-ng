import client from './client'

export interface PhapNhan {
  id?: number
  ma_phap_nhan: string
  ten_phap_nhan: string
  ten_viet_tat?: string
  ma_so_thue?: string
  dia_chi?: string
  so_dien_thoai?: string
  tai_khoan?: string
  ngan_hang?: string
  ky_hieu_hd?: string
  email?: string
  trang_thai: boolean
  phoi_phan_xuong_id?: number
  ten_phoi_phan_xuong?: string
}

export const phapNhanApi = {
  list: (params?: any) => client.get<PhapNhan[]>('/phap-nhan', { params }),
  create: (data: PhapNhan) => client.post<PhapNhan>('/phap-nhan', data),
  update: (id: number, data: PhapNhan) => client.put<PhapNhan>(`/phap-nhan/${id}`, data),
  delete: (id: number) => client.delete(`/phap-nhan/${id}`),
}
