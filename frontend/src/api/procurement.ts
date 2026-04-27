import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POItemCreate {
  paper_material_id?: number | null
  other_material_id?: number | null
  ten_hang?: string | null
  so_cuon?: number | null
  so_luong: number
  dvt?: string | null
  don_gia?: number
  ghi_chu?: string | null
}

export interface POItemResponse {
  id: number
  order_id: number
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string | null
  ten_nguyen_lieu: string | null
  ma_nguyen_lieu: string | null
  so_cuon: number | null
  so_luong: number
  dvt: string | null
  don_gia: number
  thanh_tien: number
  so_luong_da_nhap: number
  ghi_chu: string | null
}

export interface POCreate {
  loai_don: string  // giay_cuon | khac
  ngay_dat: string
  supplier_id: number
  nv_thu_mua_id?: number | null
  ten_nhom_hang?: string | null
  noi_dung?: string | null
  ghi_chu?: string | null
  items: POItemCreate[]
}

export interface POUpdate {
  ngay_dat?: string
  supplier_id?: number
  nv_thu_mua_id?: number | null
  ten_nhom_hang?: string | null
  noi_dung?: string | null
  ghi_chu?: string | null
}

export interface POListItem {
  id: number
  so_don_mua: string
  loai_don: string
  ngay_dat: string
  supplier_id: number
  ten_nha_cung_cap: string | null
  tong_tien: number
  trang_thai: string
  so_dong: number
  created_at: string
}

export interface POResponse {
  id: number
  so_don_mua: string
  loai_don: string
  ngay_dat: string
  supplier_id: number
  ten_nha_cung_cap: string | null
  nv_thu_mua_id: number | null
  ten_nv_thu_mua: string | null
  nguoi_duyet_id: number | null
  ten_nguoi_duyet: string | null
  ngay_duyet: string | null
  ten_nhom_hang: string | null
  tong_tien: number
  trang_thai: string
  noi_dung: string | null
  ghi_chu: string | null
  items: POItemResponse[]
  created_at: string
  updated_at: string
}

export interface POPagedResponse {
  items: POListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ─── Material Receipt Types ───────────────────────────────────────────────────

export interface ReceiptItemCreate {
  purchase_order_item_id?: number | null
  paper_material_id?: number | null
  other_material_id?: number | null
  ten_hang?: string | null
  so_luong: number
  dvt?: string | null
  don_gia?: number
  ghi_chu?: string | null
}

export interface ReceiptItemResponse {
  id: number
  receipt_id: number
  purchase_order_item_id: number | null
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string | null
  ten_nguyen_lieu: string | null
  ma_nguyen_lieu: string | null
  so_luong: number
  dvt: string | null
  don_gia: number
  thanh_tien: number
  ghi_chu: string | null
}

export interface ReceiptCreate {
  ngay_nhap: string
  phan_xuong?: string | null
  warehouse_id: number
  supplier_id: number
  purchase_order_id?: number | null
  so_phieu_can?: string | null
  bien_so_xe?: string | null
  trong_luong_xe?: number | null
  trong_luong_hang?: number | null
  ghi_chu?: string | null
  items: ReceiptItemCreate[]
}

export interface ReceiptListItem {
  id: number
  so_phieu: string
  ngay_nhap: string
  supplier_id: number
  ten_nha_cung_cap: string | null
  ten_kho: string | null
  purchase_order_id: number | null
  so_don_mua: string | null
  tong_tien: number
  trang_thai: string
  so_dong: number
  created_at: string
}

export interface ReceiptResponse {
  id: number
  so_phieu: string
  ngay_nhap: string
  phan_xuong: string | null
  warehouse_id: number
  ten_kho: string | null
  supplier_id: number
  ten_nha_cung_cap: string | null
  purchase_order_id: number | null
  so_don_mua: string | null
  so_phieu_can: string | null
  bien_so_xe: string | null
  trong_luong_xe: number | null
  trong_luong_hang: number | null
  tong_tien: number
  ghi_chu: string | null
  trang_thai: string
  items: ReceiptItemResponse[]
  created_at: string
  updated_at: string
}

export interface ReceiptPagedResponse {
  items: ReceiptListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface MaterialInventoryRow {
  ma_nguyen_lieu: string
  ten_nguyen_lieu: string
  loai: string
  dvt: string | null
  ton_luong: number
  gia_tri_ton: number
  don_gia_binh_quan: number
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const procurementApi = {
  // Purchase Orders
  listPO: (params?: {
    search?: string
    loai_don?: string
    trang_thai?: string
    supplier_id?: number
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<POPagedResponse>('/procurement/purchase-orders', { params }),

  getPO: (id: number) =>
    client.get<POResponse>(`/procurement/purchase-orders/${id}`),

  createPO: (data: POCreate) =>
    client.post<POResponse>('/procurement/purchase-orders', data),

  updatePO: (id: number, data: POUpdate) =>
    client.put<POResponse>(`/procurement/purchase-orders/${id}`, data),

  approvePO: (id: number) =>
    client.patch<POResponse>(`/procurement/purchase-orders/${id}/approve`),

  cancelPO: (id: number) =>
    client.patch(`/procurement/purchase-orders/${id}/cancel`),

  // Material Receipts
  listReceipts: (params?: {
    search?: string
    trang_thai?: string
    supplier_id?: number
    warehouse_id?: number
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<ReceiptPagedResponse>('/procurement/material-receipts', { params }),

  getReceipt: (id: number) =>
    client.get<ReceiptResponse>(`/procurement/material-receipts/${id}`),

  createReceipt: (data: ReceiptCreate) =>
    client.post<ReceiptResponse>('/procurement/material-receipts', data),

  confirmReceipt: (id: number) =>
    client.patch<ReceiptResponse>(`/procurement/material-receipts/${id}/confirm`),

  // Inventory
  getMaterialInventory: (params?: {
    warehouse_id?: number
    loai?: string
    search?: string
  }) => client.get<MaterialInventoryRow[]>('/procurement/inventory/material', { params }),
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PO_TRANG_THAI: Record<string, { label: string; color: string }> = {
  cho_duyet:  { label: 'Chờ duyệt',    color: 'orange' },
  da_duyet:   { label: 'Đã duyệt',     color: 'blue' },
  hoan_thanh: { label: 'Hoàn thành',   color: 'green' },
  huy:        { label: 'Đã hủy',       color: 'red' },
}

export const PO_LOAI: Record<string, string> = {
  giay_cuon: 'Giấy cuộn',
  khac:      'Hàng khác',
}

export const RECEIPT_TRANG_THAI: Record<string, { label: string; color: string }> = {
  nhap:     { label: 'Nháp',          color: 'default' },
  xac_nhan: { label: 'Đã xác nhận',  color: 'green' },
}
