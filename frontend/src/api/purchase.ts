import client from './client'

export interface POItem {
  id?: number
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  don_gia: number
  thanh_tien?: number
  so_luong_da_nhan?: number
  ghi_chu?: string | null
}

export interface PurchaseOrder {
  id: number
  so_po: string
  ngay_po: string
  supplier_id: number
  ten_ncc: string
  trang_thai: string
  ngay_du_kien_nhan: string | null
  dieu_khoan_tt: string | null
  tong_tien: number
  tien_do_nhan?: number
  ghi_chu: string | null
  approved_at: string | null
  created_at: string | null
  items: POItem[]
}

export interface CreatePOPayload {
  supplier_id: number
  ngay_po: string
  ngay_du_kien_nhan?: string | null
  dieu_khoan_tt?: string | null
  ghi_chu?: string | null
  items: Omit<POItem, 'id' | 'thanh_tien' | 'so_luong_da_nhan'>[]
}

export interface UpdatePOPayload {
  ngay_du_kien_nhan?: string | null
  dieu_khoan_tt?: string | null
  ghi_chu?: string | null
  items?: Omit<POItem, 'id' | 'thanh_tien' | 'so_luong_da_nhan'>[]
}

export const TRANG_THAI_PO: Record<string, string> = {
  moi: 'Mới',
  da_duyet: 'Đã duyệt',
  da_gui_ncc: 'Đã gửi NCC',
  dang_giao: 'Đang giao',
  hoan_thanh: 'Hoàn thành',
  huy: 'Huỷ',
}

export const TRANG_THAI_PO_COLOR: Record<string, string> = {
  moi: 'default',
  da_duyet: 'blue',
  da_gui_ncc: 'cyan',
  dang_giao: 'orange',
  hoan_thanh: 'green',
  huy: 'red',
}

export const purchaseApi = {
  list: (params?: {
    supplier_id?: number
    trang_thai?: string
    tu_ngay?: string
    den_ngay?: string
  }) => client.get<PurchaseOrder[]>('/purchase-orders', { params }),

  get: (id: number) => client.get<PurchaseOrder>(`/purchase-orders/${id}`),

  create: (data: CreatePOPayload) => client.post<PurchaseOrder>('/purchase-orders', data),

  update: (id: number, data: UpdatePOPayload) =>
    client.put<PurchaseOrder>(`/purchase-orders/${id}`, data),

  approve: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-orders/${id}/duyet`),

  delete: (id: number) => client.delete(`/purchase-orders/${id}`),
  importPOs: (file: File, commit: boolean = false) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(`/purchase-orders/import?commit=${commit}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}
