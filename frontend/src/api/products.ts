import client from './client'
import type { PagedResponse } from './customers'
import type { SxParamsMacDinh } from './productionOrders'

// Thông tin cơ bản (dùng trong dropdown, chọn sản phẩm)
export interface Product {
  id: number
  ma_amis: string
  ma_hang: string | null
  ten_hang: string
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number
  so_mau: number
  dvt: string
  gia_ban: number
  trang_thai: boolean
}

// Đầy đủ trường (dùng trong trang Danh mục hàng hóa)
export interface ProductFull extends Product {
  ma_kh_id: number | null
  loai_in: number
  ghim: boolean
  dan: boolean
  chap_xa: number
  loai_lan: string | null
  loai_thung: string | null
  chong_tham: number
  boi: number
  be_so_con: number
  can_mang: number
  mat: string | null
  mat_dl: number | null
  song_1: string | null
  song_1_dl: number | null
  mat_1: string | null
  mat_1_dl: number | null
  song_2: string | null
  song_2_dl: number | null
  mat_2: string | null
  mat_2_dl: number | null
  song_3: string | null
  song_3_dl: number | null
  mat_3: string | null
  mat_3_dl: number | null
  phan_xuong: string | null
  loai: string | null
  ghi_chu: string | null
  gia_mua: number
  gia_dinh_muc: number
  ton_toi_thieu: number | null
  ton_toi_da: number | null
  khong_tinh_nxt: boolean
  // Đặc tính sản xuất
  to_hop_song: string | null
  loai_be: string | null
  be_hai_manh: boolean
  ho_mo: boolean | null
  ho_nap: number | null
  ho_day: number | null
  co_be: boolean
  be_lo: boolean
  do_kho: boolean
  do_phu: boolean
  may_in: string | null
  ban_ve_kt: string | null
  nhom_san_pham: string | null
  // Tem offset
  co_tem_offset: boolean
  tem_loai_giay: string | null
  tem_gsm: number | null
  tem_dai_to: number | null
  tem_rong_to: number | null
  tem_sp_per_to: number
  tem_waste_to: number
  tem_so_mau: number
  tem_co_can_mang: boolean
  tem_co_khuon_be: boolean
  tem_co_uv: boolean
  tem_co_suppo: boolean
  tem_co_luoi: boolean
  tem_hai_manh: boolean
  tem_khac_thiet_ke: boolean
  ten_khach_hang?: string
  created_at: string
  sx_params_mac_dinh?: import('./productionOrders').SxParamsMacDinh | null
}

export type ProductFullCreate = Omit<ProductFull, 'id' | 'ten_khach_hang' | 'created_at'>

export const productsApi = {
  list: (params?: { search?: string; ma_kh_id?: number; so_lop?: number; page?: number; page_size?: number }) =>
    client.get<PagedResponse<ProductFull>>('/products', { params }),
  byCustomer: (customerId: number) =>
    client.get<Product[]>(`/products/by-customer/${customerId}`),
  get: (id: number) => client.get<ProductFull>(`/products/${id}`),
  create: (data: ProductFullCreate) => client.post<ProductFull>('/products', data),
  update: (id: number, data: Partial<ProductFullCreate>) => client.put<ProductFull>(`/products/${id}`, data),
  import: (file: File, commit: boolean) => {
    const fd = new FormData(); fd.append('file', file); fd.append('commit', String(commit))
    return client.post<Record<string, unknown>>('/products/import-excel', fd)
  },
  patchSxParamsMacDinh: (productId: number, data: SxParamsMacDinh | null) =>
    client.patch<{ id: number; sx_params_mac_dinh: SxParamsMacDinh | null }>(
      `/products/${productId}/sx-params-mac-dinh`,
      { sx_params_mac_dinh: data }
    ),
}
