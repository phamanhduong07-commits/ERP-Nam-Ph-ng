import client from './client'

export interface PurchaseReturnItem {
  id?: number
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  don_gia: number
  thanh_tien?: number
  ghi_chu?: string | null
}

export interface PurchaseReturn {
  id: number
  so_phieu: string
  ngay: string
  supplier_id: number
  ten_ncc: string | null
  po_id: number | null
  gr_id: number | null
  invoice_id: number | null
  loai: 'tra_hang' | 'giam_gia'
  ly_do: string | null
  thue_suat: number
  tong_tien_hang: number
  tien_thue: number
  tong_thanh_toan: number
  ghi_chu: string | null
  trang_thai: 'nhap' | 'da_duyet' | 'huy'
  created_at: string | null
  approved_at: string | null
  items: PurchaseReturnItem[]
}

export interface PurchaseReturnListItem {
  id: number
  so_phieu: string
  ngay: string
  supplier_id: number
  ten_ncc: string | null
  loai: string
  tong_thanh_toan: number
  trang_thai: string
  po_id: number | null
  gr_id: number | null
  invoice_id: number | null
  ly_do: string | null
}

export interface CreatePurchaseReturnPayload {
  supplier_id: number
  ngay: string
  loai: 'tra_hang' | 'giam_gia'
  po_id?: number | null
  gr_id?: number | null
  invoice_id?: number | null
  ly_do?: string | null
  thue_suat?: number
  tong_tien_hang: number
  tien_thue?: number | null
  tong_thanh_toan?: number | null
  ghi_chu?: string | null
  items?: Omit<PurchaseReturnItem, 'id' | 'thanh_tien'>[]
}

export const LOAI_LABELS: Record<string, string> = {
  tra_hang: 'Trả hàng',
  giam_gia: 'Giảm giá',
}

export const TRANG_THAI_LABELS: Record<string, string> = {
  nhap: 'Nháp',
  da_duyet: 'Đã duyệt',
  huy: 'Đã huỷ',
}

export const TRANG_THAI_COLOR: Record<string, string> = {
  nhap: 'default',
  da_duyet: 'green',
  huy: 'red',
}

// ── Sổ chi tiết mua hàng ──────────────────────────────────────────────────────
export interface SoChiTietRow {
  ngay: string
  chung_tu_loai: string | null
  chung_tu_id: number | null
  supplier_id: number | null
  ten_ncc: string | null
  dien_giai: string | null
  phat_sinh_no: number
  phat_sinh_co: number
  so_du: number
}

export interface SoChiTietMuaHang {
  tu_ngay: string
  den_ngay: string
  supplier_id: number | null
  so_du_dau_ky: number
  so_du_cuoi_ky: number
  rows: SoChiTietRow[]
}

// ── Biên bản đối chiếu công nợ ────────────────────────────────────────────────
export interface DoiChieuCongNo {
  supplier_id: number
  ten_ncc: string
  ma_so_thue: string | null
  tu_ngay: string
  den_ngay: string
  so_du_dau_ky: number
  hoa_don: {
    id: number
    so_hoa_don: string | null
    ngay: string
    tong_thanh_toan: number
    da_thanh_toan: number
    con_lai: number
    trang_thai: string
  }[]
  thanh_toan: {
    id: number
    so_phieu: string
    ngay: string
    so_tien: number
    hinh_thuc: string
    invoice_id: number | null
  }[]
  tra_hang: {
    id: number
    so_phieu: string
    ngay: string
    loai: string
    tong_thanh_toan: number
  }[]
  tong_hoa_don: number
  tong_thanh_toan: number
  tong_tra_hang: number
  so_du_cuoi_ky: number
}

export const purchaseReturnsApi = {
  list: (params?: {
    supplier_id?: number
    loai?: string
    trang_thai?: string
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<{ total: number; page: number; page_size: number; items: PurchaseReturnListItem[] }>(
    '/purchase-returns', { params }
  ),

  get: (id: number) => client.get<PurchaseReturn>(`/purchase-returns/${id}`),

  create: (data: CreatePurchaseReturnPayload) =>
    client.post<PurchaseReturn>('/purchase-returns', data),

  approve: (id: number) =>
    client.post<PurchaseReturn>(`/purchase-returns/${id}/duyet`),

  cancel: (id: number) =>
    client.post<PurchaseReturn>(`/purchase-returns/${id}/huy`),

  delete: (id: number) => client.delete(`/purchase-returns/${id}`),

  // Báo cáo
  getSoChiTiet: (params: { supplier_id?: number; tu_ngay: string; den_ngay: string }) =>
    client.get<SoChiTietMuaHang>('/accounting/purchase/so-chi-tiet', { params }),

  getDoiChieu: (supplier_id: number, params: { tu_ngay: string; den_ngay: string }) =>
    client.get<DoiChieuCongNo>(`/accounting/ap/doi-chieu/${supplier_id}`, { params }),
}
