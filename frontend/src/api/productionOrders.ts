import client from './client'
import type { PagedResponse } from './customers'

export interface ProductionOrderItem {
  id: number
  product_id: number | null
  sales_order_item_id: number | null
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
  so_luong_ke_hoach: number
  so_luong_hoan_thanh: number
  dvt: string
  ngay_giao_hang: string | null
  ghi_chu: string | null
}

export interface ProductionOrder {
  id: number
  so_lenh: string
  ngay_lenh: string
  sales_order_id: number | null
  so_don: string | null
  trang_thai: string
  ngay_bat_dau_ke_hoach: string | null
  ngay_hoan_thanh_ke_hoach: string | null
  ngay_bat_dau_thuc_te: string | null
  ngay_hoan_thanh_thuc_te: string | null
  ghi_chu: string | null
  items: ProductionOrderItem[]
  created_at: string
  updated_at: string
}

export interface ProductionOrderListItem {
  id: number
  so_lenh: string
  ngay_lenh: string
  sales_order_id: number | null
  so_don: string | null
  trang_thai: string
  ngay_hoan_thanh_ke_hoach: string | null
  so_dong: number
  tong_sl_ke_hoach: number
}

export interface CreateProductionItemPayload {
  product_id?: number
  sales_order_item_id?: number
  ten_hang: string
  so_luong_ke_hoach: number
  dvt?: string
  ngay_giao_hang?: string
  ghi_chu?: string
}

export interface CreateProductionOrderPayload {
  ngay_lenh: string
  sales_order_id?: number
  ngay_bat_dau_ke_hoach?: string
  ngay_hoan_thanh_ke_hoach?: string
  ghi_chu?: string
  items: CreateProductionItemPayload[]
}

export const TRANG_THAI_LABELS: Record<string, string> = {
  moi: 'Mới',
  dang_chay: 'Đang SX',
  hoan_thanh: 'Hoàn thành',
  huy: 'Huỷ',
}

export const TRANG_THAI_COLORS: Record<string, string> = {
  moi: 'blue',
  dang_chay: 'orange',
  hoan_thanh: 'green',
  huy: 'red',
}

export const productionOrdersApi = {
  list: (params?: {
    search?: string
    trang_thai?: string
    sales_order_id?: number
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<PagedResponse<ProductionOrderListItem>>('/production-orders', { params }),

  get: (id: number) => client.get<ProductionOrder>(`/production-orders/${id}`),
  create: (data: CreateProductionOrderPayload) => client.post<ProductionOrder>('/production-orders', data),
  update: (id: number, data: Partial<CreateProductionOrderPayload>) =>
    client.put<ProductionOrder>(`/production-orders/${id}`, data),
  start: (id: number) => client.patch<ProductionOrder>(`/production-orders/${id}/start`),
  complete: (id: number) => client.patch<ProductionOrder>(`/production-orders/${id}/complete`),
  cancel: (id: number) => client.patch(`/production-orders/${id}/cancel`),
  updateItemProgress: (orderId: number, itemId: number, so_luong_hoan_thanh: number) =>
    client.patch<ProductionOrderItem>(`/production-orders/${orderId}/items/${itemId}/progress`, {
      so_luong_hoan_thanh,
    }),
}
