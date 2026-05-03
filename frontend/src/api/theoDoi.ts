import client from './client'

export interface DonHangTheoDoiRow {
  production_order_id: number | null
  so_lenh: string | null
  ngay_lenh: string | null
  trang_thai_po: string
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  sales_order_id: number | null
  so_don: string | null
  ten_khach_hang: string | null
  ngay_giao_hang: string | null
  ten_hang: string | null
  so_luong_ke_hoach: number
  nv_theo_doi_id: number | null
  ten_nv_theo_doi: string | null
  // CD1
  tong_nhap_phoi: number
  ngay_nhap_cuoi: string | null
  // Kho
  ton_kho_phoi: number
  tong_chuyen_phoi: number
  // CD2
  phieu_in_id: number | null
  so_phieu_in: string | null
  trang_thai_in: string | null
  ten_may_in: string | null
  ngay_in: string | null
  so_luong_in_ok: number | null
  // Summary
  stage: string
  stage_label: string
}

export interface PhanXuongItem {
  id: number
  ma_xuong: string
  ten_xuong: string
}

export interface TheoDoiParams {
  phan_xuong_id?: number
  nv_theo_doi_id?: number
  tu_ngay?: string
  den_ngay?: string
  include_hoan_thanh?: boolean
  so_lenh?: string
  so_don?: string
}

export const STAGE_COLORS: Record<string, string> = {
  da_duyet:      'gold',
  lap_lenh:      'blue',
  cho_sx:        'geekblue',
  chua_nhap:     'default',
  co_phoi:       'lime',
  cho_in:        'cyan',
  ke_hoach:      'processing',
  dang_in:       'orange',
  cho_dinh_hinh: 'purple',
  sau_in:        'volcano',
  dang_sau_in:   'magenta',
  hoan_thanh:    'green',
  huy:           'red',
}

export const theoDoiApi = {
  getDonHang: (params?: TheoDoiParams) =>
    client.get<DonHangTheoDoiRow[]>('/theo-doi/don-hang', { params }),

  botQuery: (params: { so_lenh?: string; so_don?: string }) =>
    client.get<DonHangTheoDoiRow[]>('/theo-doi/bot-query', { params }),

  listPhanXuong: () =>
    client.get<PhanXuongItem[]>('/theo-doi/phan-xuong'),
}
