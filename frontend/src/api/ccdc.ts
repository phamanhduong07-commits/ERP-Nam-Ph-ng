import client from './client'

export interface NhomCCDC {
  id: number
  ma_nhom: string
  ten_nhom: string
  ghi_chu: string | null
  trang_thai: boolean
}

export interface CCDC {
  id: number
  ma_ccdc: string
  ten_ccdc: string
  nhom_id: number | null
  ten_nhom: string | null
  don_vi_tinh: string | null
  so_luong: number
  nguyen_gia: number
  gia_tri_con_lai: number
  ngay_mua: string | null
  thoi_gian_phan_bo: number
  so_thang_da_phan_bo: number
  bo_phan_su_dung: string | null
  trang_thai: string
  ghi_chu: string | null
  created_at: string
}

export interface CCDCCreate {
  ma_ccdc: string
  ten_ccdc: string
  nhom_id?: number | null
  don_vi_tinh?: string
  so_luong?: number
  nguyen_gia?: number
  gia_tri_con_lai?: number
  ngay_mua?: string | null
  thoi_gian_phan_bo?: number
  bo_phan_su_dung?: string
  trang_thai?: string
  ghi_chu?: string
}

export interface PhieuXuatCCDCItem {
  id: number
  ccdc_id: number
  ten_ccdc: string | null
  so_luong: number
  ghi_chu: string | null
}

export interface PhieuXuatCCDC {
  id: number
  so_phieu: string
  ngay_xuat: string
  nguoi_nhan: string | null
  bo_phan: string | null
  ly_do: string | null
  trang_thai: string
  items: PhieuXuatCCDCItem[]
  created_at: string
}

export interface PhieuXuatCCDCCreate {
  ngay_xuat: string
  nguoi_nhan?: string
  bo_phan?: string
  ly_do?: string
  items: { ccdc_id: number; so_luong: number; ghi_chu?: string }[]
}

export const ccdcApi = {
  listNhom: () => client.get<NhomCCDC[]>('/ccdc/nhom'),
  createNhom: (data: { ma_nhom: string; ten_nhom: string; ghi_chu?: string }) =>
    client.post<NhomCCDC>('/ccdc/nhom', data),
  updateNhom: (id: number, data: { ma_nhom: string; ten_nhom: string; ghi_chu?: string }) =>
    client.put<NhomCCDC>(`/ccdc/nhom/${id}`, data),

  list: (params?: { search?: string; nhom_id?: number; trang_thai?: string }) =>
    client.get<CCDC[]>('/ccdc', { params }),
  create: (data: CCDCCreate) => client.post<CCDC>('/ccdc', data),
  update: (id: number, data: Partial<CCDCCreate>) => client.put<CCDC>(`/ccdc/${id}`, data),
  get: (id: number) => client.get<CCDC>(`/ccdc/${id}`),

  listPhieuXuat: (params?: { tu_ngay?: string; den_ngay?: string; trang_thai?: string }) =>
    client.get<PhieuXuatCCDC[]>('/ccdc/phieu-xuat', { params }),
  createPhieuXuat: (data: PhieuXuatCCDCCreate) =>
    client.post<PhieuXuatCCDC>('/ccdc/phieu-xuat', data),
  approvePhieuXuat: (id: number) =>
    client.patch(`/ccdc/phieu-xuat/${id}/approve`),
  cancelPhieuXuat: (id: number) =>
    client.patch(`/ccdc/phieu-xuat/${id}/cancel`),
}
