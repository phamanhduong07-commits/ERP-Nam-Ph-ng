import client from './client'

export const HINH_THUC_TT: Record<string, string> = {
  tien_mat: 'Tiền mặt',
  TM: 'Tiền mặt',
  chuyen_khoan: 'Chuyển khoản',
  CK: 'Chuyển khoản',
  bu_tru_cong_no: 'Bù trừ công nợ',
  khac: 'Khác',
}

// ──────────────────────────────────────────────────────
// Constants / Labels
// ──────────────────────────────────────────────────────

export const TRANG_THAI_PHIEU_THU: Record<string, { label: string; color: string }> = {
  cho_duyet: { label: 'Chờ duyệt', color: 'orange' },
  da_duyet:  { label: 'Đã duyệt',  color: 'green' },
  huy:       { label: 'Đã hủy',    color: 'default' },
}

export const TRANG_THAI_PHIEU_CHI: Record<string, { label: string; color: string }> = {
  cho_chot:  { label: 'Chờ chốt',  color: 'default' },
  da_chot:   { label: 'Đã chốt',   color: 'orange' },
  da_duyet:  { label: 'Đã duyệt',  color: 'green' },
  huy:       { label: 'Đã hủy',    color: 'default' },
}

export const TRANG_THAI_PO_INVOICE: Record<string, { label: string; color: string }> = {
  nhap:           { label: 'Nháp',              color: 'default' },
  da_tt_mot_phan: { label: 'TT 1 phần',         color: 'orange' },
  da_tt_du:       { label: 'Đã thanh toán đủ',  color: 'green' },
  qua_han:        { label: 'Quá hạn',           color: 'red' },
  huy:            { label: 'Đã hủy',            color: 'default' },
}

// ──────────────────────────────────────────────────────
// Interfaces — Phiếu thu
// ──────────────────────────────────────────────────────

export interface CashReceipt {
  id: number
  so_phieu: string
  ngay_phieu: string
  customer_id: number
  ten_don_vi?: string | null
  sales_invoice_id: number | null
  hinh_thuc_tt: string
  so_tai_khoan: string | null
  so_tham_chieu: string | null
  dien_giai: string | null
  so_tien: number
  tk_no: string
  tk_co: string
  trang_thai: string
  phap_nhan_id: number | null
  nguoi_duyet_id: number | null
  ngay_duyet: string | null
  created_at: string
}

export interface CashReceiptCreate {
  customer_id: number
  sales_invoice_id?: number
  phap_nhan_id?: number | null
  ngay_phieu: string
  hinh_thuc_tt?: string
  so_tai_khoan?: string
  so_tham_chieu?: string
  dien_giai?: string
  so_tien: number
  tk_no?: string
  tk_co?: string
}

// ──────────────────────────────────────────────────────
// Interfaces — Hóa đơn mua hàng
// ──────────────────────────────────────────────────────

export interface CashPaymentShort {
  id: number
  so_phieu: string
  ngay_phieu: string
  so_tien: number
  hinh_thuc_tt: string
  trang_thai: string
}

export interface PurchaseInvoice {
  id: number
  so_hoa_don: string | null
  mau_so: string | null
  ky_hieu: string | null
  ngay_lap: string
  ngay_hoa_don: string | null
  han_tt: string | null
  supplier_id: number
  po_id: number | null
  gr_id: number | null
  phap_nhan_id?: number | null
  phan_xuong_id?: number | null
  ten_don_vi: string | null
  ma_so_thue: string | null
  co_vat: boolean
  thue_suat: number
  tong_tien_hang: number
  tien_thue: number
  tong_thanh_toan: number
  da_thanh_toan: number
  con_lai: number
  trang_thai: string
  ghi_chu: string | null
  payments: CashPaymentShort[]
  created_at: string
  updated_at: string
}

export interface PurchaseInvoiceCreate {
  supplier_id: number
  po_id?: number
  gr_id?: number
  so_hoa_don?: string
  mau_so?: string
  ky_hieu?: string
  ngay_lap: string
  ngay_hoa_don?: string
  han_tt?: string
  co_vat?: boolean
  thue_suat?: number
  tong_tien_hang: number
  ghi_chu?: string
}

// ──────────────────────────────────────────────────────
// Interfaces — Phiếu chi
// ──────────────────────────────────────────────────────

export interface CashPayment {
  id: number
  so_phieu: string
  ngay_phieu: string
  supplier_id: number
  ten_don_vi?: string | null
  purchase_invoice_id: number | null
  so_hoa_don?: string | null
  hinh_thuc_tt: string
  so_tai_khoan: string | null
  so_tham_chieu: string | null
  dien_giai: string | null
  so_tien: number
  tk_no: string
  tk_co: string
  trang_thai: string
  phap_nhan_id: number | null
  phan_xuong_id?: number | null
  nguoi_duyet_id: number | null
  ngay_duyet: string | null
  created_at: string
}

export interface CashPaymentCreate {
  supplier_id: number
  purchase_invoice_id?: number
  phap_nhan_id?: number | null
  phan_xuong_id?: number | null
  ngay_phieu: string
  hinh_thuc_tt?: string
  so_tai_khoan?: string
  so_tham_chieu?: string
  dien_giai?: string
  so_tien: number
  tk_no?: string
  tk_co?: string
}

// ──────────────────────────────────────────────────────
// Interfaces — Báo cáo
// ──────────────────────────────────────────────────────

export interface ARLedgerRow {
  invoice_id: number
  so_hoa_don: string | null
  ngay_hoa_don: string
  han_tt: string | null
  customer_id: number
  ten_don_vi: string | null
  tong_cong: number
  da_thanh_toan: number
  con_lai: number
  so_ngay_qua_han: number
  trang_thai: string
  phap_nhan_id: number | null
}

export interface ARLedgerEntryRow {
  id: number
  ngay: string
  customer_id: number | null
  ten_don_vi: string | null
  chung_tu_loai: string | null
  chung_tu_id: number | null
  so_chung_tu: string | null
  dien_giai: string | null
  phat_sinh_no: number
  phat_sinh_co: number
  so_du: number
}

export interface ARLedgerEntries {
  tu_ngay: string
  den_ngay: string
  customer_id: number | null
  so_du_dau_ky: number
  phat_sinh_no: number
  phat_sinh_co: number
  so_du_cuoi_ky: number
  rows: ARLedgerEntryRow[]
}

export interface ARAgingRow {
  customer_id: number
  ten_don_vi: string | null
  tong_con_lai: number
  trong_han: number
  qua_han_30: number
  qua_han_60: number
  qua_han_90: number
}

export interface APLedgerRow {
  invoice_id: number
  so_hoa_don: string | null
  ngay_lap: string
  han_tt: string | null
  supplier_id: number
  ten_don_vi: string | null
  tong_thanh_toan: number
  da_thanh_toan: number
  con_lai: number
  so_ngay_qua_han: number
  trang_thai: string
  phap_nhan_id: number | null
}

export interface APAgingRow {
  supplier_id: number
  ten_don_vi: string | null
  tong_con_lai: number
  trong_han: number
  qua_han_30: number
  qua_han_60: number
  qua_han_90: number
}

export interface BalanceByPeriod {
  so_du_dau_ky: number
  phat_sinh_tang: number
  phat_sinh_giam: number
  so_du_cuoi_ky: number
}

export interface DebtOverdueAlertItem {
  doi_tuong: 'khach_hang' | 'nha_cung_cap'
  doi_tuong_id: number
  ten_don_vi: string | null
  tong_con_lai: number
  qua_han: number
  qua_han_30: number
  qua_han_60: number
  qua_han_90: number
}

export interface DebtOverdueAlerts {
  as_of_date: string
  phap_nhan_id: number | null
  ar: { count: number; total_overdue: number; items: DebtOverdueAlertItem[] }
  ap: { count: number; total_overdue: number; items: DebtOverdueAlertItem[] }
}

// ──────────────────────────────────────────────────────
// API calls — Phiếu thu (AR)
// ──────────────────────────────────────────────────────

export const receiptApi = {
  list: (params?: Record<string, unknown>) =>
    client.get('/accounting/receipts', { params }).then(r => r.data),

  get: (id: number): Promise<CashReceipt> =>
    client.get(`/accounting/receipts/${id}`).then(r => r.data),

  create: (data: CashReceiptCreate): Promise<CashReceipt> =>
    client.post('/accounting/receipts', data).then(r => r.data),

  approve: (id: number): Promise<CashReceipt> =>
    client.patch(`/accounting/receipts/${id}/approve`).then(r => r.data),

  cancel: (id: number): Promise<CashReceipt> =>
    client.patch(`/accounting/receipts/${id}/cancel`).then(r => r.data),
}

// ──────────────────────────────────────────────────────
// API calls — Hóa đơn mua hàng
// ──────────────────────────────────────────────────────

export const purchaseInvoiceApi = {
  list: (params?: Record<string, unknown>) =>
    client.get('/accounting/purchase-invoices', { params }).then(r => r.data),

  get: (id: number): Promise<PurchaseInvoice> =>
    client.get(`/accounting/purchase-invoices/${id}`).then(r => r.data),

  create: (data: PurchaseInvoiceCreate): Promise<PurchaseInvoice> =>
    client.post('/accounting/purchase-invoices', data).then(r => r.data),

  fromPO: (poId: number, params?: { thue_suat?: number; co_vat?: boolean }): Promise<PurchaseInvoice> =>
    client.post(`/accounting/purchase-invoices/from-po/${poId}`, null, { params }).then(r => r.data),

  fromGR: (grId: number, params?: { thue_suat?: number; co_vat?: boolean }): Promise<PurchaseInvoice> =>
    client.post(`/accounting/purchase-invoices/from-gr/${grId}`, null, { params }).then(r => r.data),
}

// ──────────────────────────────────────────────────────
// API calls — Phiếu chi (AP)
// ──────────────────────────────────────────────────────

export const paymentApi = {
  list: (params?: Record<string, unknown>) =>
    client.get('/accounting/payments', { params }).then(r => r.data),

  get: (id: number): Promise<CashPayment> =>
    client.get(`/accounting/payments/${id}`).then(r => r.data),

  create: (data: CashPaymentCreate): Promise<CashPayment> =>
    client.post('/accounting/payments', data).then(r => r.data),

  approve: (id: number): Promise<CashPayment> =>
    client.patch(`/accounting/payments/${id}/approve`).then(r => r.data),

  cancel: (id: number): Promise<CashPayment> =>
    client.patch(`/accounting/payments/${id}/cancel`).then(r => r.data),
}

// ──────────────────────────────────────────────────────
// API calls — Sổ công nợ & Báo cáo
// ──────────────────────────────────────────────────────

export const arApi = {
  getLedger: (params?: Record<string, unknown>): Promise<ARLedgerRow[]> =>
    client.get('/accounting/ar/ledger', { params }).then(r => r.data),

  getLedgerEntries: (params?: Record<string, unknown>): Promise<ARLedgerEntries> =>
    client.get('/accounting/ar/ledger-entries', { params }).then(r => r.data),

  getAging: (asOfDate?: string, phapNhanId?: number): Promise<ARAgingRow[]> =>
    client.get('/accounting/ar/aging', { params: { ...(asOfDate ? { as_of_date: asOfDate } : {}), ...(phapNhanId ? { phap_nhan_id: phapNhanId } : {}) } }).then(r => r.data),

  getBalance: (params: { customer_id?: number; tu_ngay: string; den_ngay: string }): Promise<BalanceByPeriod> =>
    client.get('/accounting/ar/balance', { params }).then(r => r.data),

  getReconciliation: (customerId: number, params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number }) =>
    client.get(`/accounting/ar/reconciliation/${customerId}`, { params }).then(r => r.data),

  getGeneralLedger: (params: { so_tk: string; tu_ngay: string; den_ngay: string; phap_nhan_id?: number | null; phan_xuong_id?: number | null }) =>
    client.get('/accounting/general-ledger', { params }).then(r => r.data),

  getTrialBalance: (params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number | null; phan_xuong_id?: number | null }) =>
    client.get('/accounting/trial-balance', { params }).then(r => r.data),

  getPnl: (params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number | null; phan_xuong_id?: number | null }) =>
    client.get('/accounting/reports/pnl', { params }).then(r => r.data),

  getBalanceSheet: (params: { ngay: string; phap_nhan_id?: number | null }) =>
    client.get('/accounting/reports/balance-sheet', { params }).then(r => r.data),

  exportTrialBalance: (params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number | null; phan_xuong_id?: number | null }) =>
    client.get('/accounting/trial-balance/export', { params, responseType: 'blob' }).then(r => r.data as Blob),
}

export const debtAlertsApi = {
  getOverdue: (params?: { as_of_date?: string; phap_nhan_id?: number; limit?: number }): Promise<DebtOverdueAlerts> =>
    client.get('/accounting/debt/overdue-alerts', { params }).then(r => r.data),
}

export interface SoChiTietRow {
  ngay: string
  chung_tu_loai: string
  chung_tu_id: number | null
  supplier_id: number | null
  ten_ncc: string | null
  dien_giai: string | null
  phat_sinh_no: number
  phat_sinh_co: number
  so_du: number
}

export interface SoChiTietResponse {
  tu_ngay: string
  den_ngay: string
  supplier_id: number | null
  so_du_dau_ky: number
  so_du_cuoi_ky: number
  rows: SoChiTietRow[]
}

export interface DoiChieuPhaiTraRow {
  supplier_id: number
  ten_ncc: string
  ma_ncc: string
  so_phieu_gr: number
  tong_gia_tri_gr: number
  so_hoa_don: number
  tong_gia_tri_hd: number
  chenh_lech: number
}

export const apApi = {
  getLedger: (params?: Record<string, unknown>): Promise<APLedgerRow[]> =>
    client.get('/accounting/ap/ledger', { params }).then(r => r.data),

  getAging: (asOfDate?: string, phapNhanId?: number): Promise<APAgingRow[]> =>
    client.get('/accounting/ap/aging', { params: { ...(asOfDate ? { as_of_date: asOfDate } : {}), ...(phapNhanId ? { phap_nhan_id: phapNhanId } : {}) } }).then(r => r.data),

  getBalance: (params: { supplier_id?: number; tu_ngay: string; den_ngay: string }): Promise<BalanceByPeriod> =>
    client.get('/accounting/ap/balance', { params }).then(r => r.data),

  getSoChiTiet: (params: { supplier_id?: number; tu_ngay: string; den_ngay: string }): Promise<SoChiTietResponse> =>
    client.get('/accounting/purchase/so-chi-tiet', { params }).then(r => r.data),

  getReconciliation: (supplierId: number, params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number }) =>
    client.get(`/accounting/ap/reconciliation/${supplierId}`, { params }).then(r => r.data),

  doiChieuPhaiTra: (params?: {
    supplier_id?: number
    tu_ngay?: string
    den_ngay?: string
    phap_nhan_id?: number
  }): Promise<DoiChieuPhaiTraRow[]> =>
    client.get('/accounting/ap/doi-chieu-phai-tra', { params }).then(r => r.data),
}

// ──────────────────────────────────────────────────────
// API calls — Số dư đầu kỳ
// ──────────────────────────────────────────────────────

export const openingBalanceApi = {
  create: (data: {
    ky_mo_so: string
    doi_tuong: string
    customer_id?: number
    supplier_id?: number
    so_du_dau_ky: number
    ghi_chu?: string
  }) => client.post('/accounting/opening-balances', data).then(r => r.data),

  downloadTemplateAR: () =>
    client.get('/accounting/opening-balances/template-ar', { responseType: 'blob' }),

  downloadTemplateAP: () =>
    client.get('/accounting/opening-balances/template-ap', { responseType: 'blob' }),

  downloadTemplateCash: () =>
    client.get('/accounting/opening-balances/cash/import-template', { responseType: 'blob' }),

  importAR: (file: File, commit: boolean) => {
    const fd = new FormData(); fd.append('file', file)
    return client.post(`/accounting/opening-balances/import-ar?commit=${commit}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },

  importAP: (file: File, commit: boolean) => {
    const fd = new FormData(); fd.append('file', file)
    return client.post(`/accounting/opening-balances/import-ap?commit=${commit}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },

  importCash: (file: File, commit: boolean) => {
    const fd = new FormData(); fd.append('file', file)
    return client.post(`/accounting/opening-balances/cash/import?commit=${commit}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },
}

// ──────────────────────────────────────────────────────
// Phiếu hoàn tiền khách hàng
// ──────────────────────────────────────────────────────

export interface CustomerRefundVoucher {
  id: number
  so_phieu: string
  ngay: string
  customer_id: number
  ten_khach_hang: string | null
  sales_return_id: number
  so_phieu_tra: string | null
  sales_invoice_id: number | null
  so_tien: number
  hinh_thuc: string | null      // "bu_tru" | "hoan_tien"
  tk_hoan_tien: string | null   // "111" | "112"
  dien_giai: string | null
  trang_thai: string             // "nhap" | "da_duyet" | "huy"
  nguoi_duyet_id: number | null
  ngay_duyet: string | null
  created_by: number | null
  created_at: string
}

export const TRANG_THAI_HOAN_TIEN: Record<string, { label: string; color: string }> = {
  nhap:      { label: 'Nháp',       color: 'default' },
  da_duyet:  { label: 'Đã duyệt',   color: 'green' },
  huy:       { label: 'Đã hủy',     color: 'default' },
}

export const customerRefundApi = {
  list: (params?: Record<string, unknown>) =>
    client.get('/accounting/customer-refunds', { params }).then(r => r.data),

  get: (id: number): Promise<CustomerRefundVoucher> =>
    client.get(`/accounting/customer-refunds/${id}`).then(r => r.data),

  update: (id: number, data: { hinh_thuc?: string; tk_hoan_tien?: string; dien_giai?: string }): Promise<CustomerRefundVoucher> =>
    client.patch(`/accounting/customer-refunds/${id}`, data).then(r => r.data),

  approve: (id: number): Promise<CustomerRefundVoucher> =>
    client.patch(`/accounting/customer-refunds/${id}/approve`).then(r => r.data),

  cancel: (id: number): Promise<CustomerRefundVoucher> =>
    client.patch(`/accounting/customer-refunds/${id}/cancel`).then(r => r.data),
}

// ──────────────────────────────────────────────────────
// Quản trị Phân xưởng & Chi phí
// ──────────────────────────────────────────────────────

export interface WorkshopPayroll {
  id: number
  so_phieu: string
  thang: string
  phan_xuong_id: number
  phap_nhan_id: number | null
  tong_luong: number
  tong_thuong: number
  tong_bao_hiem: number
  ghi_chu: string | null
  trang_thai: string
  created_at: string
}

export interface FixedAsset {
  id: number
  ma_ts: string
  ten_ts: string
  ngay_mua: string
  nguyen_gia: number
  so_thang_khau_hao: number
  da_khau_hao_thang: number
  gia_tri_da_khau_hao: number
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  trang_thai: string
}

// ──────────────────────────────────────────────────────
// Interfaces — Workshop Management
// ──────────────────────────────────────────────────────

export interface WorkshopPayrollCreate {
  thang: string
  phan_xuong_id: number
  phap_nhan_id: number
  tong_luong: number
  bo_qua_hach_toan?: boolean
}

export interface FixedAssetCreate {
  ma_ts: string
  ten_ts: string
  nguyen_gia: number
  thoi_gian_khau_hao: number
  ngay_mua: string
  phan_xuong_id: number
  phap_nhan_id: number
  bo_qua_hach_toan?: boolean
}

export interface AllocateOverheadPayload {
  tu_ngay: string
  den_ngay: string
  so_tk: string
  phap_nhan_id: number
  allocations: { phan_xuong_id: number; ty_le: number }[]
}

// ──────────────────────────────────────────────────────
// Interfaces — Journal Entry
// ──────────────────────────────────────────────────────

export interface JournalLine {
  so_tk: string
  dien_giai?: string
  so_tien_no: number
  so_tien_co: number
  phan_xuong_id?: number | null
  phap_nhan_id?: number | null
}

export interface JournalEntryCreate {
  ngay_but_toan: string
  dien_giai: string
  loai_but_toan: string
  phap_nhan_id?: number | null
  phan_xuong_id?: number | null
  tong_no: number
  tong_co: number
  lines: JournalLine[]
}

export interface JournalEntryListParams {
  tu_ngay?: string
  den_ngay?: string
  phap_nhan_id?: number
  chung_tu_loai?: string
  chung_tu_id?: number
  page?: number
  page_size?: number
}

export interface AccountingAuditLog {
  id: number
  user_id: number | null
  hanh_dong: string
  bang: string
  ban_ghi_id: string | null
  du_lieu_cu: Record<string, unknown> | null
  du_lieu_moi: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AccountingAuditLogParams {
  bang?: string
  ban_ghi_id?: string
  user_id?: number
  tu_ngay?: string
  den_ngay?: string
  page?: number
  page_size?: number
}

export interface AccountingAuditLogResponse {
  total: number
  page: number
  page_size: number
  items: AccountingAuditLog[]
}

export interface TrialBalanceRow {
  so_tk: string
  ten_tk: string
  so_du_dau: number
  phat_sinh_no: number
  phat_sinh_co: number
  so_du_cuoi: number
}

export const workshopManagementApi = {
  // Bảng lương
  listPayroll: (params?: Record<string, unknown>) => client.get<WorkshopPayroll[]>('/accounting/workshop-payroll', { params }).then(r => r.data),
  createPayroll: (data: WorkshopPayrollCreate) => client.post<WorkshopPayroll>('/accounting/workshop-payroll', data).then(r => r.data),
  approvePayroll: (id: number) => client.patch(`/accounting/workshop-payroll/${id}/approve`).then(r => r.data),

  // Tài sản & Khấu hao
  listAssets: (params?: Record<string, unknown>) => client.get<FixedAsset[]>('/accounting/fixed-assets', { params }).then(r => r.data),
  createAsset: (data: FixedAssetCreate) => client.post<FixedAsset>('/accounting/fixed-assets', data).then(r => r.data),
  runDepreciation: (params: { thang: number; nam: number; phap_nhan_id: number }) =>
    client.post('/accounting/fixed-assets/run-depreciation', null, { params }).then(r => r.data),

  // Phân bổ chi phí
  allocateOverhead: (data: AllocateOverheadPayload) => client.post('/accounting/allocate-overhead', data).then(r => r.data),
}

export const journalApi = {
  list: (params?: JournalEntryListParams) => client.get('/accounting/journal-entries', { params }).then(r => r.data),
  create: (data: JournalEntryCreate) => client.post('/accounting/journal-entries', data).then(r => r.data),
}

export const accountingAuditApi = {
  list: (params?: AccountingAuditLogParams): Promise<AccountingAuditLogResponse> =>
    client.get('/accounting/audit-logs', { params }).then(r => r.data),
  document: (bang: string, banGhiId: string | number): Promise<AccountingAuditLog[]> =>
    client.get(`/accounting/documents/${bang}/${banGhiId}/audit`).then(r => r.data),
}

export interface ProductionCostInput {
  id: number
  source_type: string
  source_table: string | null
  source_id: number | null
  production_order_id: number | null
  product_id: number | null
  so_tien: number
  so_luong: number | null
  dien_giai: string | null
}

export interface ProductionCostAllocation {
  id?: number
  production_order_id: number | null
  product_id: number | null
  san_luong: number
  ty_le: number
  chi_phi_nvl: number
  chi_phi_nhan_cong: number
  chi_phi_sxc: number
  tong_chi_phi: number
  gia_thanh_don_vi: number
}

export interface ProductionCostPeriod {
  id: number
  ma_ky: string
  ten_ky: string
  tu_ngay: string
  den_ngay: string
  phap_nhan_id: number | null
  phan_xuong_id: number | null
  tieu_thuc_pb: string
  trang_thai: string
  tong_nvl: number
  tong_nhan_cong: number
  tong_sxc: number
  tong_chi_phi: number
  tong_san_luong: number
  ghi_chu: string | null
  created_at: string
  closed_at: string | null
  inputs?: ProductionCostInput[]
  allocations?: ProductionCostAllocation[]
}

export interface ProductionCostPeriodCreate {
  ma_ky?: string
  ten_ky?: string
  tu_ngay: string
  den_ngay: string
  phap_nhan_id?: number | null
  phan_xuong_id?: number | null
  tieu_thuc_pb?: string
  ghi_chu?: string | null
}

export interface ProductionCostPreview {
  period: ProductionCostPeriod
  allocations: ProductionCostAllocation[]
  warnings: string[]
  unallocated_cost: number
}

export const productionCostApi = {
  list: (params?: { phap_nhan_id?: number; phan_xuong_id?: number; trang_thai?: string }) =>
    client.get<ProductionCostPeriod[]>('/accounting/production-cost-periods', { params }).then(r => r.data),
  create: (data: ProductionCostPeriodCreate) =>
    client.post<ProductionCostPeriod>('/accounting/production-cost-periods', data).then(r => r.data),
  get: (id: number) =>
    client.get<ProductionCostPeriod>(`/accounting/production-cost-periods/${id}`).then(r => r.data),
  collectInputs: (id: number) =>
    client.post<{ created_inputs: number; period: ProductionCostPeriod }>(`/accounting/production-cost-periods/${id}/collect-inputs`).then(r => r.data),
  preview: (id: number) =>
    client.get<ProductionCostPreview>(`/accounting/production-cost-periods/${id}/allocation-preview`).then(r => r.data),
  calculate: (id: number) =>
    client.post<ProductionCostPeriod>(`/accounting/production-cost-periods/${id}/calculate`).then(r => r.data),
  close: (id: number) =>
    client.post<ProductionCostPeriod>(`/accounting/production-cost-periods/${id}/close`).then(r => r.data),
}
