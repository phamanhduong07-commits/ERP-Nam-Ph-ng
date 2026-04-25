import client from './client'

// ─── Internal form state (per-layer, used inside BomCalculatorPanel) ──────────

export interface BomLayerInput {
  ma_ky_hieu: string | null
  paper_material_id?: number | null
  dinh_luong: number | null
  don_gia_kg: number
}

/** @deprecated Use BomLayerInput instead */
export type BomLayerFormState = BomLayerInput

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
  loai_thung: 'A1' | 'A3' | 'A5' | 'A7' | 'GOI_GIUA' | 'GOI_SUON' | 'TAM'
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

export interface IndirectCostItem {
  ten: string
  don_gia_m2: number
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
  gian_tiep_breakdown: IndirectCostItem[]
}

// ─── Response – from-production-item (auto-calculated, no config needed) ────

export interface BomFromProductionItemResponse extends BomCalculateResponse {
  source: 'quote' | 'cau_truc' | 'product'
  loai_thung: string
  dai: number
  rong: number
  cao: number
  so_lop: number
  to_hop_song: string
  so_luong: number
  bien_phi: number
  gia_ban_bao_gia: number
  lai_gop: number
  ty_le_lai: number
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

export interface BomSavedIndirectItem {
  id: number
  bom_id: number
  ten: string
  don_gia_m2: number
  dien_tich: number
  thanh_tien: number
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
  // Dimensions
  kho_tt: number | null
  dai_tt: number | null
  kho_kh: number | null
  dai_kh: number | null
  dien_tich: number | null
  // Production
  so_luong_sx: number
  ty_le_hao_hut: number | null
  // Costs
  chi_phi_giay: number | null
  chi_phi_gian_tiep: number | null
  chi_phi_hao_hut: number | null
  loi_nhuan: number | null
  chi_phi_addon: number | null
  gia_ban_co_ban: number | null
  gia_ban_cuoi: number | null
  // Add-on config
  chong_tham: number
  in_flexo_mau: number
  in_flexo_phu_nen: boolean
  in_ky_thuat_so: boolean
  chap_xa: boolean
  boi: boolean
  be_so_con: number
  can_mang: number
  san_pham_kho: boolean
  // Pricing
  ty_le_loi_nhuan: number | null
  hoa_hong_kd_pct: number
  hoa_hong_kh_pct: number
  hoa_hong_kd: number | null
  hoa_hong_kh: number | null
  chi_phi_khac: number
  chiet_khau: number
  trang_thai: string
  ghi_chu: string | null
  created_at: string
  updated_at: string
  items: BomSavedItem[]
  indirect_items: BomSavedIndirectItem[]
}

export interface BomSaveResponse {
  bom_id: number
  message: string
}

// ─── API Client ───────────────────────────────────────────────────────────────

// ─── Reverse calculation ──────────────────────────────────────────────────────

export interface BomReverseRequest {
  gia_muc_tieu: number
  loai_thung: string
  dai: number
  rong: number
  cao: number
  so_lop: 3 | 5 | 7
  so_luong?: number
  ty_le_loi_nhuan?: number
  d_total?: number
  hoa_hong_kd_pct?: number
  hoa_hong_kh_pct?: number
  chi_phi_khac?: number
  chiet_khau?: number
}

export interface BomReverseResponse {
  gia_muc_tieu: number
  p_co_ban: number
  b_per_m2: number
  b: number
  c_pct: number
  e_pct: number
  d: number
  a_max: number
  a_max_per_m2: number
  dien_tich: number
  kha_thi: boolean
}

// ─── Indirect cost items (master data) ───────────────────────────────────────

export interface IndirectCostMasterItem {
  id: number
  so_lop: number
  ten: string
  don_gia_m2: number
  thu_tu: number
  ghi_chu: string | null
}

export const indirectCostsApi = {
  list: () => client.get<IndirectCostMasterItem[]>('/indirect-costs'),
  update: (id: number, data: { ten?: string; don_gia_m2?: number; thu_tu?: number }) =>
    client.put<IndirectCostMasterItem>(`/indirect-costs/${id}`, data),
  seed: () => client.post('/indirect-costs/seed', {}),
}

export interface AddonRateItem {
  id: number
  ma_chi_phi: string
  nhom: string
  ten: string
  don_vi: string  // 'm2' | 'pcs' | 'pct'
  don_gia: number
  ghi_chu: string | null
  thu_tu: number
}

export const addonRatesApi = {
  list: () => client.get<AddonRateItem[]>('/addon-rates'),
  update: (id: number, data: { ten?: string; don_gia?: number; ghi_chu?: string }) =>
    client.put<AddonRateItem>(`/addon-rates/${id}`, data),
  seed: () => client.post('/addon-rates/seed', {}),
}

// ─── API Client ───────────────────────────────────────────────────────────────

// Quy cách sản phẩm từ báo giá (để auto-fill BOM calculator)
export interface QuoteSpec {
  source: 'quote' | 'cau_truc' | 'product'
  quote_item_id: number | null
  loai_thung: string
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number
  to_hop_song: string
  so_luong: number
  layers: BomLayerApiInput[]
  chong_tham: number
  in_flexo_mau: number
  in_flexo_phu_nen: boolean
  in_ky_thuat_so: boolean
  chap_xa: boolean
  boi: boolean
  be_so_con: number
  can_mang: number
  san_pham_kho: boolean
}

// ─── BOM Summary (for list page) ─────────────────────────────────────────────

export interface BomSummaryItem {
  id: number
  production_order_item_id: number | null
  ten_hang: string | null
  so_lenh: string | null
  ten_khach_hang: string | null
  ma_khach_hang: string | null
  loai_thung: string
  dai: number
  rong: number
  cao: number
  so_lop: number
  to_hop_song: string | null
  so_luong_sx: number
  chi_phi_giay: number | null
  chi_phi_gian_tiep: number | null
  chi_phi_hao_hut: number | null
  chi_phi_addon: number | null
  gia_ban_cuoi: number | null
  trang_thai: string
  created_at: string
  updated_at: string
}

export const bomApi = {
  listSummary: (params?: { trang_thai?: string; search?: string }) =>
    client.get<BomSummaryItem[]>('/bom/summary', { params }),

  calculate: (request: BomCalculateRequest) =>
    client.post<BomCalculateResponse>('/bom/calculate', request),

  save: (request: BomCalculateRequest & { production_order_item_id?: number; ghi_chu?: string }) =>
    client.post<BomSaved>('/bom/save', request),

  confirm: (bomId: number) =>
    client.patch<BomSaved>(`/bom/${bomId}/confirm`),

  getByItem: (production_order_item_id: number) =>
    client.get<BomSaved>(`/bom/by-item/${production_order_item_id}`),

  get: (bomId: number) => client.get<BomSaved>('/bom/' + bomId),

  getQuoteSpec: (production_order_item_id: number) =>
    client.get<QuoteSpec>(`/bom/quote-spec/${production_order_item_id}`),

  reverseCalculate: (request: BomReverseRequest) =>
    client.post<BomReverseResponse>('/bom/reverse-calculate', request),

  fromProductionItem: (productionOrderItemId: number, soLuong?: number) =>
    client.get<BomFromProductionItemResponse>(
      `/bom/from-production-item/${productionOrderItemId}`,
      soLuong !== undefined ? { params: { so_luong: soLuong } } : undefined,
    ),
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const LOAI_THUNG_BOM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'A1',       label: 'A1 – Thùng thường' },
  { value: 'A3',       label: 'A3 – Nắp chồm' },
  { value: 'A5',       label: 'A5 – Âm dương (Nắp/Đáy)' },
  { value: 'A7',       label: 'A7 – Thùng 1 nắp' },
  { value: 'GOI_GIUA', label: 'Gói giữa' },
  { value: 'GOI_SUON', label: 'Gói sườn' },
  { value: 'TAM',      label: 'Giấy tấm' },
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
