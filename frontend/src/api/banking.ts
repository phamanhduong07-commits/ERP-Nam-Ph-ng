import client from './client'

export interface BankAccount {
  id: number
  ma_tk: string
  ten_ngan_hang: string
  so_tai_khoan: string
  phap_nhan_id?: number | null
  phap_nhan_ten?: string | null
  chu_tai_khoan: string | null
  chi_nhanh: string | null
  swift_code: string | null
  so_du_dau: number
  ghi_chu: string | null
  trang_thai: boolean
  created_at: string
}

export interface BankAccountCreate {
  ma_tk: string
  ten_ngan_hang: string
  so_tai_khoan: string
  phap_nhan_id?: number | null
  chu_tai_khoan?: string
  chi_nhanh?: string
  swift_code?: string
  so_du_dau?: number
  ghi_chu?: string
}

export interface BankAccountUpdate extends Partial<BankAccountCreate> {
  trang_thai?: boolean
}

export interface LedgerEntry {
  ngay: string
  so_chung_tu: string
  chung_tu_id?: number
  loai: 'thu' | 'chi'
  doi_tuong: string | null
  dien_giai: string | null
  so_tham_chieu?: string | null
  tk_no?: string | null
  tk_co?: string | null
  thu: number
  chi: number
  so_du: number
}

export interface LedgerResponse {
  so_du_dau: number
  tong_thu: number
  tong_chi: number
  so_du_cuoi: number
  entries: LedgerEntry[]
}

export interface BankTransaction {
  id: number
  ngay_giao_dich: string
  so_tai_khoan: string
  so_tham_chieu: string | null
  mo_ta: string | null
  thu: number
  chi: number
  trang_thai: 'chua_doi_soat' | 'da_doi_soat' | 'bo_qua' | string
  matched_chung_tu_loai?: string | null
  matched_chung_tu_id?: number | null
}

export interface BankReconcileCandidate {
  chung_tu_loai: string
  chung_tu_id: number
  so_chung_tu: string
  ngay: string
  doi_tuong: string | null
  dien_giai: string | null
  so_tien: number
}

export const bankAccountsApi = {
  list: (params?: { search?: string; trang_thai?: boolean; phap_nhan_id?: number | null }) =>
    client.get<BankAccount[]>('/bank-accounts', { params }),

  create: (data: BankAccountCreate) =>
    client.post<BankAccount>('/bank-accounts', data),

  update: (id: number, data: BankAccountUpdate) =>
    client.put<BankAccount>(`/bank-accounts/${id}`, data),

  delete: (id: number) =>
    client.delete(`/bank-accounts/${id}`),
}

export const bankLedgerApi = {
  getCashBook: (tu_ngay: string, den_ngay: string, phap_nhan_id?: number, phan_xuong_id?: number) =>
    client.get<LedgerResponse>('/accounting/cash-book', {
      params: { tu_ngay, den_ngay, phap_nhan_id, phan_xuong_id },
    }),

  getBankLedger: (tu_ngay: string, den_ngay: string, so_tai_khoan?: string, phap_nhan_id?: number, phan_xuong_id?: number) =>
    client.get<LedgerResponse>('/accounting/bank-ledger', {
      params: { tu_ngay, den_ngay, so_tai_khoan, phap_nhan_id, phan_xuong_id },
    }),
}

export const bankTransactionsApi = {
  list: (params?: {
    tu_ngay?: string
    den_ngay?: string
    phap_nhan_id?: number
    bank_account_id?: number
    trang_thai?: string
    page?: number
    page_size?: number
  }) => client.get<{ total: number; items: BankTransaction[] }>('/accounting/bank-transactions', { params })
    .then(r => r.data),

  candidates: (id: number) =>
    client.get<BankReconcileCandidate[]>(`/accounting/bank-transactions/${id}/candidates`)
      .then(r => r.data),

  reconcile: (id: number, data: { chung_tu_loai: string; chung_tu_id: number }) =>
    client.post(`/accounting/bank-transactions/${id}/reconcile`, data),

  unreconcile: (id: number) =>
    client.post(`/accounting/bank-transactions/${id}/unreconcile`),

  ignore: (id: number) =>
    client.post(`/accounting/bank-transactions/${id}/ignore`),
}
