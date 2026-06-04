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
  so_cuon_da_nhan?: number
  ghi_chu?: string | null
  // Phôi sóng mua ngoài
  production_plan_line_id?: number | null
  phoi_spec?: Record<string, unknown> | null
}

export interface PurchaseOrder {
  id: number
  so_po: string
  ngay_po: string
  supplier_id: number
  ten_ncc: string
  trang_thai: string
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  loai_po: string
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
  phan_xuong_id?: number | null
  phap_nhan_id?: number | null
  loai_po?: string
  ngay_du_kien_nhan?: string | null
  dieu_khoan_tt?: string | null
  ghi_chu?: string | null
  items: Omit<POItem, 'id' | 'thanh_tien' | 'so_luong_da_nhan'>[]
}

export interface UpdatePOPayload {
  phan_xuong_id?: number | null
  phap_nhan_id?: number | null
  loai_po?: string
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

export interface DoiSoatKhoRow {
  po_id: number
  so_po: string
  ngay_po: string | null
  supplier_id: number
  ten_ncc: string
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  po_trang_thai: string
  poi_id: number
  ten_hang: string
  dvt: string
  don_gia: number
  so_luong_dat: number
  so_luong_da_nhan: number
  so_luong_con_lai: number
  ty_le_nhan: number
  thanh_tien_dat: number
  thanh_tien_da_nhan: number
}

export interface DoiSoatKhoSummary {
  supplier_id: number
  ten_ncc: string
  so_po_count: number
  tong_dat: number
  tong_da_nhan: number
  tong_con_lai: number
  ty_le_nhan: number
  tong_tien_dat: number
  tong_tien_da_nhan: number
}

export interface PurchaseDashboard {
  kpi: {
    tong_po: number
    tong_gia_tri_po: number
    tong_gr: number
    tong_gia_tri_gr: number
    tong_hoa_don: number
    tong_gia_tri_hd: number
    tong_da_tt: number
    tong_con_no: number
    po_qua_han: number
    gr_cho_nhap: number
    hd_qua_han: number
  }
  by_phap_nhan: {
    phap_nhan_id: number
    ten_phap_nhan: string
    so_phieu_gr: number
    tong_gia_tri_gr: number
    so_hoa_don: number
    tong_gia_tri_hd: number
    tong_con_no: number
  }[]
  top_ncc: {
    supplier_id: number
    ten_ncc: string
    so_phieu_gr: number
    tong_gia_tri_gr: number
  }[]
  po_by_status: Record<string, number>
}

export interface DuBaoNhuCauRow {
  paper_material_id: number | null
  other_material_id: number | null
  phan_xuong_id: number | null
  phap_nhan_id: number | null
  ma_hang: string
  ten_hang: string
  loai: 'giay_cuon' | 'nvl_khac' | ''
  tong_xuat_ky: number
  tong_nhap_ky: number
  tb_xuat_thang: number
  ton_hien_tai: number
  ton_dang_dat: number
  gia_tri_ton: number
  du_kien_can: number
  can_mua: number
  can_mua_thuc: number
  don_gia_mua_gan_nhat: number
  uoc_tinh_tien_mua: number
  so_ngay_con: number
  xu_huong: 'tang' | 'giam' | 'on_dinh' | 'moi'
  xu_huong_pct: number
  don_vi: string
  muc_do_uu_tien: 'cao' | 'trung_binh' | 'thap'
}

export const purchaseApi = {
  list: (params?: {
    supplier_id?: number
    trang_thai?: string
    tu_ngay?: string
    den_ngay?: string
    phan_xuong_id?: number
    loai_po?: string
    search?: string
  }) => client.get<PurchaseOrder[]>('/purchase-orders', { params }),

  get: (id: number) => client.get<PurchaseOrder>(`/purchase-orders/${id}`),

  create: (data: CreatePOPayload) => client.post<PurchaseOrder>('/purchase-orders', data),

  update: (id: number, data: UpdatePOPayload) =>
    client.put<PurchaseOrder>(`/purchase-orders/${id}`, data),

  approve: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-orders/${id}/duyet`),

  guiNcc: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-orders/${id}/gui-ncc`),

  huy: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-orders/${id}/huy`),

  delete: (id: number) => client.delete(`/purchase-orders/${id}`),

  doiSoatKho: (params?: {
    supplier_id?: number
    tu_ngay?: string
    den_ngay?: string
    phan_xuong_id?: number
    trang_thai?: string
  }) => client.get<DoiSoatKhoRow[]>('/purchase-orders/doi-soat-kho', { params }),

  doiSoatKhoSummary: (params?: {
    supplier_id?: number
    tu_ngay?: string
    den_ngay?: string
    phan_xuong_id?: number
  }) => client.get<DoiSoatKhoSummary[]>('/purchase-orders/doi-soat-kho/summary', { params }),

  duBaoNhuCau: (params?: {
    thang_phan_tich?: number
    thang_du_tru?: number
    phan_xuong_id?: number
    phap_nhan_id?: number
    loai_nvl?: string
  }) => client.get<DuBaoNhuCauRow[]>('/purchase-orders/du-bao-nhu-cau', { params }),

  dashboard: (params?: {
    tu_ngay?: string
    den_ngay?: string
    phap_nhan_id?: number
  }) => client.get<PurchaseDashboard>('/purchase-orders/dashboard', { params }),

  importPOs: (file: File, commit: boolean = false) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(`/purchase-orders/import?commit=${commit}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  exportPOExcel: (id: number) =>
    client.get(`/purchase-orders/${id}/export-excel`, { responseType: 'blob' }).then(r => r.data as Blob),
}
