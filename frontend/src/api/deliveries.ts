import client from './client'

// ── Yêu cầu giao hàng ────────────────────────────────────────────────────────

export interface YeuCauItem {
  id: number
  production_order_id: number
  so_lenh: string | null
  warehouse_id: number
  ten_kho: string | null
  product_id: number | null
  sales_order_item_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  dien_tich: number
  trong_luong: number
  the_tich?: number
  ghi_chu: string | null
}

export interface YeuCauGiaoHang {
  id: number
  so_yeu_cau: string
  ngay_yeu_cau: string
  ngay_giao_yeu_cau: string | null
  customer_id: number | null
  ten_khach_hang: string | null
  ten_phap_nhan: string | null
  ten_kho_tp: string | null
  dia_chi_giao: string | null
  nguoi_nhan: string | null
  trang_thai: string  // moi | da_sap_xe | da_tao_phieu | huy
  ghi_chu: string | null
  tong_dien_tich: number
  tong_trong_luong: number
  items: YeuCauItem[]
  created_at: string
}

export interface CreateYeuCauItemPayload {
  production_order_id: number
  warehouse_id: number
  so_luong: number
  dvt?: string
  dien_tich?: number
  trong_luong?: number
  ghi_chu?: string
}

export interface CreateYeuCauPayload {
  ngay_yeu_cau: string
  ngay_giao_yeu_cau?: string
  customer_id?: number
  dia_chi_giao?: string
  nguoi_nhan?: string
  ghi_chu?: string
  items: CreateYeuCauItemPayload[]
}

export const YEU_CAU_TRANG_THAI_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_sap_xe: 'Đã sắp xe',
  da_tao_phieu: 'Đã tạo phiếu',
  huy: 'Huỷ',
}

export const YEU_CAU_TRANG_THAI_COLORS: Record<string, string> = {
  moi: 'blue',
  da_sap_xe: 'orange',
  da_tao_phieu: 'green',
  huy: 'red',
}

export const yeuCauApi = {
  list: (params?: {
    trang_thai?: string
    customer_id?: number
    ten_khach?: string
    nv_theo_doi_id?: number
    so_lenh?: string
    so_don?: string
    tu_ngay?: string
    den_ngay?: string
  }) =>
    client.get<YeuCauGiaoHang[]>('/yeu-cau-giao-hang', { params }),
  get: (id: number) => client.get<YeuCauGiaoHang>(`/yeu-cau-giao-hang/${id}`),
  create: (data: CreateYeuCauPayload) =>
    client.post<YeuCauGiaoHang>('/yeu-cau-giao-hang', data),
  update: (id: number, data: { trang_thai?: string; ngay_giao_yeu_cau?: string; dia_chi_giao?: string; nguoi_nhan?: string; ghi_chu?: string }) =>
    client.patch<YeuCauGiaoHang>(`/yeu-cau-giao-hang/${id}`, data),
  delete: (id: number) => client.delete(`/yeu-cau-giao-hang/${id}`),
}

// ── Phiếu bán hàng (Delivery Order) ──────────────────────────────────────────

export interface DeliveryOrderItem {
  id: number
  production_order_id: number | null
  so_lenh: string | null
  sales_order_item_id: number | null
  product_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  dien_tich: number
  trong_luong: number
  the_tich: number
  don_gia: number
  thanh_tien: number
  ghi_chu: string | null
}

export interface DeliveryOrder {
  id: number
  so_phieu: string
  ngay_xuat: string
  sales_order_id: number | null
  so_don: string | null
  customer_id: number
  ten_khach: string | null
  warehouse_id: number
  ten_kho: string | null
  yeu_cau_id: number | null
  dia_chi_giao: string | null
  nguoi_nhan: string | null
  xe_van_chuyen: string | null
  xe_id: number | null
  bien_so: string | null
  loai_xe: string | null
  trong_tai: number | null
  tai_xe_id: number | null
  ten_tai_xe: string | null
  lo_xe: string | null
  don_gia_vc_id: number | null
  ten_tuyen: string | null
  tien_van_chuyen: number
  tong_tien_hang: number
  tong_thanh_toan: number
  trang_thai_cong_no: string  // chua_thu | da_thu_mot_phan | da_thu_du
  tong_dien_tich: number
  tong_trong_luong: number
  tong_the_tich: number
  trang_thai: string
  items: DeliveryOrderItem[]
  ghi_chu: string | null
  created_at: string
}

export interface CreateDeliveryItemPayload {
  production_order_id?: number
  sales_order_item_id?: number
  product_id?: number
  ten_hang: string
  so_luong: number
  dvt?: string
  dien_tich?: number
  trong_luong?: number
  the_tich?: number
  don_gia?: number
  ghi_chu?: string
}

export interface CreateDeliveryPayload {
  ngay_xuat: string
  warehouse_id: number
  sales_order_id?: number
  customer_id?: number
  yeu_cau_id?: number
  dia_chi_giao?: string
  nguoi_nhan?: string
  xe_van_chuyen?: string
  xe_id?: number
  tai_xe_id?: number
  lo_xe?: string
  don_gia_vc_id?: number
  tien_van_chuyen?: number
  ghi_chu?: string
  items: CreateDeliveryItemPayload[]
}

export const CONG_NO_LABELS: Record<string, string> = {
  chua_thu: 'Chưa thu',
  da_thu_mot_phan: 'Thu một phần',
  da_thu_du: 'Đã thu đủ',
}

export const CONG_NO_COLORS: Record<string, string> = {
  chua_thu: 'red',
  da_thu_mot_phan: 'orange',
  da_thu_du: 'green',
}

export const deliveriesApi = {
  list: (params?: {
    customer_id?: number
    sales_order_id?: number
    ten_khach?: string
    nv_theo_doi_id?: number
    so_lenh?: string
    so_don?: string
    tu_ngay?: string
    den_ngay?: string
  }) =>
    client.get<DeliveryOrder[]>('/warehouse/deliveries', { params }),
  get: (id: number) => client.get<DeliveryOrder>(`/warehouse/deliveries/${id}`),
  create: (data: CreateDeliveryPayload) =>
    client.post<DeliveryOrder>('/warehouse/deliveries', data),
  delete: (id: number) => client.delete(`/warehouse/deliveries/${id}`),
  getBySalesOrder: (salesOrderId: number) =>
    client.get<DeliveryOrder[]>(`/warehouse/deliveries?sales_order_id=${salesOrderId}`),
}
