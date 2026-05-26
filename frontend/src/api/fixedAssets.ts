import client from './client'

export interface FixedAsset {
  id: number
  ma_ts: string
  ten_ts: string
  ngay_mua: string
  nguyen_gia: number
  so_thang_khau_hao: number
  da_khau_hao_thang: number
  gia_tri_da_khau_hao: number
  trang_thai: string
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  tk_nguyen_gia: string
  tk_khau_hao: string
  tk_chi_phi: string
  bo_qua_hach_toan: boolean
  created_at: string
}

export interface DepreciationEntry {
  id: number
  asset_id: number
  ky: string
  so_tien_kh: number
  gia_tri_da_kh_sau: number
  journal_entry_id: number | null
  created_at: string
}

export interface DepreciationReportItem {
  id: number
  ma_ts: string
  ten_ts: string
  ngay_mua: string
  nguyen_gia: number
  gia_tri_da_khau_hao: number
  gia_tri_con_lai: number
  so_thang_khau_hao: number
  da_khau_hao_thang: number
  trang_thai: string
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  tk_khau_hao: string
  tk_chi_phi: string
  so_tien_du_kien: number
  so_tien_da_hach_toan: number
  da_hach_toan: boolean
  journal_entry_id: number | null
}

export interface DepreciationReport {
  ky: string
  tong_du_kien: number
  tong_da_hach_toan: number
  items: DepreciationReportItem[]
}

export const fixedAssetApi = {
  list: (params?: {
    search?: string
    trang_thai?: string
    phap_nhan_id?: number
    phan_xuong_id?: number
  }) => client.get<FixedAsset[]>('/fixed-assets', { params }).then(r => r.data),
  create: (data: Partial<FixedAsset>) => client.post<FixedAsset>('/fixed-assets', data).then(r => r.data),
  update: (id: number, data: Partial<FixedAsset>) => client.patch<FixedAsset>(`/fixed-assets/${id}`, data).then(r => r.data),
  depreciation: (id: number) => client.get<DepreciationEntry[]>(`/fixed-assets/${id}/depreciation`).then(r => r.data),
  runDepreciation: (ky: string) => client.post('/fixed-assets/run-depreciation', { ky }).then(r => r.data),
  runAssetDepreciation: (id: number, ky: string) => client.post(`/fixed-assets/${id}/depreciate`, { ky }).then(r => r.data),
  depreciationReport: (params: {
    ky: string
    trang_thai?: string
    phap_nhan_id?: number
    phan_xuong_id?: number
  }) => client.get<DepreciationReport>('/fixed-assets/depreciation-report', { params }).then(r => r.data),
}
