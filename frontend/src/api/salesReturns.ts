import client from './client'
import type { PagedResponse } from './customers'

export interface SalesReturnItem {
  id: number
  sales_order_item_id: number
  sales_order_item: {
    id: number
    ten_hang: string
    so_luong: number
    don_gia: number
    dvt: string
  } | null
  so_luong_tra: number
  don_gia_tra: number
  thanh_tien_tra: number
  ly_do_tra: string | null
  tinh_trang_hang: string
  ghi_chu: string | null
}

export interface SalesReturn {
  id: number
  so_phieu_tra: string
  ngay_tra: string
  sales_order_id: number
  sales_order: {
    id: number
    so_don: string
    ngay_don: string
    tong_tien: number
  } | null
  customer_id: number
  customer: { id: number; ma_kh: string; ten_viet_tat: string; ten_don_vi: string | null } | null
  ly_do_tra: string
  trang_thai: string
  tong_tien_tra: number
  ghi_chu: string | null
  items: SalesReturnItem[]
  created_by: number | null
  ten_nguoi_tao: string | null
  approved_by: number | null
  ten_nguoi_duyet: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface SalesReturnListItem {
  id: number
  so_phieu_tra: string
  ngay_tra: string
  sales_order_id: number
  so_don_ban: string | null
  customer_id: number
  ten_khach_hang: string | null
  ly_do_tra: string
  trang_thai: string
  tong_so_luong_tra: number
  tong_tien_tra: number
  created_at: string
}

export interface CreateReturnItemPayload {
  delivery_order_item_id?: number
  sales_order_item_id: number
  so_luong_tra: number
  don_gia_tra?: number
  ly_do_tra?: string
  tinh_trang_hang?: string
  ghi_chu?: string
}

export interface CreateReturnPayload {
  sales_order_id: number
  delivery_order_id?: number
  customer_id: number
  ngay_tra: string
  ly_do_tra: string
  ghi_chu?: string
  items: CreateReturnItemPayload[]
}

export interface UpdateReturnPayload {
  ngay_tra?: string
  ly_do_tra?: string
  ghi_chu?: string
  items?: CreateReturnItemPayload[]
}

export const SALES_RETURN_TRANG_THAI_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_duyet: 'Đã duyệt',
  huy: 'Huỷ',
}

export const SALES_RETURN_TRANG_THAI_COLORS: Record<string, string> = {
  moi: 'blue',
  da_duyet: 'green',
  huy: 'red',
}

export const TINH_TRANG_HANG_LABELS: Record<string, string> = {
  tot: 'Tốt',
  hong: 'Hỏng',
  loi: 'Lỗi',
}

export const salesReturnsApi = {
  list: (params?: {
    search?: string
    trang_thai?: string
    customer_id?: number
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<PagedResponse<SalesReturnListItem>>('/sales-returns', { params }),

  get: (id: number) => client.get<SalesReturn>(`/sales-returns/${id}`),
  create: (data: CreateReturnPayload) => client.post<SalesReturn>('/sales-returns', data),
  update: (id: number, data: UpdateReturnPayload) =>
    client.put<SalesReturn>(`/sales-returns/${id}`, data),
  approve: (id: number) => client.patch<SalesReturn>(`/sales-returns/${id}/approve`),
  cancel: (id: number) => client.patch(`/sales-returns/${id}/cancel`),
}
