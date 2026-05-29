import client from './client'

export interface TemPaperPrice {
  id: number
  loai_giay: string
  ten: string
  gsm: number | null
  don_gia_kg: number
  active: boolean
  ghi_chu: string | null
}

export interface TemPaperPriceCreate {
  loai_giay: string
  ten: string
  gsm?: number | null
  don_gia_kg: number
  active?: boolean
  ghi_chu?: string | null
}

export interface TemPaperPriceUpdate {
  ten?: string
  gsm?: number | null
  don_gia_kg?: number
  active?: boolean
  ghi_chu?: string | null
}

export const temPaperPricesApi = {
  list: (activeOnly = false) =>
    client.get<TemPaperPrice[]>('/tem-paper-prices', { params: { active_only: activeOnly } }),

  lookup: (loai_giay: string, gsm?: number | null) =>
    client.get<TemPaperPrice | null>('/tem-paper-prices/lookup', {
      params: { loai_giay, ...(gsm != null ? { gsm } : {}) },
    }),

  create: (body: TemPaperPriceCreate) =>
    client.post<TemPaperPrice>('/tem-paper-prices', body),

  update: (id: number, body: TemPaperPriceUpdate) =>
    client.put<TemPaperPrice>(`/tem-paper-prices/${id}`, body),

  delete: (id: number) =>
    client.delete(`/tem-paper-prices/${id}`),
}
