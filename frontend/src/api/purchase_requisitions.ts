import client from './client'

export interface YMHItem {
  id?: number
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  don_gia_du_kien: number
  ngay_can?: string | null
  ghi_chu?: string | null
}

export interface PurchaseRequisition {
  id: number
  so_ymh: string
  ngay_yeu_cau: string
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  phap_nhan_id: number | null
  ten_phap_nhan: string | null
  trang_thai: string
  nguoi_yeu_cau_id: number | null
  ten_nguoi_yeu_cau: string | null
  nguoi_duyet_pb_id: number | null
  ten_nguoi_duyet_pb: string | null
  nguoi_duyet_gd_id: number | null
  ten_nguoi_duyet_gd: string | null
  ngay_duyet_pb: string | null
  ngay_duyet_gd: string | null
  po_id: number | null
  so_po_linked: string | null
  ghi_chu: string | null
  ly_do_tu_choi: string | null
  tong_du_kien: number
  so_dong: number
  created_at: string | null
  items: YMHItem[]
}

export interface RejectYmhPayload {
  ly_do?: string
}

export interface CreateYmhPayload {
  ngay_yeu_cau: string
  phan_xuong_id?: number | null
  phap_nhan_id?: number | null
  ghi_chu?: string | null
  items: Omit<YMHItem, 'id'>[]
}

export interface UpdateYmhPayload {
  ngay_yeu_cau?: string
  phan_xuong_id?: number | null
  phap_nhan_id?: number | null
  ghi_chu?: string | null
  items?: Omit<YMHItem, 'id'>[]
}

export interface TaoPoPayload {
  supplier_id: number
  ngay_po: string
  ngay_du_kien_nhan?: string | null
  dieu_khoan_tt?: string | null
  ghi_chu?: string | null
  items_override?: { ymh_item_id: number; don_gia: number }[]
}

export const TRANG_THAI_YMH: Record<string, string> = {
  nhap: 'Nháp',
  cho_duyet: 'Chờ duyệt',
  duyet_pb: 'PB đã duyệt',
  duyet_gd: 'GĐ đã duyệt',
  tao_po: 'Đã tạo PO',
  tu_choi: 'Từ chối',
  huy: 'Đã hủy',
}

export const TRANG_THAI_YMH_COLOR: Record<string, string> = {
  nhap: 'default',
  cho_duyet: 'orange',
  duyet_pb: 'blue',
  duyet_gd: 'green',
  tao_po: 'cyan',
  tu_choi: 'red',
  huy: 'volcano',
}

export const ymhApi = {
  list: (params?: {
    trang_thai?: string
    phan_xuong_id?: number
    phap_nhan_id?: number
    nguoi_yeu_cau_id?: number
    tu_ngay?: string
    den_ngay?: string
    search?: string
  }) => client.get<PurchaseRequisition[]>('/purchase-requisitions', { params }),

  get: (id: number) => client.get<PurchaseRequisition>(`/purchase-requisitions/${id}`),

  create: (data: CreateYmhPayload) => client.post<PurchaseRequisition>('/purchase-requisitions', data),

  update: (id: number, data: UpdateYmhPayload) =>
    client.put<PurchaseRequisition>(`/purchase-requisitions/${id}`, data),

  submit: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-requisitions/${id}/submit`),

  approve: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-requisitions/${id}/approve`),

  reject: (id: number, data: RejectYmhPayload) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-requisitions/${id}/reject`, data),

  duyetPB: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-requisitions/${id}/duyet-pb`),

  duyetGD: (id: number) =>
    client.post<{ ok: boolean; trang_thai: string }>(`/purchase-requisitions/${id}/duyet-gd`),

  taoPO: (id: number, data: TaoPoPayload) =>
    client.post<{ ok: boolean; po_id: number; so_po: string; trang_thai: string }>(
      `/purchase-requisitions/${id}/tao-po`,
      data,
    ),

  huy: (id: number) =>
    client.post<{ ok: boolean }>(`/purchase-requisitions/${id}/huy`),

  delete: (id: number) => client.delete(`/purchase-requisitions/${id}`),

  print: (id: number) => client.get<string>(`/purchase-requisitions/${id}/print`, { responseType: 'text' }),
}
