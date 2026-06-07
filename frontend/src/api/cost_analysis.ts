import client from './client'

export interface PaperRow {
  ma_ky_hieu: string
  vi_tri_lop: string
  // Planned
  kg_ke_hoach: number
  don_gia_ke_hoach: number
  chi_phi_ke_hoach: number
  // Actual
  kg_thuc_te: number
  don_gia_thuc_te: number
  chi_phi_thuc_te: number
  // Delta
  delta_kg: number
  delta_chi_phi: number
}

export interface LsxCostItem {
  lsx_id: number
  ten_hang: string
  so_luong_ke_hoach: number
  paper_rows: PaperRow[]
  tong_chi_phi_giay_ke_hoach: number
  tong_chi_phi_giay_thuc_te: number
  gia_thanh_giay_ke_hoach: number
  gia_thanh_giay_thuc_te: number
  has_bom: boolean
  has_allocation: boolean
}

export interface CostAnalysisSummary {
  tong_ke_hoach: number
  tong_thuc_te: number
  delta_tong: number
}

export interface CostAnalysisResponse {
  khsx_id: number
  so_lenh: string
  items: LsxCostItem[]
  summary: CostAnalysisSummary
}

export const costAnalysisApi = {
  get: (khsxId: number) =>
    client.get<CostAnalysisResponse>(`/production-orders/${khsxId}/cost-analysis`),
}
