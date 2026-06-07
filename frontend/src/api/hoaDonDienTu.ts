import client from './client'

export interface HoaDonItem {
  ten_hang: string
  ma_hang?: string
  don_vi: string
  so_luong: number
  don_gia: number
  thanh_tien: number
  thue_suat: string  // "10%", "8%", "0%", "KCT"
}

export interface HoaDonDienTu {
  id: number
  so_hoa_don: string | null
  ky_hieu: string | null
  mau_so: string | null
  ngay_lap: string
  loai_hd: string   // "1"=GTGT, "2"=bán hàng
  sales_order_id: number | null
  sales_invoice_id: number | null
  customer_id: number | null
  ten_khach_hang: string
  ma_so_thue_kh: string | null
  dia_chi_kh: string | null
  tong_tien_hang: number
  tien_thue_gtgt: number
  tong_cong: number
  trang_thai: string
  misa_id: string | null
  ma_cqt: string | null
  xml_url: string | null
  pdf_url: string | null
  ly_do_huy: string | null
  items: HoaDonItem[]
  phap_nhan_id: number | null
  ghi_chu: string | null
  created_by: number | null
  created_at: string | null
}

export interface CreateHoaDonPayload {
  ngay_lap: string
  loai_hd: string
  ten_khach_hang: string
  ma_so_thue_kh?: string
  dia_chi_kh?: string
  tong_tien_hang: number
  tien_thue_gtgt?: number
  tong_cong: number
  items: HoaDonItem[]
  sales_order_id?: number | null
  sales_invoice_id?: number | null
  customer_id?: number | null
  phap_nhan_id?: number | null
  ghi_chu?: string
}

export const TRANG_THAI_HDT: Record<string, string> = {
  nhap: 'Nháp',
  cho_ky: 'Chờ ký',
  da_phat_hanh: 'Đã phát hành',
  huy: 'Đã hủy',
  can_dieu_chinh: 'Cần điều chỉnh',
}

export const TRANG_THAI_HDT_COLOR: Record<string, string> = {
  nhap: 'default',
  cho_ky: 'orange',
  da_phat_hanh: 'green',
  huy: 'red',
  can_dieu_chinh: 'volcano',
}

export const hdtApi = {
  list: (params?: {
    trang_thai?: string
    tu_ngay?: string
    den_ngay?: string
    phap_nhan_id?: number
    sales_invoice_id?: number
  }) => client.get<HoaDonDienTu[]>('/hoa-don-dien-tu', { params }),

  get: (id: number) => client.get<HoaDonDienTu>(`/hoa-don-dien-tu/${id}`),

  create: (data: CreateHoaDonPayload) =>
    client.post<HoaDonDienTu>('/hoa-don-dien-tu', data),

  update: (id: number, data: Partial<CreateHoaDonPayload>) =>
    client.put<HoaDonDienTu>(`/hoa-don-dien-tu/${id}`, data),

  delete: (id: number) => client.delete(`/hoa-don-dien-tu/${id}`),

  phatHanh: (id: number) =>
    client.post<HoaDonDienTu>(`/hoa-don-dien-tu/${id}/phat-hanh`),

  huy: (id: number, ly_do: string) =>
    client.post<HoaDonDienTu>(`/hoa-don-dien-tu/${id}/huy`, { ly_do }),

  syncStatus: (id: number) =>
    client.post<HoaDonDienTu>(`/hoa-don-dien-tu/${id}/sync-status`),
}
