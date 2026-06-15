import client from './client'

export interface ChiTieuItem {
  stt: number
  ten_chi_tieu: string
  don_vi: string | null
  yeu_cau_text: string | null
  kieu_kiem_tra: 'range' | 'min' | 'max' | 'pass_fail'
  gia_tri_min: number | null
  gia_tri_max: number | null
  bat_buoc: boolean
}

export interface QCNvlItemResult {
  stt: number
  ten_chi_tieu: string
  yeu_cau: string | null
  ket_qua_do: string | null
  ket_qua: 'dat' | 'khong_dat' | null
  ghi_chu: string | null
}

export interface QCNvl {
  id: number
  so_phieu: string
  other_material_id: number
  other_material_ma: string | null
  other_material_ten: string | null
  ncc_ten: string | null
  goods_receipt_id: number | null
  ngay_kiem_tra: string
  nguoi_kiem_tra: string | null
  tieu_chuan_id: number | null
  tieu_chuan_ten: string | null
  tc_snapshot_json: ChiTieuItem[] | null
  items_json: QCNvlItemResult[] | null
  ket_qua: 'dat' | 'khong_dat' | null
  ghi_chu: string | null
  phap_nhan_id: number | null
  created_by: number | null
  created_at: string
}

export interface QCNvlStats {
  tong: number
  dat: number
  khong_dat: number
  chua_co_ket_qua: number
  ty_le_dat_pct: number
}

export interface TieuChuanInfo {
  ma_vt: string
  ten_vt: string
  tieu_chuan_id: number | null
  tieu_chuan_ma?: string
  tieu_chuan_ten?: string
  chi_tieu_list: ChiTieuItem[] | null
}

export interface QCNvlCreatePayload {
  other_material_id: number
  goods_receipt_id?: number | null
  ngay_kiem_tra: string
  nguoi_kiem_tra?: string | null
  tieu_chuan_id?: number | null
  items_json?: QCNvlItemResult[] | null
  ghi_chu?: string | null
  phap_nhan_id?: number | null
}

export interface QCNvlUpdatePayload {
  ngay_kiem_tra?: string
  nguoi_kiem_tra?: string | null
  tieu_chuan_id?: number | null
  items_json?: QCNvlItemResult[] | null
  ghi_chu?: string | null
}

export type QCNvlListParams = {
  tu_ngay?: string
  den_ngay?: string
  other_material_id?: number
  goods_receipt_id?: number
  ket_qua?: string
  skip?: number
  limit?: number
}

export const qcNvlApi = {
  list: (params?: QCNvlListParams) =>
    client.get<QCNvl[]>('/qc-nvl', { params }).then(r => r.data),

  get: (id: number) =>
    client.get<QCNvl>(`/qc-nvl/${id}`).then(r => r.data),

  create: (payload: QCNvlCreatePayload) =>
    client.post<QCNvl>('/qc-nvl', payload).then(r => r.data),

  update: (id: number, payload: QCNvlUpdatePayload) =>
    client.patch<QCNvl>(`/qc-nvl/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/qc-nvl/${id}`),

  stats: (params?: Omit<QCNvlListParams, 'skip' | 'limit'>) =>
    client.get<QCNvlStats>('/qc-nvl/stats', { params }).then(r => r.data),

  getTieuChuan: (other_material_id: number) =>
    client.get<TieuChuanInfo>(`/qc-nvl/tieu-chuan/${other_material_id}`).then(r => r.data),
}
