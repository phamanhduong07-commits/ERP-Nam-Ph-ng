import client from './client'

// ── Debt Summary ──────────────────────────────────────────────────────────────

export interface DebtRow {
  customer_id?: number
  supplier_id?: number
  ten_doi_tuong: string
  so_hoa_don: number
  tong_phat_sinh: number
  da_thanh_toan: number
  con_lai: number
  qua_han: number
  trong_han: number
}

export interface DebtGroupSummary {
  tong_phat_sinh: number
  da_thanh_toan: number
  con_lai: number
  qua_han: number
  trong_han: number
  so_doi_tuong: number
}

export interface DebtSummaryResponse {
  as_of_date: string
  ar: { summary: DebtGroupSummary; rows: DebtRow[] }
  ap: { summary: DebtGroupSummary; rows: DebtRow[] }
}

// ── Revenue ───────────────────────────────────────────────────────────────────

export interface RevenueKyRow {
  ky: string
  doanh_thu: number
}

export interface RevenueCustomerRow {
  customer_id: number
  ten_khach_hang: string
  doanh_thu: number
  so_don: number
}

export interface RevenueResponse {
  tu_ngay: string
  den_ngay: string
  nhom: string
  tong_doanh_thu: number
  so_don_hang: number
  theo_ky: RevenueKyRow[]
  top_khach_hang: RevenueCustomerRow[]
}

// ── Inventory Movement ────────────────────────────────────────────────────────

export interface InventoryMovementRow {
  warehouse_id: number
  ten_kho: string
  ten_hang: string
  don_vi: string
  ton_dau_ky: number
  nhap_trong_ky: number
  xuat_trong_ky: number
  ton_cuoi_ky: number
  gia_tri_ton: number
}

export interface InventoryMovementResponse {
  tu_ngay: string
  den_ngay: string
  warehouse_id: number | null
  rows: InventoryMovementRow[]
  summary: { tong_nhap: number; tong_xuat: number; tong_gia_tri_ton: number }
}

// ── Production Performance ────────────────────────────────────────────────────

export interface ProductionPerfRow {
  production_order_id: number
  so_lenh: string
  ngay_lenh: string | null
  trang_thai: string
  ten_khach_hang: string | null
  ten_phan_xuong: string | null
  ngay_ke_hoach_xong: string | null
  ngay_thuc_te_xong: string | null
  tong_ke_hoach: number
  tong_hoan_thanh: number
  ty_le_hoan_thanh: number
  tre_han: number | null
}

export interface ProductionPerfResponse {
  tu_ngay: string
  den_ngay: string
  rows: ProductionPerfRow[]
  summary: { so_lenh: number; hoan_thanh: number; dang_chay: number; trung_binh_ty_le: number }
}

// ── Order Progress ────────────────────────────────────────────────────────────

export interface OrderProgressRow {
  sales_order_id: number
  so_don: string
  ngay_don: string | null
  ngay_giao_du_kien: string | null
  trang_thai: string
  customer_id: number
  ten_khach_hang: string | null
  so_luong_dat: number
  so_luong_da_giao: number
  so_luong_con_lai: number
  ty_le_giao: number
  tong_tien: number
}

export interface OrderProgressResponse {
  tu_ngay: string
  den_ngay: string
  rows: OrderProgressRow[]
  summary: { so_don: number; tong_tien: number; da_giao_xong: number; chua_giao: number }
}

// ── Delivery Report ───────────────────────────────────────────────────────────

export interface DeliveryReportRow {
  delivery_id: number
  so_phieu: string
  ngay_xuat: string | null
  so_don: string | null
  ten_khach: string | null
  ten_kho: string | null
  xe_van_chuyen: string | null
  nguoi_nhan: string | null
  dia_chi_giao: string | null
  tong_so_luong: number
  trang_thai: string
}

export interface DeliveryReportResponse {
  tu_ngay: string
  den_ngay: string
  rows: DeliveryReportRow[]
  by_xe: { xe: string; so_chuyen: number; tong_so_luong: number }[]
  summary: { tong_chuyen: number; tong_sl: number; da_giao: number }
}

// ── Import Log ────────────────────────────────────────────────────────────────

export interface ImportLogItem {
  id: number
  user_id: number | null
  ten_nguoi_import: string | null
  loai_du_lieu: string
  ten_file: string | null
  so_dong_thanh_cong: number
  so_dong_loi: number
  so_dong_bo_qua: number
  trang_thai: 'success' | 'partial' | 'failed'
  chi_tiet_loi: string | null
  thoi_gian: string | null
}

export interface ImportLogResponse {
  total: number
  page: number
  page_size: number
  items: ImportLogItem[]
}

// ── API ───────────────────────────────────────────────────────────────────────

export const reportsApi = {
  getDebtSummary: (asOfDate?: string): Promise<DebtSummaryResponse> =>
    client.get('/reports/debt-summary', { params: asOfDate ? { as_of_date: asOfDate } : {} }).then(r => r.data),

  getRevenue: (params: { tu_ngay: string; den_ngay: string; nhom?: string }): Promise<RevenueResponse> =>
    client.get('/reports/revenue', { params }).then(r => r.data),

  getInventoryMovement: (params: { tu_ngay: string; den_ngay: string; warehouse_id?: number }): Promise<InventoryMovementResponse> =>
    client.get('/reports/inventory-movement', { params }).then(r => r.data),

  getProductionPerformance: (params: { tu_ngay: string; den_ngay: string; phan_xuong_id?: number }): Promise<ProductionPerfResponse> =>
    client.get('/reports/production-performance', { params }).then(r => r.data),

  getOrderProgress: (params: { tu_ngay: string; den_ngay: string; trang_thai?: string; customer_id?: number }): Promise<OrderProgressResponse> =>
    client.get('/reports/order-progress', { params }).then(r => r.data),

  getDeliveryReport: (params: { tu_ngay: string; den_ngay: string }): Promise<DeliveryReportResponse> =>
    client.get('/reports/delivery-report', { params }).then(r => r.data),

  // --- Quản trị & Tài chính ---
  getWorkshopPNL: (params: { phan_xuong_id: number; tu_ngay: string; den_ngay: string }) =>
    client.get('/accounting/reports/workshop-pnl', { params }).then(r => r.data),

  getLegalEntityCashflow: (params: { phap_nhan_id: number; tu_ngay: string; den_ngay: string }) =>
    client.get('/accounting/reports/legal-entity-cashflow', { params }).then(r => r.data),

  getVATSummary: (params: { thang: number; nam: number; phap_nhan_id?: number }) =>
    client.get('/accounting/reports/vat-summary', { params }).then(r => r.data),

  getTaxTrialBalance: (params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number }) =>
    client.get('/accounting/reports/trial-balance-tax', { params }).then(r => r.data),

  getProductionCosting: (params: { tu_ngay: string; den_ngay: string; phan_xuong_id?: number }) =>
    client.get('/accounting/reports/production-costing', { params }).then(r => r.data),
}

export const importLogsApi = {
  list: (params?: {
    loai_du_lieu?: string
    tu_ngay?: string
    den_ngay?: string
    user_id?: number
    page?: number
    page_size?: number
  }): Promise<ImportLogResponse> =>
    client.get('/import-logs', { params }).then(r => r.data),

  create: (params: {
    loai_du_lieu: string
    ten_file?: string
    so_dong_thanh_cong?: number
    so_dong_loi?: number
    so_dong_bo_qua?: number
    chi_tiet_loi?: string
  }): Promise<ImportLogItem> =>
    client.post('/import-logs', null, { params }).then(r => r.data),
}

