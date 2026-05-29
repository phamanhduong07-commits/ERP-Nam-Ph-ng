import client from './client'

export interface OffsetAddonPrice {
  id: number
  loai_addon: string
  ten: string
  don_gia_m2: number
  active: boolean
  ghi_chu: string | null
}

export interface OffsetAddonPriceCreate {
  loai_addon: string
  ten: string
  don_gia_m2: number
  active?: boolean
  ghi_chu?: string | null
}

export interface OffsetAddonPriceUpdate {
  ten?: string
  don_gia_m2?: number
  active?: boolean
  ghi_chu?: string | null
}

export const LOAI_ADDON_OPTIONS = [
  { value: 'can_mang',  label: 'Cán màng' },
  { value: 'uv',        label: 'UV định hình' },
  { value: 'suppo',     label: 'Suppo / Cán gân' },
  { value: 'luoi',      label: 'Lưới / Trang trí' },
  { value: 'in_offset', label: 'In offset (giá in/1000 tờ/màu)' },
]

export const LOAI_ADDON_LABEL: Record<string, string> = {
  can_mang:  'Cán màng',
  uv:        'UV định hình',
  suppo:     'Suppo / Cán gân',
  luoi:      'Lưới / Trang trí',
  in_offset: 'In offset',
}

export const offsetAddonPricesApi = {
  list: (activeOnly = false) =>
    client.get<OffsetAddonPrice[]>('/offset-addon-prices', { params: { active_only: activeOnly } }),

  lookup: (loai_addon: string) =>
    client.get<OffsetAddonPrice | null>(`/offset-addon-prices/lookup/${loai_addon}`),

  create: (body: OffsetAddonPriceCreate) =>
    client.post<OffsetAddonPrice>('/offset-addon-prices', body),

  update: (id: number, body: OffsetAddonPriceUpdate) =>
    client.put<OffsetAddonPrice>(`/offset-addon-prices/${id}`, body),

  delete: (id: number) =>
    client.delete(`/offset-addon-prices/${id}`),
}
