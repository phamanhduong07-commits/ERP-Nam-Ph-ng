import client from './client'
import type { PagedResponse } from './customers'

export interface OtherMaterial {
  id: number
  ma_chinh: string
  ma_amis: string | null
  ten: string
  dvt: string
  ma_nhom_id: number
  gia_mua: number
  ton_toi_thieu: number
  ton_toi_da: number | null
  phan_xuong: string | null
  ma_ncc_id: number | null
  ghi_chu: string | null
  trang_thai: boolean
  ten_nhom?: string
  ten_ncc?: string
  created_at: string
}

export type OtherMaterialCreate = Omit<OtherMaterial, 'id' | 'ten_nhom' | 'ten_ncc' | 'created_at'>

export const otherMaterialsApi = {
  list: (params?: { search?: string; ma_nhom_id?: number; page?: number; page_size?: number }) =>
    client.get<PagedResponse<OtherMaterial>>('/other-materials', { params }),
  create: (data: OtherMaterialCreate) => client.post<OtherMaterial>('/other-materials', data),
  update: (id: number, data: Partial<OtherMaterialCreate>) => client.put<OtherMaterial>(`/other-materials/${id}`, data),
}
