import client from './client'

export interface MayDungLog {
  id: number
  production_order_id: number
  so_lenh: string | null
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  ngay: string
  gio_bat_dau_dung: string
  gio_tiep_tuc: string | null
  thoi_gian_dung: number | null   // phút
  ly_do: string
  ten_ly_do: string
  ghi_chu: string | null
  created_by: number | null
  ten_created_by: string | null
  created_at: string | null
}

export interface MayDungCreate {
  production_order_id: number
  phan_xuong_id?: number | null
  ngay: string
  gio_bat_dau_dung: string        // "HH:MM"
  ly_do: string
  ghi_chu?: string | null
}

export const LY_DO_OPTIONS = [
  { value: 'hong_may',        label: 'Hỏng máy' },
  { value: 'het_nguyen_lieu', label: 'Hết nguyên liệu' },
  { value: 'nghi_giai_lao',   label: 'Nghỉ giải lao' },
  { value: 'giao_ca',         label: 'Giao ca' },
  { value: 'khac',            label: 'Khác' },
]

export const mayDungLogApi = {
  create: (data: MayDungCreate) =>
    client.post<MayDungLog>('/api/may-dung-log', data),

  tiepTuc: (logId: number, gio_tiep_tuc: string) =>
    client.put<MayDungLog>(`/api/may-dung-log/${logId}/tiep-tuc`, { gio_tiep_tuc }),

  list: (params?: {
    production_order_id?: number
    phan_xuong_id?: number
    tu_ngay?: string
    den_ngay?: string
    ly_do?: string
  }) => client.get<MayDungLog[]>('/api/may-dung-log', { params }),
}
