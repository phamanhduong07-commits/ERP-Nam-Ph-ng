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
  // Thông số kỹ thuật (kế thừa từ đơn hàng / báo giá)
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
  kho_tt: number | null
  dai_tt: number | null
  qccl: string | null
  dien_tich: number | null
  gia_ban_muc_tieu: number | null
}

export interface ProductionOrder {
  id: number
  so_lenh: string
  ngay_lenh: string
  sales_order_id: number | null
  so_don: string | null
  ten_khach_hang: string | null
  ma_khach_hang: string | null
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

export interface UpdateItemSxParamsPayload {
  kho_tt?: number | null
  dai_tt?: number | null
  qccl?: string | null
  to_hop_song?: string | null
  mat?: string | null;     mat_dl?: number | null
  song_1?: string | null;  song_1_dl?: number | null
  mat_1?: string | null;   mat_1_dl?: number | null
  song_2?: string | null;  song_2_dl?: number | null
  mat_2?: string | null;   mat_2_dl?: number | null
  song_3?: string | null;  song_3_dl?: number | null
  mat_3?: string | null;   mat_3_dl?: number | null
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

export interface PhieuNhapPhoiSongItemPayload {
  production_order_item_id: number
  so_luong_ke_hoach: number
  so_luong_thuc_te?: number | null
  so_luong_loi?: number | null
  chieu_kho?: number | null
  chieu_cat?: number | null
  so_tam?: number | null
  ghi_chu?: string | null
}

export interface PhieuNhapPhoiSongPayload {
  ngay: string
  ca?: string | null
  ghi_chu?: string | null
  gio_bat_dau?: string | null  // HH:MM
  gio_ket_thuc?: string | null // HH:MM
  items: PhieuNhapPhoiSongItemPayload[]
}

export interface PhieuNhapPhoiSongItem {
  id: number
  production_order_item_id: number
  so_luong_ke_hoach: number
  so_luong_thuc_te: number | null
  so_luong_loi: number | null
  chieu_kho: number | null
  chieu_cat: number | null
  so_tam: number | null
  ghi_chu: string | null
}

export interface PhieuNhapPhoiSong {
  id: number
  so_phieu: string
  production_order_id: number
  ngay: string
  ca: string | null
  ghi_chu: string | null
  gio_bat_dau: string | null
  gio_ket_thuc: string | null
  created_at: string | null
  items: PhieuNhapPhoiSongItem[]
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

  /** Tạo lệnh SX từ toàn bộ dòng hàng của một đơn hàng đã duyệt */
  createFromOrder: (
    salesOrderId: number,
    opts?: { ngay_lenh?: string; ngay_hoan_thanh_ke_hoach?: string; ghi_chu?: string },
  ) =>
    client.post<ProductionOrder>(
      `/production-orders/tu-don-hang/${salesOrderId}`,
      opts ?? {},
    ),

  update: (id: number, data: Partial<CreateProductionOrderPayload>) =>
    client.put<ProductionOrder>(`/production-orders/${id}`, data),
  start: (id: number) => client.patch<ProductionOrder>(`/production-orders/${id}/start`),
  complete: (id: number) => client.patch<ProductionOrder>(`/production-orders/${id}/complete`),
  cancel: (id: number) => client.patch(`/production-orders/${id}/cancel`),
  updateItemProgress: (orderId: number, itemId: number, so_luong_hoan_thanh: number) =>
    client.patch<ProductionOrderItem>(`/production-orders/${orderId}/items/${itemId}/progress`, {
      so_luong_hoan_thanh,
    }),

  updateItemSxParams: (orderId: number, itemId: number, data: UpdateItemSxParamsPayload) =>
    client.patch<ProductionOrder>(`/production-orders/${orderId}/items/${itemId}/sx-params`, data),

  createPhieu: (orderId: number, data: PhieuNhapPhoiSongPayload) =>
    client.post<PhieuNhapPhoiSong>(`/production-orders/${orderId}/phieu-nhap-phoi-song`, data),

  listPhieu: (orderId: number) =>
    client.get<PhieuNhapPhoiSong[]>(`/production-orders/${orderId}/phieu-nhap-phoi-song`),
}
