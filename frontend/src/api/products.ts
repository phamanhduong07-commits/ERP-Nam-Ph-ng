import client from './client'
import type { PagedResponse } from './customers'

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
  ghim: boolean
  dan: boolean
  phan_xuong: string | null
  loai: string | null
  ghi_chu: string | null
  ten_kh?: string
  created_at: string
}

export type ProductFullCreate = Omit<ProductFull, 'id' | 'ten_kh' | 'created_at'>

export const productsApi = {
  list: (params?: { search?: string; ma_kh_id?: number; so_lop?: number; page?: number; page_size?: number }) =>
    client.get<PagedResponse<ProductFull>>('/products', { params }),
  byCustomer: (customerId: number) =>
    client.get<Product[]>(`/products/by-customer/${customerId}`),
  get: (id: number) => client.get<ProductFull>(`/products/${id}`),
  create: (data: ProductFullCreate) => client.post<ProductFull>('/products', data),
  update: (id: number, data: Partial<ProductFullCreate>) => client.put<ProductFull>(`/products/${id}`, data),
}
