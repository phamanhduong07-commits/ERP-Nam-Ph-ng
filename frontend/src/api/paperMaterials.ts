import client from './client'
import type { PagedResponse } from './customers'

export interface PaperMaterial {
  id: number
  ma_chinh: string
  ma_amis: string | null
  ma_nhom_id: number
  ten: string
  ten_viet_tat: string | null
  dvt: string
  kho: number | null
  ma_ky_hieu: string | null
  dinh_luong: number | null
  ma_nsx_id: number | null
  gia_mua: number
  gia_ban: number
  ton_toi_thieu: number
  ton_toi_da: number | null
  la_cuon: boolean
  su_dung: boolean
  ten_nhom?: string
  ten_nsx?: string
  created_at: string
}

export type PaperMaterialCreate = Omit<PaperMaterial, 'id' | 'ten_nhom' | 'ten_nsx' | 'created_at'>

export const paperMaterialsFullApi = {
  list: (params?: { search?: string; ma_nhom_id?: number; ma_nsx_id?: number; page?: number; page_size?: number }) =>
    client.get<PagedResponse<PaperMaterial>>('/paper-materials', { params }),
  create: (data: PaperMaterialCreate) => client.post<PaperMaterial>('/paper-materials', data),
  update: (id: number, data: Partial<PaperMaterialCreate>) => client.put<PaperMaterial>(`/paper-materials/${id}`, data),
}
