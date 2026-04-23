import client from './client'

export interface CauTruc {
  id: number
  ten_cau_truc: string
  so_lop: number
  to_hop_song: string | null
  // Mỗi lớp: mã ký hiệu đồng cấp + định lượng (g/m²)
  mat: string | null;     mat_dl: number | null
  song_1: string | null;  song_1_dl: number | null
  mat_1: string | null;   mat_1_dl: number | null
  song_2: string | null;  song_2_dl: number | null
  mat_2: string | null;   mat_2_dl: number | null
  song_3: string | null;  song_3_dl: number | null
  mat_3: string | null;   mat_3_dl: number | null
  ghi_chu: string | null
  thu_tu: number
  trang_thai: boolean
}

export type CauTrucCreate = Omit<CauTruc, 'id'>

export const cauTrucApi = {
  list: (params?: { so_lop?: number; active_only?: boolean }) =>
    client.get<CauTruc[]>('/cau-truc', { params }),

  create: (data: CauTrucCreate) =>
    client.post<CauTruc>('/cau-truc', data),

  update: (id: number, data: CauTrucCreate) =>
    client.put<CauTruc>(`/cau-truc/${id}`, data),

  delete: (id: number) =>
    client.delete(`/cau-truc/${id}`),
}
