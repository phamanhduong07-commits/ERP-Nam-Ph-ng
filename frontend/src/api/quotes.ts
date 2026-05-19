import client from './client'
import type { PagedResponse } from './customers'

export interface QuoteItem {
  id?: number
  stt: number
  product_id?: number | null
  loai?: string | null
  ma_amis?: string | null
  ma_ky_hieu?: string | null
  ten_hang: string
  dvt: string
  so_luong: number
  so_mau: number
  // Loại giấy — mỗi lớp: mã ký hiệu đồng cấp (mk) + định lượng g/m² (dl)
  so_lop: number
  to_hop_song?: string | null
  mat?: string | null;     mat_dl?: number | null
  song_1?: string | null;  song_1_dl?: number | null
  mat_1?: string | null;   mat_1_dl?: number | null
  song_2?: string | null;  song_2_dl?: number | null
  mat_2?: string | null;   mat_2_dl?: number | null
  song_3?: string | null;  song_3_dl?: number | null
  mat_3?: string | null;   mat_3_dl?: number | null
  lay_gia_moi_nl: boolean
  don_gia_m2?: number | null
  // Kích thước
  loai_thung?: string | null
  dai?: number | null
  rong?: number | null
  cao?: number | null
  kho_tt?: number | null
  dai_tt?: number | null
  dien_tich?: number | null
  khong_ct: boolean
  // In ấn
  loai_in: string
  do_kho: boolean
  ghim: boolean
  chap_xa: boolean
  do_phu: boolean
  dan: boolean
  boi: boolean
  be_lo: boolean
  c_tham?: string | null
  can_man?: string | null
  so_c_be?: string | null
  may_in?: string | null
  loai_lan?: string | null
  ban_ve_kt?: string | null
  gia_ban: number
  ghi_chu?: string | null
}

export interface Quote {
  id: number
  so_bao_gia: string
  so_bg_copy?: string | null
  ngay_bao_gia: string
  customer_id: number
  customer?: { id: number; ma_kh: string; ten_viet_tat: string; ten_don_vi: string | null } | null
  nv_phu_trach_id?: number | null
  ten_nv_phu_trach?: string | null
  nguoi_duyet_id?: number | null
  ten_nguoi_duyet?: string | null
  approved_at?: string | null
  created_by?: number | null
  created_by_name?: string | null
  phap_nhan_id?: number | null
  ten_phap_nhan?: string | null
  phap_nhan_sx_id?: number | null
  ten_phap_nhan_sx?: string | null
  phan_xuong_id?: number | null
  ten_phan_xuong?: string | null
  nv_theo_doi_id?: number | null
  ten_nv_theo_doi?: string | null
  ngay_het_han?: string | null
  chi_phi_bang_in: number
  chi_phi_khuon: number
  chi_phi_van_chuyen: number
  tong_tien_hang: number
  ty_le_vat: number
  tien_vat: number
  chi_phi_hang_hoa_dv: number
  tong_cong: number
  chi_phi_khac_1_ten?: string | null
  chi_phi_khac_1: number
  chi_phi_khac_2_ten?: string | null
  chi_phi_khac_2: number
  chiet_khau: number
  gia_ban: number
  gia_xuat_phoi_vsp: number
  ghi_chu?: string | null
  dieu_khoan?: string | null
  trang_thai: string
  items: QuoteItem[]
  created_at: string
  updated_at: string
}

export interface QuoteListItem {
  id: number
  so_bao_gia: string
  ngay_bao_gia: string
  customer_id: number
  ten_khach_hang?: string | null
  trang_thai: string
  ngay_het_han?: string | null
  tong_cong: number
  so_dong: number
  created_at: string
  created_by_name?: string | null
  phap_nhan_id?: number | null
  ten_phap_nhan?: string | null
}

export interface CreateQuotePayload {
  customer_id: number
  ngay_bao_gia: string
  phap_nhan_id?: number | null
  phap_nhan_sx_id?: number | null
  phan_xuong_id?: number | null
  nv_phu_trach_id?: number | null
  nv_theo_doi_id?: number | null
  ngay_het_han?: string | null
  so_bg_copy?: string | null
  chi_phi_bang_in?: number
  chi_phi_khuon?: number
  chi_phi_van_chuyen?: number
  tong_tien_hang?: number
  ty_le_vat?: number
  tien_vat?: number
  chi_phi_hang_hoa_dv?: number
  tong_cong?: number
  chi_phi_khac_1_ten?: string | null
  chi_phi_khac_1?: number
  chi_phi_khac_2_ten?: string | null
  chi_phi_khac_2?: number
  chiet_khau?: number
  gia_ban?: number
  gia_xuat_phoi_vsp?: number
  ghi_chu?: string | null
  dieu_khoan?: string | null
  items: Omit<QuoteItem, 'id'>[]
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới',
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  het_han: 'Hết hạn',
  huy: 'Huỷ',
}

export const QUOTE_STATUS_COLORS: Record<string, string> = {
  moi: 'blue',
  cho_duyet: 'gold',
  da_duyet: 'green',
  het_han: 'orange',
  huy: 'red',
}

export const LOAI_LAN_OPTIONS = [
  { value: 'lan_bang',     label: 'Lằn bằng' },
  { value: 'lan_am_duong', label: 'Lằn âm dương' },
]

export const LOAI_LAN_LABELS: Record<string, string> = {
  lan_bang:     'Lằn bằng',
  lan_am_duong: 'Lằn âm dương',
}

export const LOAI_IN_OPTIONS = [
  { value: 'khong_in', label: 'Không in' },
  { value: 'flexo', label: 'Flexo' },
  { value: 'ky_thuat_so', label: 'Kỹ thuật số' },
]

export const LOAI_THUNG_OPTIONS = [
  { value: 'A1', label: 'A1 - Thùng thường' },
  { value: 'A3', label: 'A3 - Nắp chồm' },
  { value: 'A5', label: 'A5 - Âm dương (Nắp/Đáy)' },
  { value: 'A7', label: 'A7 - Thùng 1 nắp' },
  { value: 'GOI_GIUA', label: 'Gói giữa' },
  { value: 'GOI_SUON', label: 'Gói sườn' },
  { value: 'LOT', label: 'Lót (Giấy tấm)' },
  { value: 'KHAC', label: 'Khác' },
]

export const SO_LOP_OPTIONS = [1, 3, 5, 7]

// Tổ hợp sóng theo số lớp
export const TO_HOP_SONG_OPTIONS: Record<number, string[]> = {
  1: [],
  3: ['A', 'B', 'C', 'E'],
  5: ['AB', 'BC', 'BE', 'AE', 'CE'],
  7: ['BCE', 'ABE'],
}

// Lấy ký tự sóng từ vị trí trong to_hop_song. VD: "BC", idx=0 → "B", idx=1 → "C"
export function getSongType(to_hop_song: string | null | undefined, idx: number): string {
  if (!to_hop_song) return `${idx + 1}`
  return to_hop_song[idx] ?? `${idx + 1}`
}

export function paperCodeKey(code?: string | null, dl?: number | string | null): string {
  const dlText = dl == null || dl === '' ? '' : String(Number(dl))
  return `${code || ''}|${dlText}`
}

export function buildPaperSymbol(
  item: Pick<QuoteItem,
    'mat' | 'mat_dl' | 'song_1' | 'song_1_dl' | 'mat_1' | 'mat_1_dl' |
    'song_2' | 'song_2_dl' | 'mat_2' | 'mat_2_dl' | 'song_3' | 'song_3_dl' | 'mat_3' | 'mat_3_dl'
  >,
  _paperCodes: Record<string, string> = {},
): string | null {
  type PaperLayerKey = keyof typeof item
  const layers: [PaperLayerKey, PaperLayerKey][] = [
    ['mat', 'mat_dl'],
    ['song_1', 'song_1_dl'],
    ['mat_1', 'mat_1_dl'],
    ['song_2', 'song_2_dl'],
    ['mat_2', 'mat_2_dl'],
    ['song_3', 'song_3_dl'],
    ['mat_3', 'mat_3_dl'],
  ]
  const parts = layers
    .map(([codeKey]) => {
      const code = item[codeKey] as string | null | undefined
      if (!code) return null
      return code
    })
    .filter(Boolean) as string[]
  return parts.length ? parts.join('.') : null
}

// ─── Dimension auto-calculation (TÀI LIỆU 02) ─────────────────────────────
// Input: cm. Output: { kho_tt, dai_tt, dien_tich (m²) }
export function calcBoxDimensions(
  loai_thung: string | null | undefined,
  dai: number | null | undefined,   // cm
  rong: number | null | undefined,  // cm
  cao: number | null | undefined,   // cm
  so_lop: number,
): { kho1: number; dai1: number; so_dao: number; kho_tt: number; dai_tt: number; dien_tich: number; kho_ke_hoach: number; dai_ke_hoach: number } | null {
  if (!loai_thung || !dai || !rong || !cao) return null
  const D = dai, R = rong, C = cao
  let kho1 = 0, dai1 = 0, dai_tt = 0
  let kho_ke_hoach = 0, dai_ke_hoach = 0

  // Offset kế hoạch theo số lớp (Tài liệu 02 — Giai đoạn 1)
  const off = so_lop <= 3 ? 0.2 : so_lop <= 5 ? 0.4 : 0.8

  switch (loai_thung) {
    case 'A1': // Thùng thường
      kho1 = R + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = so_lop === 7 ? (D + R) * 2 + 5 : (D + R) * 2 + 4
      kho_ke_hoach = R + C + off
      dai_ke_hoach = (D + R) * 2 + 3
      break
    case 'A3': // Nắp chồm
      kho1 = 2 * R + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = (D + R) * 2 + 5
      kho_ke_hoach = R + C + off
      dai_ke_hoach = (D + R) * 2 + 3
      break
    case 'A5': // Âm dương (Nắp/Đáy)
      kho1 = 2 * C + R + 3
      dai1 = 2 * C + D + 3
      dai_tt = 2 * C + D
      kho_ke_hoach = 2 * C + R
      dai_ke_hoach = 2 * C + D
      break
    case 'A7': // Thùng 1 nắp
      kho1 = R / 2 + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = so_lop === 7 ? (D + R) * 2 + 5 : (D + R) * 2 + 4
      kho_ke_hoach = R / 2 + C + off / 2
      dai_ke_hoach = (D + R) * 2 + 3
      break
    case 'GOI_GIUA': // Gói giữa
      kho1 = 2 * R + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = so_lop === 7 ? (D + R) * 2 + 5 : (D + R) * 2 + 4
      kho_ke_hoach = 2 * R + C
      dai_ke_hoach = (D + R) * 2
      break
    case 'GOI_SUON': // Gói sườn
      kho1 = 2 * R + C + 3
      dai1 = 2 * D + 3 * R + 5
      dai_tt = so_lop === 7 ? D + 2 * C + 3 : D + 2 * C + 3
      kho_ke_hoach = 2 * R + C
      dai_ke_hoach = 2 * D + 3 * R
      break
    default:
      return null
  }

  if (kho1 <= 0 || dai1 <= 0) return null

  // Số dao = floor(180 / kho_ke_hoach) — dùng kích thước kế hoạch (không có tab dán)
  const so_dao = Math.max(1, Math.floor(180 / kho_ke_hoach))
  // Khổ thực tế = làm tròn lên bội số 5 của (kho_ke_hoach × soDao + 1.8)
  const kho_tt = Math.ceil((kho_ke_hoach * so_dao + 1.8) / 5) * 5
  // Diện tích 1 con (m²) - dùng kho1 và dai1
  const dien_tich = kho1 >= 180
    ? (kho1 + 5) * dai1 / 10000
    : kho1 * dai1 / 10000

  return {
    kho1: Math.round(kho1 * 10) / 10,
    dai1: Math.round(dai1 * 10) / 10,
    so_dao,
    kho_tt: Math.round(kho_tt * 10) / 10,
    dai_tt: Math.round(dai_tt * 10) / 10,
    dien_tich: Math.round(dien_tich * 10000) / 10000,
    kho_ke_hoach: Math.round(kho_ke_hoach * 10) / 10,
    dai_ke_hoach: Math.round(dai_ke_hoach * 10) / 10,
  }
}

// ─── Waste rate table (TÀI LIỆU 01, mục e – Thùng) ───────────────────────────
export function getHaoHutRate(so_luong: number): number {
  if (so_luong < 200) return 0.30
  if (so_luong < 400) return 0.20
  if (so_luong < 600) return 0.15
  if (so_luong < 1000) return 0.10
  if (so_luong < 1500) return 0.08
  if (so_luong < 2000) return 0.07
  return 0.06
}

// ─── Profit rate by lop (TÀI LIỆU 01, mục c – Thùng: 6%) ────────────────────
export function getLoiNhuanRate(so_lop: number): number {
  // Giấy thùng: 6% (document says "Giấy thùng: 6% -> + thêm 10%" but base is 6%)
  if (so_lop === 3) return 0.06
  if (so_lop === 5) return 0.06
  if (so_lop === 7) return 0.06
  return 0.06
}

// ─── Suggest gia_ban per thùng (simplified formula without 'b' indirect costs)
// gia_ban = a * (1 + hao_hut_rate) * (1 + loi_nhuan_rate)
export function suggestGiaBan(
  don_gia_m2: number,
  dien_tich: number,
  so_luong: number,
  so_lop: number,
): number {
  const a = don_gia_m2 * dien_tich  // paper cost per box
  const hh = getHaoHutRate(so_luong)
  const ln = getLoiNhuanRate(so_lop)
  const gia = a * (1 + hh) * (1 + ln)
  return Math.round(gia)
}

export const quotesApi = {
  list: (params?: {
    search?: string
    trang_thai?: string
    customer_id?: number
    created_by?: number
    phap_nhan_id?: number
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<PagedResponse<QuoteListItem>>('/quotes', { params }),

  get: (id: number) => client.get<Quote>(`/quotes/${id}`),

  create: (data: CreateQuotePayload) => client.post<Quote>('/quotes', data),

  update: (id: number, data: Partial<CreateQuotePayload>) =>
    client.put<Quote>(`/quotes/${id}`, data),

  submit: (id: number) => client.patch<Quote>(`/quotes/${id}/submit`),

  approve: (id: number) => client.patch<Quote>(`/quotes/${id}/approve`),

  cancel: (id: number) => client.patch(`/quotes/${id}/cancel`),

  copy: (id: number) => client.post<Quote>(`/quotes/${id}/copy`),

  calculateItemPrice: (item: QuoteItem) =>
    client.post<{ gia_ban: number; gia_noi_bo: number }>('/quotes/calculate-item-price', { item }),

  taoDonHang: (id: number, item_ids?: number[]) =>
    client.post<{ so_don: string; order_id: number; message: string }>(
      `/quotes/${id}/tao-don-hang`,
      item_ids ? { item_ids } : {}
    ),

  giaHan: (id: number, ngay_het_han: string) =>
    client.patch<Quote>(`/quotes/${id}/gia-han`, { ngay_het_han }),

  counts: () => client.get<Record<string, number>>('/quotes/counts'),
}

export const paperMaterialsApi = {
  search: (q: string, limit = 50) =>
    client.get<{ value: string; label: string; ma_ky_hieu: string | null; dinh_luong: number | null }[]>(
      '/paper-materials/search',
      { params: { q, limit } }
    ),

  options: () =>
    client.get<{ ma_ky_hieu: string[]; by_mk: Record<string, number[]>; paper_codes?: Record<string, string> }>(
      '/paper-materials/options'
    ),
}
