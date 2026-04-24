import client from './client'
import type { PagedResponse } from './customers'

export interface SalesOrderItem {
  id: number
  product_id: number | null
  ten_hang: string
  product: {
    id: number
    ma_amis: string
    ten_hang: string
    dai: number | null
    rong: number | null
    cao: number | null
    so_lop: number
    dvt: string
    gia_ban: number
  } | null
  so_luong: number
  dvt: string
  don_gia: number
  thanh_tien: number
  ngay_giao_hang: string | null
  ghi_chu_san_pham: string | null
  yeu_cau_in: string | null
  so_luong_da_xuat: number
  trang_thai_dong: string
  // Thông số kỹ thuật (kế thừa từ báo giá)
  loai_thung: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number | null
  to_hop_song: string | null
  mat: string | null;     mat_dl: number | null
  song_1: string | null;  song_1_dl: number | null
  mat_1: string | null;   mat_1_dl: number | null
  song_2: string | null;  song_2_dl: number | null
  mat_2: string | null;   mat_2_dl: number | null
  song_3: string | null;  song_3_dl: number | null
  mat_3: string | null;   mat_3_dl: number | null
  loai_in: string | null
  so_mau: number | null
}

export interface SalesOrder {
  id: number
  so_don: string
  ngay_don: string
  customer_id: number
  customer: { id: number; ma_kh: string; ten_viet_tat: string; ten_don_vi: string | null; dien_thoai: string | null } | null
  trang_thai: string
  ngay_giao_hang: string | null
  dia_chi_giao: string | null
  ghi_chu: string | null
  tong_tien: number
  items: SalesOrderItem[]
  created_at: string
  updated_at: string
}

export interface SalesOrderListItem {
  id: number
  so_don: string
  ngay_don: string
  customer_id: number
  ten_khach_hang: string | null
  trang_thai: string
  ngay_giao_hang: string | null
  tong_tien: number
  so_dong: number
}

export interface CreateOrderItemPayload {
  product_id: number
  so_luong: number
  don_gia: number
  dvt?: string
  ngay_giao_hang?: string
  ghi_chu_san_pham?: string
  yeu_cau_in?: string
}

export interface CreateOrderPayload {
  customer_id: number
  ngay_don: string
  ngay_giao_hang?: string
  dia_chi_giao?: string
  ghi_chu?: string
  items: CreateOrderItemPayload[]
}

export const TRANG_THAI_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_duyet: 'Đã duyệt',
  dang_sx: 'Đang SX',
  da_xuat: 'Đã xuất kho',
  hoan_thanh: 'Hoàn thành',
  huy: 'Huỷ',
}

export const TRANG_THAI_COLORS: Record<string, string> = {
  moi: 'blue',
  da_duyet: 'cyan',
  dang_sx: 'orange',
  da_xuat: 'purple',
  hoan_thanh: 'green',
  huy: 'red',
}

export const salesOrdersApi = {
  list: (params?: {
    search?: string
    trang_thai?: string
    customer_id?: number
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<PagedResponse<SalesOrderListItem>>('/sales-orders', { params }),

  get: (id: number) => client.get<SalesOrder>(`/sales-orders/${id}`),
  create: (data: CreateOrderPayload) => client.post<SalesOrder>('/sales-orders', data),
  update: (id: number, data: Partial<CreateOrderPayload>) =>
    client.put<SalesOrder>(`/sales-orders/${id}`, data),
  approve: (id: number) => client.patch<SalesOrder>(`/sales-orders/${id}/approve`),
  cancel: (id: number) => client.patch(`/sales-orders/${id}/cancel`),
}
