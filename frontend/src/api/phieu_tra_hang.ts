import api from './client'

export type LoaiHang = 'PHOI' | 'THANH_PHAM'

export interface TraHangItem {
  id?: number
  so_luong: number
  don_vi?: string | null
  tinh_trang: 'tot' | 'loi'
  chieu_kho?: number | null    // PHOI only
  chieu_cat?: number | null    // PHOI only
  product_id?: number | null   // THANH_PHAM only
  ten_san_pham?: string | null
  don_gia?: number | null
  thanh_tien?: number | null
  ghi_chu?: string | null
}

export interface PhieuTraHang {
  id: number
  so_phieu: string
  ngay: string
  loai_hang: LoaiHang
  customer_id: number
  ten_khach_hang: string | null
  production_order_id: number | null
  so_lenh: string | null
  delivery_order_id: number | null
  warehouse_id: number
  ten_kho: string | null
  ly_do_tra: string | null
  trang_thai: 'draft' | 'confirmed' | 'huy'
  nguoi_giao: string | null
  ghi_chu: string | null
  created_at: string | null
  confirmed_at: string | null
  tong_so_luong: number
  tong_tot: number
  tong_loi: number
  items: TraHangItem[]
}

export interface PhieuTraHangCreate {
  ngay: string
  loai_hang: LoaiHang
  customer_id: number
  production_order_id?: number | null
  delivery_order_id?: number | null
  warehouse_id: number
  ly_do_tra?: string | null
  nguoi_giao?: string | null
  ghi_chu?: string | null
  items: TraHangItem[]
}

export interface PhieuTraHangListParams {
  loai_hang?: LoaiHang
  customer_id?: number
  production_order_id?: number
  trang_thai?: string
  tu_ngay?: string
  den_ngay?: string
}

const BASE = '/phieu-tra-hang'

export const phieuTraHangApi = {
  list: (params?: PhieuTraHangListParams) =>
    api.get<PhieuTraHang[]>(BASE, { params }).then(r => r.data),

  get: (id: number) =>
    api.get<PhieuTraHang>(`${BASE}/${id}`).then(r => r.data),

  create: (body: PhieuTraHangCreate) =>
    api.post<PhieuTraHang>(BASE, body).then(r => r.data),

  update: (id: number, body: Partial<PhieuTraHangCreate>) =>
    api.put<PhieuTraHang>(`${BASE}/${id}`, body).then(r => r.data),

  delete: (id: number) =>
    api.delete(`${BASE}/${id}`),

  confirm: (id: number) =>
    api.post<PhieuTraHang>(`${BASE}/${id}/confirm`).then(r => r.data),

  huy: (id: number) =>
    api.post(`${BASE}/${id}/huy`).then(r => r.data),
}
