import client from './client'

export interface QCDefect {
  id: number
  loai_loi: string
  mo_ta: string | null
  so_luong_loi: number
  hinh_anh_path: string | null
}

export interface QCSheet {
  id: number
  so_phieu: string
  loai: string
  ref_type: string | null
  ref_id: number | null
  ngay: string
  nguoi_kiem_tra: string | null
  ket_qua: string | null
  ghi_chu: string | null
  phap_nhan_id: number | null
  phan_xuong_id: number | null
  created_by: number | null
  created_at: string
  defects: QCDefect[]
}

export interface QCStats {
  tong: number
  dat: number
  khong_dat: number
  tam_chap_nhan: number
  chua_co_ket_qua: number
  ty_le_dat_pct: number
}

export interface CreateQCSheetPayload {
  loai: string
  ref_type?: string | null
  ref_id?: number | null
  ngay: string
  nguoi_kiem_tra?: string | null
  ket_qua?: string | null
  ghi_chu?: string | null
  phap_nhan_id?: number | null
  phan_xuong_id?: number | null
  defects?: Array<{ loai_loi: string; mo_ta?: string; so_luong_loi?: number }>
}

export interface UpdateKetQuaPayload {
  ket_qua?: string | null
  nguoi_kiem_tra?: string | null
  ghi_chu?: string | null
  defects?: Array<{ loai_loi: string; mo_ta?: string; so_luong_loi?: number }>
}

export const qualityApi = {
  list: (params?: Record<string, string | number | null | undefined>) =>
    client.get<QCSheet[]>('/api/qc-sheets', { params }).then(r => r.data),

  get: (id: number) =>
    client.get<QCSheet>(`/api/qc-sheets/${id}`).then(r => r.data),

  create: (payload: CreateQCSheetPayload) =>
    client.post<QCSheet>('/api/qc-sheets', payload).then(r => r.data),

  updateKetQua: (id: number, payload: UpdateKetQuaPayload) =>
    client.patch<QCSheet>(`/api/qc-sheets/${id}/ket-qua`, payload).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/api/qc-sheets/${id}`),

  stats: (params?: Record<string, string | null | undefined>) =>
    client.get<QCStats>('/api/qc-sheets/stats', { params }).then(r => r.data),
}
