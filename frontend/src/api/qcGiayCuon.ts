import client from './client'

export interface QCGiayCuon {
  id: number
  so_phieu: string
  paper_material_id: number
  paper_material_ma: string | null
  paper_material_ten: string | null
  ncc_ten: string | null
  goods_receipt_id: number | null
  goods_receipt_item_id: number | null
  ngay_nhap_giay: string | null
  ngay_kiem_tra: string
  nguoi_kiem_tra: string | null
  trong_luong_tem: number | null
  kho_thuc_te: number | null
  kho_tc: number | null
  // Snapshot TC
  tc_dinh_luong: number | null
  tc_sai_so_pct: number | null
  tc_do_buc: number | null
  tc_do_nen_vong: number | null
  // Định lượng
  dl_l1: number | null
  dl_l2: number | null
  dl_tb: number | null
  dl_ket_qua: 'dat' | 'khong_dat' | null
  // Độ bục
  buc_l1: number | null
  buc_l2: number | null
  buc_l3: number | null
  buc_l4: number | null
  buc_tb: number | null
  buc_ket_qua: 'dat' | 'khong_dat' | null
  // Độ nén vòng
  nen_vong_l1: number | null
  nen_vong_l2: number | null
  nen_vong_l3: number | null
  nen_vong_tb: number | null
  nen_vong_ket_qua: 'dat' | 'khong_dat' | null
  // Khổ
  kho_ket_qua: 'dat' | 'khong_dat' | null
  // Tổng
  ket_qua: 'dat' | 'khong_dat' | null
  ghi_chu: string | null
  phap_nhan_id: number | null
  created_by: number | null
  created_at: string
}

export interface QCGiayCuonStats {
  tong: number
  dat: number
  khong_dat: number
  chua_co_ket_qua: number
  ty_le_dat_pct: number
}

export interface QCGiayCuonCreatePayload {
  paper_material_id: number
  goods_receipt_id?: number | null
  goods_receipt_item_id?: number | null
  ngay_nhap_giay?: string | null
  ngay_kiem_tra: string
  nguoi_kiem_tra?: string | null
  trong_luong_tem?: number | null
  kho_thuc_te?: number | null
  kho_tc?: number | null
  dl_l1?: number | null
  dl_l2?: number | null
  buc_l1?: number | null
  buc_l2?: number | null
  buc_l3?: number | null
  buc_l4?: number | null
  nen_vong_l1?: number | null
  nen_vong_l2?: number | null
  nen_vong_l3?: number | null
  ghi_chu?: string | null
  phap_nhan_id?: number | null
}

export interface QCGiayCuonUpdatePayload {
  ngay_kiem_tra?: string
  nguoi_kiem_tra?: string | null
  trong_luong_tem?: number | null
  kho_thuc_te?: number | null
  kho_tc?: number | null
  dl_l1?: number | null
  dl_l2?: number | null
  buc_l1?: number | null
  buc_l2?: number | null
  buc_l3?: number | null
  buc_l4?: number | null
  nen_vong_l1?: number | null
  nen_vong_l2?: number | null
  nen_vong_l3?: number | null
  ghi_chu?: string | null
}

export type QCGiayCuonListParams = {
  tu_ngay?: string
  den_ngay?: string
  paper_material_id?: number
  goods_receipt_id?: number
  ket_qua?: string
  skip?: number
  limit?: number
}

export const qcGiayCuonApi = {
  list: (params?: QCGiayCuonListParams) =>
    client.get<QCGiayCuon[]>('/qc-giay-cuon', { params }).then(r => r.data),

  get: (id: number) =>
    client.get<QCGiayCuon>(`/qc-giay-cuon/${id}`).then(r => r.data),

  create: (payload: QCGiayCuonCreatePayload) =>
    client.post<QCGiayCuon>('/qc-giay-cuon', payload).then(r => r.data),

  update: (id: number, payload: QCGiayCuonUpdatePayload) =>
    client.patch<QCGiayCuon>(`/qc-giay-cuon/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    client.delete(`/qc-giay-cuon/${id}`),

  stats: (params?: Omit<QCGiayCuonListParams, 'skip' | 'limit'>) =>
    client.get<QCGiayCuonStats>('/qc-giay-cuon/stats', { params }).then(r => r.data),
}
