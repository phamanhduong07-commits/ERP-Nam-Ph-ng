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
  sales_invoice_id: number | null
  hinh_thuc_tt: string
  so_tai_khoan: string | null
  so_tham_chieu: string | null
  dien_giai: string | null
  so_tien: number
  tk_no: string
  tk_co: string
  trang_thai: string
  nguoi_duyet_id: number | null
  ngay_duyet: string | null
  created_at: string
}

export interface CashReceiptCreate {
  customer_id: number
  sales_invoice_id?: number
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
  ten_don_vi: string | null
  ma_so_thue: string | null
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
  purchase_invoice_id: number | null
  hinh_thuc_tt: string
  so_tai_khoan: string | null
  so_tham_chieu: string | null
  dien_giai: string | null
  so_tien: number
  tk_no: string
  tk_co: string
  trang_thai: string
  nguoi_duyet_id: number | null
  ngay_duyet: string | null
  created_at: string
}

export interface CashPaymentCreate {
  supplier_id: number
  purchase_invoice_id?: number
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

  fromPO: (poId: number): Promise<PurchaseInvoice> =>
    client.post(`/accounting/purchase-invoices/from-po/${poId}`).then(r => r.data),

  fromGR: (grId: number): Promise<PurchaseInvoice> =>
    client.post(`/accounting/purchase-invoices/from-gr/${grId}`).then(r => r.data),
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

  getAging: (asOfDate?: string): Promise<ARAgingRow[]> =>
    client.get('/accounting/ar/aging', { params: asOfDate ? { as_of_date: asOfDate } : {} }).then(r => r.data),

  getBalance: (params: { customer_id?: number; tu_ngay: string; den_ngay: string }): Promise<BalanceByPeriod> =>
    client.get('/accounting/ar/balance', { params }).then(r => r.data),

  getReconciliation: (customerId: number, params: { tu_ngay: string; den_ngay: string }) =>
    client.get(`/accounting/ar/reconciliation/${customerId}`, { params }).then(r => r.data),

  getGeneralLedger: (params: { so_tk: string; tu_ngay: string; den_ngay: string; phap_nhan_id?: number | null; phan_xuong_id?: number | null }) =>
    client.get('/accounting/general-ledger', { params }).then(r => r.data),

  getTrialBalance: (params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number | null; phan_xuong_id?: number | null }) =>
    client.get('/accounting/trial-balance', { params }).then(r => r.data),

  getPnl: (params: { tu_ngay: string; den_ngay: string; phap_nhan_id?: number | null; phan_xuong_id?: number | null }) =>
    client.get('/accounting/reports/pnl', { params }).then(r => r.data),

  getBalanceSheet: (params: { ngay: string; phap_nhan_id?: number | null }) =>
    client.get('/accounting/reports/balance-sheet', { params }).then(r => r.data),
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

export const apApi = {
  getLedger: (params?: Record<string, unknown>): Promise<APLedgerRow[]> =>
    client.get('/accounting/ap/ledger', { params }).then(r => r.data),

  getAging: (asOfDate?: string): Promise<APAgingRow[]> =>
    client.get('/accounting/ap/aging', { params: asOfDate ? { as_of_date: asOfDate } : {} }).then(r => r.data),

  getBalance: (params: { supplier_id?: number; tu_ngay: string; den_ngay: string }): Promise<BalanceByPeriod> =>
    client.get('/accounting/ap/balance', { params }).then(r => r.data),

  getSoChiTiet: (params: { supplier_id?: number; tu_ngay: string; den_ngay: string }): Promise<SoChiTietResponse> =>
    client.get('/accounting/purchase/so-chi-tiet', { params }).then(r => r.data),

  getReconciliation: (supplierId: number, params: { tu_ngay: string; den_ngay: string }) =>
    client.get(`/accounting/ap/reconciliation/${supplierId}`, { params }).then(r => r.data),
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

export const workshopManagementApi = {
  // Bảng lương
  listPayroll: (params?: any) => client.get('/accounting/workshop-payroll', { params }).then(r => r.data),
  createPayroll: (data: any) => client.post('/accounting/workshop-payroll', data).then(r => r.data),
  approvePayroll: (id: number) => client.patch(`/accounting/workshop-payroll/${id}/approve`).then(r => r.data),

  // Tài sản & Khấu hao
  listAssets: (params?: any) => client.get('/accounting/fixed-assets', { params }).then(r => r.data),
  createAsset: (data: any) => client.post('/accounting/fixed-assets', data).then(r => r.data),
  runDepreciation: (params: { thang: number; nam: number; phap_nhan_id: number }) => 
    client.post('/accounting/fixed-assets/run-depreciation', null, { params }).then(r => r.data),

  // Phân bổ chi phí
  allocateOverhead: (data: any) => client.post('/accounting/allocate-overhead', data).then(r => r.data),
}

export const journalApi = {
  list: (params?: any) => client.get('/accounting/journal-entries', { params }).then(r => r.data),
  create: (data: any) => client.post('/accounting/journal-entries', data).then(r => r.data),
}
