import client from './client'

// ─── Internal form state (per-layer, used inside BomCalculatorPanel) ──────────

export interface BomLayerFormState {
  ma_ky_hieu: string | null
  paper_material_id?: number | null
  dinh_luong: number | null
  don_gia_kg: number
}

// ─── API-level layer input (what backend expects in `layers` array) ────────────

export interface BomLayerApiInput {
  vi_tri_lop: string
  loai_lop: 'mat' | 'song'
  flute_type: string | null
  ma_ky_hieu: string
  paper_material_id?: number | null
  dinh_luong: number
  don_gia_kg: number
}

// ─── Request ──────────────────────────────────────────────────────────────────

export interface BomCalculateRequest {
  loai_thung: 'A1' | 'A3' | 'A5' | 'tam'
  dai: number
  rong: number
  cao: number
  so_lop: 3 | 5 | 7
  to_hop_song: string
  layers: BomLayerApiInput[]
  so_luong: number
  // Add-ons
  chong_tham: 0 | 1 | 2
  in_flexo_mau: number
  in_flexo_phu_nen: boolean
  in_ky_thuat_so: boolean
  chap_xa: boolean
  boi: boolean
  be_so_con: 0 | 1 | 2 | 4 | 6 | 8
  can_mang: 0 | 1 | 2
  san_pham_kho: boolean
  // Pricing
  ty_le_loi_nhuan?: number
  hoa_hong_kd_pct: number
  hoa_hong_kh_pct: number
  chi_phi_khac: number
  chiet_khau: number
}

// ─── Response – calculate ─────────────────────────────────────────────────────

export interface BomDimensions {
  kho1: number
  dai1: number
  so_dao: number
  kho_tt: number
  dai_tt: number
  kho_kh: number
  dai_kh: number
  dien_tich: number
}

export interface BomAddonDetail {
  d1_chong_tham: number
  d2_in_flexo: number
  d3_in_ky_thuat_so: number
  d4_chap_xa: number
  d5_boi: number
  d6_be: number
  d8_can_mang: number
  d9_san_pham_kho: number
}

export interface BomLayerResult {
  vi_tri_lop: string
  loai_lop: 'mat' | 'song'
  flute_type: string | null
  ma_ky_hieu: string
  paper_material_id: number | null
  dinh_luong: number
  take_up_factor: number
  dien_tich_1con: number
  trong_luong_1con: number
  chi_phi_1con: number
  so_luong_sx: number
  ty_le_hao_hut: number
  trong_luong_can_tong: number
  don_gia_kg: number
  thanh_tien: number
}

export interface BomCalculateResponse {
  dimensions: BomDimensions
  chi_phi_giay: number
  chi_phi_gian_tiep: number
  ty_le_hao_hut: number
  chi_phi_hao_hut: number
  ty_le_loi_nhuan: number
  loi_nhuan: number
  addon_detail: BomAddonDetail
  chi_phi_addon: number
  gia_ban_co_ban: number
  hoa_hong_kd: number
  hoa_hong_kh: number
  chi_phi_khac: number
  chiet_khau: number
  gia_ban_cuoi: number
  bom_layers: BomLayerResult[]
}

// ─── Response – saved BOM ─────────────────────────────────────────────────────

export interface BomSavedItem {
  vi_tri_lop: string
  loai_lop: string
  flute_type: string | null
  ma_ky_hieu: string | null
  dinh_luong: number
  take_up_factor: number
  so_luong_sx: number
  ty_le_hao_hut: number
  trong_luong_can_tong: number | null
  don_gia_kg: number
  thanh_tien: number | null
}

export interface BomSaved {
  id: number
  production_order_item_id: number | null
  loai_thung: string
  dai: number
  rong: number
  cao: number
  so_lop: number
  to_hop_song: string | null
  so_luong_sx: number
  chong_tham: number
  in_flexo_mau: number
  in_flexo_phu_nen: boolean
  in_ky_thuat_so: boolean
  chap_xa: boolean
  boi: boolean
  be_so_con: number
  can_mang: number
  san_pham_kho: boolean
  ty_le_loi_nhuan: number | null
  hoa_hong_kd_pct: number
  hoa_hong_kh_pct: number
  chi_phi_khac: number
  chiet_khau: number
  gia_ban_cuoi: number | null
  gia_ban_co_ban: number | null
  chi_phi_giay: number | null
  trang_thai: string
  items: BomSavedItem[]
}

export interface BomSaveResponse {
  bom_id: number
  message: string
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const bomApi = {
  calculate: (request: BomCalculateRequest) =>
    client.post<BomCalculateResponse>('/bom/calculate', request),

  save: (request: BomCalculateRequest & { production_order_item_id: number }) =>
    client.post<BomSaved>('/bom/save', request),

  getByItem: (production_order_item_id: number) =>
    client.get<BomSaved>(`/bom/by-item/${production_order_item_id}`),
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const LOAI_THUNG_BOM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'A1',  label: 'A1 – Thùng thường' },
  { value: 'A3',  label: 'A3 – Nắp chồm' },
  { value: 'A5',  label: 'A5 – Âm dương (Nắp/Đáy)' },
  { value: 'tam', label: 'Giấy tấm' },
]

export const SO_LOP_BOM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 3, label: '3 lớp' },
  { value: 5, label: '5 lớp' },
  { value: 7, label: '7 lớp' },
]

// Tổ hợp sóng suggestions by so_lop
export const TO_HOP_SONG_BY_LOP: Record<number, string[]> = {
  3: ['C', 'B', 'E', 'A'],
  5: ['CB', 'CC', 'BC', 'BE', 'AB', 'CE'],
  7: ['CBC', 'BCB', 'CBE', 'ABE', 'BCE'],
}

export const BE_SO_CON_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Không bế' },
  { value: 1, label: '1 con' },
  { value: 2, label: '2 con' },
  { value: 4, label: '4 con' },
  { value: 6, label: '6 con' },
  { value: 8, label: '8 con' },
]

export const CHONG_THAM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Không' },
  { value: 1, label: '1 mặt' },
  { value: 2, label: '2 mặt' },
]

export const CAN_MANG_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Không' },
  { value: 1, label: '1 mặt' },
  { value: 2, label: '2 mặt' },
]

// Vietnamese currency formatter
export const vnd = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(value))
