import client from './client'

export type TaiSanLoai = 'ban_in' | 'khuon_be'
export type TaiSanNguoiChiTra = 'khach_hang' | 'cong_ty'
export type TaiSanTrangThai = 'cho_mua' | 'dang_mua' | 'dang_dung' | 'hong' | 'da_tra_khach' | 'mat'

export interface SanPhamLink {
  id: number
  san_pham_id: number
  ghi_chu: string | null
  created_at: string
  ma_amis: string | null
  ma_hang: string | null
  ten_hang: string | null
}

export interface TaiSanInItem {
  id: number
  ma_tai_san: string
  loai: TaiSanLoai
  mo_ta: string | null
  customer_id: number
  ten_khach: string | null
  nguoi_chi_tra: TaiSanNguoiChiTra
  gia_tri: number
  supplier_id: number | null
  ten_ncc: string | null
  other_material_id: number | null
  ma_nvl: string | null
  trang_thai: TaiSanTrangThai
  da_thu_tien: boolean
  da_hoan_tien: boolean
  san_luong_dinh_muc_hoan: number | null
  san_luong_thuc_te: number | null
  ngay_tao: string
  so_san_pham: number
}

export interface TaiSanInDetail extends TaiSanInItem {
  purchase_order_id: number | null
  so_po: string | null
  sales_order_thu_id: number | null
  so_don_thu: string | null
  cash_payment_hoan_id: number | null
  ghi_chu: string | null
  user_id: number | null
  created_at: string
  updated_at: string
  san_pham_links: SanPhamLink[]
}

export interface TaiSanInCreate {
  loai: TaiSanLoai
  mo_ta?: string
  customer_id: number
  nguoi_chi_tra?: TaiSanNguoiChiTra
  gia_tri?: number
  supplier_id?: number | null
  other_material_id?: number | null
  purchase_order_id?: number | null
  sales_order_thu_id?: number | null
  da_thu_tien?: boolean
  san_luong_dinh_muc_hoan?: number | null
  ngay_tao: string
  trang_thai?: TaiSanTrangThai
  ghi_chu?: string
}

export interface TaiSanInUpdate {
  mo_ta?: string
  nguoi_chi_tra?: TaiSanNguoiChiTra
  gia_tri?: number
  purchase_order_id?: number | null
  sales_order_thu_id?: number | null
  da_thu_tien?: boolean
  san_luong_dinh_muc_hoan?: number | null
  da_hoan_tien?: boolean
  cash_payment_hoan_id?: number | null
  trang_thai?: TaiSanTrangThai
  ghi_chu?: string
}

export interface SanPhamLinkCreate {
  san_pham_id: number
  ghi_chu?: string
}

export const LOAI_LABELS: Record<TaiSanLoai, string> = {
  ban_in: 'Bản in',
  khuon_be: 'Khuôn bế',
}

export const NGUOI_CHI_TRA_LABELS: Record<TaiSanNguoiChiTra, string> = {
  khach_hang: 'Khách hàng',
  cong_ty: 'Công ty',
}

export const TRANG_THAI_LABELS: Record<TaiSanTrangThai, string> = {
  cho_mua: 'Chờ mua',
  dang_mua: 'Đang mua',
  dang_dung: 'Đang dùng',
  hong: 'Hỏng',
  da_tra_khach: 'Đã trả khách',
  mat: 'Mất',
}

export const TRANG_THAI_COLORS: Record<TaiSanTrangThai, string> = {
  cho_mua: 'default',
  dang_mua: 'processing',
  dang_dung: 'success',
  hong: 'error',
  da_tra_khach: 'warning',
  mat: 'error',
}

export const taiSanInApi = {
  list: (params?: {
    loai?: TaiSanLoai
    customer_id?: number
    sales_order_thu_id?: number
    trang_thai?: TaiSanTrangThai
    nguoi_chi_tra?: TaiSanNguoiChiTra
    chua_thu_tien?: boolean
  }) =>
    client.get<TaiSanInItem[]>('/tai-san-in', { params }),

  get: (id: number) =>
    client.get<TaiSanInDetail>(`/tai-san-in/${id}`),

  create: (data: TaiSanInCreate) =>
    client.post<TaiSanInDetail>('/tai-san-in', data),

  update: (id: number, data: TaiSanInUpdate) =>
    client.put<TaiSanInDetail>(`/tai-san-in/${id}`, data),

  delete: (id: number) =>
    client.delete(`/tai-san-in/${id}`),

  addSanPham: (id: number, data: SanPhamLinkCreate) =>
    client.post<SanPhamLink>(`/tai-san-in/${id}/san-pham`, data),

  removeSanPham: (id: number, sanPhamId: number) =>
    client.delete(`/tai-san-in/${id}/san-pham/${sanPhamId}`),

  bySanPham: (sanPhamId: number) =>
    client.get<TaiSanInItem[]>(`/tai-san-in/by-san-pham/${sanPhamId}`),

  taoYmh: (data: {
    ids: number[]
    ngay_yeu_cau: string
    phap_nhan_id: number
    phan_xuong_id?: number | null
    ghi_chu?: string | null
  }) =>
    client.post<{ ymh_id: number; so_ymh: string }>('/tai-san-in/tao-ymh', data),
}
