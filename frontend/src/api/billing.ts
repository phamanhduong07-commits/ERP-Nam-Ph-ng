import client from './client'

// ──────────────────────────────────────────────────────
// Constants / Labels
// ──────────────────────────────────────────────────────

export const TRANG_THAI_INVOICE: Record<string, { label: string; color: string }> = {
  nhap:            { label: 'Nháp',              color: 'default' },
  da_phat_hanh:    { label: 'Đã phát hành',      color: 'blue' },
  da_tt_mot_phan:  { label: 'Thanh toán 1 phần', color: 'orange' },
  da_tt_du:        { label: 'Đã thanh toán đủ',  color: 'green' },
  qua_han:         { label: 'Quá hạn',           color: 'red' },
  huy:             { label: 'Đã hủy',            color: 'default' },
}

export const HINH_THUC_TT: Record<string, string> = {
  TM:    'Tiền mặt',
  CK:    'Chuyển khoản',
  'TM+CK': 'TM + CK',
}

export const VAT_OPTIONS = [
  { label: '0%',  value: 0 },
  { label: '5%',  value: 5 },
  { label: '8%',  value: 8 },
  { label: '10%', value: 10 },
]

// ──────────────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────────────

export interface CashReceiptShort {
  id: number
  so_phieu: string
  ngay_phieu: string
  so_tien: number
  hinh_thuc_tt: string
  trang_thai: string
}

export interface InvoiceAdjustmentLog {
  id: number
  invoice_id: number
  adjusted_by_id: number
  adjusted_by_name: string | null
  adjusted_at: string
  loai: 'truoc_ket_chuyen' | 'sau_ket_chuyen'
  ghi_chu: string
  trang_thai: 'na' | 'pending' | 'approved' | 'rejected'
  approved_by_id: number | null
  approved_by_name: string | null
  approved_at: string | null
  du_lieu_truoc: string | null   // JSON string
  du_lieu_sau: string | null     // JSON string
}

export interface SalesInvoice {
  id: number
  so_hoa_don: string | null
  mau_so: string | null
  ky_hieu: string | null
  ngay_hoa_don: string
  han_tt: string | null
  customer_id: number
  delivery_id: number | null
  sales_order_id: number | null
  phap_nhan_id: number | null
  phap_nhan_ten: string | null
  ten_don_vi: string | null
  dia_chi: string | null
  ma_so_thue: string | null
  nguoi_mua_hang: string | null
  hinh_thuc_tt: string
  tong_tien_hang: number
  ty_le_vat: number
  tien_vat: number
  tong_cong: number
  da_thanh_toan: number
  con_lai: number
  trang_thai: string
  anh_phieu_giao: string | null
  ghi_chu: string | null
  receipts: CashReceiptShort[]
  adjustment_logs: InvoiceAdjustmentLog[]
  created_at: string
  updated_at: string
}

export interface SalesInvoiceListItem {
  id: number
  so_hoa_don: string | null
  ngay_hoa_don: string
  han_tt: string | null
  customer_id: number
  ten_don_vi: string | null
  tong_cong: number
  da_thanh_toan: number
  con_lai: number
  trang_thai: string
  delivery_id: number | null
  sales_order_id: number | null
  phap_nhan_id: number | null
  phap_nhan?: { ten_phap_nhan?: string | null } | null
}

export interface SalesInvoiceCreate {
  customer_id: number
  delivery_id?: number
  sales_order_id?: number
  phap_nhan_id?: number
  ngay_hoa_don: string
  han_tt?: string
  mau_so?: string
  ky_hieu?: string
  ten_don_vi?: string
  dia_chi?: string
  ma_so_thue?: string
  nguoi_mua_hang?: string
  hinh_thuc_tt?: string
  tong_tien_hang: number
  ty_le_vat?: number
  ghi_chu?: string
}

export interface SalesInvoiceUpdate {
  han_tt?: string
  mau_so?: string
  ky_hieu?: string
  ten_don_vi?: string
  dia_chi?: string
  ma_so_thue?: string
  nguoi_mua_hang?: string
  hinh_thuc_tt?: string
  tong_tien_hang?: number
  ty_le_vat?: number
  ghi_chu?: string
  ghi_chu_dieu_chinh?: string
}

export interface AdjustmentRequest {
  tong_tien_hang: number
  ty_le_vat: number
  ghi_chu_dieu_chinh: string
}

export interface AdjustmentApprove {
  approved: boolean
  ghi_chu?: string
}

export interface AdjustmentLogFilter {
  trang_thai?: string
  customer_id?: number
  tu_ngay?: string
  den_ngay?: string
}

// ──────────────────────────────────────────────────────
// API calls
// ──────────────────────────────────────────────────────

export const billingApi = {
  listInvoices: (params?: Record<string, unknown>) =>
    client.get('/billing/invoices', { params }).then(r => r.data),

  getInvoice: (id: number): Promise<SalesInvoice> =>
    client.get(`/billing/invoices/${id}`).then(r => r.data),

  createInvoice: (data: SalesInvoiceCreate): Promise<SalesInvoice> =>
    client.post('/billing/invoices', data).then(r => r.data),

  updateInvoice: (id: number, data: SalesInvoiceUpdate): Promise<SalesInvoice> =>
    client.put(`/billing/invoices/${id}`, data).then(r => r.data),

  issueInvoice: (id: number): Promise<SalesInvoice> =>
    client.patch(`/billing/invoices/${id}/issue`).then(r => r.data),

  cancelInvoice: (id: number): Promise<SalesInvoice> =>
    client.patch(`/billing/invoices/${id}/cancel`).then(r => r.data),

  createFromDelivery: (deliveryId: number, tyLeVat: number = 10): Promise<SalesInvoice> =>
    client.post(`/billing/invoices/from-delivery/${deliveryId}`, null, {
      params: { ty_le_vat: tyLeVat },
    }).then(r => r.data),

  createFromOrder: (orderId: number): Promise<SalesInvoice> =>
    client.post(`/billing/invoices/from-order/${orderId}`).then(r => r.data),

  uploadPhoto: (id: number, file: File): Promise<SalesInvoice> => {
    const form = new FormData()
    form.append('file', file)
    return client.post(`/billing/invoices/${id}/upload-photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  requestAdjustment: (id: number, data: AdjustmentRequest) =>
    client.post(`/billing/invoices/${id}/request-adjustment`, data).then(r => r.data),

  approveAdjustment: (logId: number, data: AdjustmentApprove) =>
    client.patch(`/billing/adjustment-logs/${logId}/approve`, data).then(r => r.data),

  listAdjustmentLogs: (params?: AdjustmentLogFilter): Promise<InvoiceAdjustmentLog[]> =>
    client.get('/billing/adjustment-logs', { params }).then(r => r.data),

  printAdjustmentLog: (logId: number) =>
    `/api/billing/adjustment-logs/${logId}/print`,
}
