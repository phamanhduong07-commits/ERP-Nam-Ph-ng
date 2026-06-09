import client from './client'
import type { PagedResponse } from './customers'

export interface TieuChuanFile {
  id: number
  url: string
  filename: string
  mime_type: string | null
  size_bytes: number | null
  note: string | null
}

export interface TieuChuanKyThuat {
  id: number
  ma_tc: string
  ten: string
  mo_ta: string | null
  ap_dung_cho: string
  file_count: number
  files: TieuChuanFile[]
  created_at: string
}

export interface TieuChuanCreate {
  ma_tc: string
  ten: string
  mo_ta?: string | null
  ap_dung_cho: string
}

export interface TieuChuanSearchResult {
  value: number
  label: string
  id: number
  ma_tc: string
  ten: string
}

export const tieuChuanApi = {
  list: (params?: { search?: string; ap_dung_cho?: string; page?: number; page_size?: number }) =>
    client.get<PagedResponse<TieuChuanKyThuat>>('/tieu-chuan-ky-thuat', { params }),
  get: (id: number) => client.get<TieuChuanKyThuat>(`/tieu-chuan-ky-thuat/${id}`),
  create: (data: TieuChuanCreate) => client.post<TieuChuanKyThuat>('/tieu-chuan-ky-thuat', data),
  update: (id: number, data: Partial<TieuChuanCreate>) =>
    client.put<TieuChuanKyThuat>(`/tieu-chuan-ky-thuat/${id}`, data),
  delete: (id: number) => client.delete(`/tieu-chuan-ky-thuat/${id}`),
  search: (params?: { q?: string; ap_dung_cho?: string; limit?: number }) =>
    client.get<TieuChuanSearchResult[]>('/tieu-chuan-ky-thuat/search', { params }),
  uploadFile: (id: number, file: File, note?: string) => {
    const form = new FormData()
    form.append('module', 'tieu_chuan')
    form.append('record_id', String(id))
    form.append('file', file)
    if (note) form.append('note', note)
    return client.post('/media/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteFile: (mediaId: number) => client.delete(`/media/${mediaId}`),
}
