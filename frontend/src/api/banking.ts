import client from './client'

export interface BankAccount {
  id: number
  ma_tk: string
  ten_ngan_hang: string
  so_tai_khoan: string
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
  loai: 'thu' | 'chi'
  doi_tuong: string | null
  dien_giai: string | null
  so_tham_chieu?: string | null
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

export const bankAccountsApi = {
  list: (params?: { search?: string; trang_thai?: boolean }) =>
    client.get<BankAccount[]>('/bank-accounts', { params }),

  create: (data: BankAccountCreate) =>
    client.post<BankAccount>('/bank-accounts', data),

  update: (id: number, data: BankAccountUpdate) =>
    client.put<BankAccount>(`/bank-accounts/${id}`, data),
}

export const bankLedgerApi = {
  getCashBook: (tu_ngay: string, den_ngay: string) =>
    client.get<LedgerResponse>('/accounting/cash-book', { params: { tu_ngay, den_ngay } }),

  getBankLedger: (tu_ngay: string, den_ngay: string, so_tai_khoan?: string) =>
    client.get<LedgerResponse>('/accounting/bank-ledger', {
      params: { tu_ngay, den_ngay, ...(so_tai_khoan ? { so_tai_khoan } : {}) },
    }),
}
