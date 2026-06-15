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

export interface ChiTieuItem {
  stt: number
  ten_chi_tieu: string
  don_vi: string | null
  yeu_cau_text: string | null
  kieu_kiem_tra: 'range' | 'min' | 'max' | 'pass_fail' | 'average_range' | 'average_min'
  gia_tri_min: number | null
  gia_tri_max: number | null
  bat_buoc: boolean
  // Dùng cho average_range và average_min
  so_lan_do?: number | null
  tolerance_pct?: number | null
}

export interface TieuChuanKyThuat {
  id: number
  ma_tc: string
  ten: string
  mo_ta: string | null
  ap_dung_cho: string
  chi_tieu_list: ChiTieuItem[] | null
  // Tiêu chuẩn giấy cuộn — NCC + nhóm + loại
  ncc_id: number | null
  ncc_ten: string | null
  nhom_id: number | null
  nhom_ten: string | null
  loai_giay: string | null
  tc_dinh_luong: number | null
  tc_sai_so_pct: number | null
  tc_do_buc: number | null
  tc_do_nen_vong: number | null
  papers_synced?: number | null
  file_count: number
  files: TieuChuanFile[]
  created_at: string
}

export interface TieuChuanCreate {
  ma_tc: string
  ten: string
  mo_ta?: string | null
  ap_dung_cho: string
  chi_tieu_list?: ChiTieuItem[] | null
  // Tiêu chuẩn giấy cuộn — NCC + nhóm + loại
  ncc_id?: number | null
  nhom_id?: number | null
  loai_giay?: string | null
  tc_dinh_luong?: number | null
  tc_sai_so_pct?: number | null
  tc_do_buc?: number | null
  tc_do_nen_vong?: number | null
}

export interface TieuChuanSearchResult {
  value: number
  label: string
  id: number
  ma_tc: string
  ten: string
}

export interface PreviewGiayResult {
  count: number
  papers: { id: number; ma_chinh: string; ten: string; loai_giay: string | null }[]
  note?: string
}

export const tieuChuanApi = {
  list: (params?: { search?: string; ap_dung_cho?: string; ncc_id?: number; nhom_id?: number; page?: number; page_size?: number }) =>
    client.get<PagedResponse<TieuChuanKyThuat>>('/tieu-chuan-ky-thuat', { params }),
  get: (id: number) => client.get<TieuChuanKyThuat>(`/tieu-chuan-ky-thuat/${id}`),
  create: (data: TieuChuanCreate) => client.post<TieuChuanKyThuat>('/tieu-chuan-ky-thuat', data),
  update: (id: number, data: Partial<TieuChuanCreate>) =>
    client.put<TieuChuanKyThuat>(`/tieu-chuan-ky-thuat/${id}`, data),
  delete: (id: number) => client.delete(`/tieu-chuan-ky-thuat/${id}`),
  search: (params?: { q?: string; ap_dung_cho?: string; limit?: number }) =>
    client.get<TieuChuanSearchResult[]>('/tieu-chuan-ky-thuat/search', { params }),
  previewGiay: (id: number) =>
    client.get<PreviewGiayResult>(`/tieu-chuan-ky-thuat/${id}/preview-giay`),
  apDungChoGiay: (id: number) =>
    client.post<{ updated: number; ncc_id: number; loai_giay: string | null }>(`/tieu-chuan-ky-thuat/${id}/ap-dung-cho-giay`),
  previewNvl: (id: number) =>
    client.get<{ count: number; nvls: { id: number; ma_chinh: string; ten: string }[]; note?: string }>(`/tieu-chuan-ky-thuat/${id}/preview-nvl`),
  apDungChoNvl: (id: number) =>
    client.post<{ updated: number; ncc_id: number | null; nhom_id: number | null }>(`/tieu-chuan-ky-thuat/${id}/ap-dung-cho-nvl`),
  uploadFile: (id: number, file: File, note?: string) => {
    const form = new FormData()
    form.append('module', 'tieu_chuan')
    form.append('record_id', String(id))
    form.append('file', file)
    if (note) form.append('note', note)
    return client.post('/media/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteFile: (mediaId: number) => client.delete(`/media/${mediaId}`),
  migratePaperTcToChiTieuList: () =>
    client.post<{ migrated: number; skipped: number }>('/tieu-chuan-ky-thuat/migrate-paper-tc-to-chi-tieu-list'),
}
