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
  loai_be?: string | null
  kho_sx?: number | null
  dai_sx?: number | null
  nhom_san_pham?: string | null
  co_tem_offset: boolean
  tem_loai_giay?: string | null
  tem_gsm?: number | null
  tem_don_gia_kg?: number | null
  tem_dai_to?: number | null
  tem_rong_to?: number | null
  tem_sp_per_to: number
  tem_waste_to: number
  tem_so_mau: number
  tem_gia_kem_mau?: number | null
  tem_gia_in_1000to?: number | null
  tem_co_can_mang: boolean
  tem_gia_can_mang_m2?: number | null
  tem_co_khuon_be: boolean
  tem_gia_khuon_be?: number | null
  tem_khuon_be_phan_bo: number
  tem_co_uv: boolean
  tem_gia_uv_m2?: number | null
  tem_co_suppo: boolean
  tem_gia_suppo_m2?: number | null
  tem_co_luoi: boolean
  tem_gia_luoi_m2?: number | null
  tem_hai_manh: boolean
  tem_khac_thiet_ke: boolean
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
  be_so_con?: number | null
  may_in?: string | null
  loai_lan?: string | null
  ban_ve_kt?: string | null
  gia_ban: number
  gia_phoi?: number   // a+b+e — giá chuyển kho phôi
  gia_noi_bo?: number // a+b+c+d+e — giá chuyển kho thành phẩm
  ghi_chu?: string | null
  phan_xuong_id?: number | null
  ten_phan_xuong?: string | null
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
  // Thùng
  { value: 'A1',       label: 'A1 - Thùng thường',   group: 'Thùng' },
  { value: 'A3',       label: 'A3 - Nắp chồm',        group: 'Thùng' },
  { value: 'A5_DAY',   label: 'A5 - Âm dương đáy',    group: 'Thùng' },
  { value: 'A5_NAP',   label: 'A5 - Âm dương nắp',    group: 'Thùng' },
  { value: 'A7',       label: 'A7 - Thùng 1 nắp',     group: 'Thùng' },
  { value: 'GOI_GIUA', label: 'Gói giữa',              group: 'Thùng' },
  { value: 'GOI_SUON', label: 'Gói sườn',              group: 'Thùng' },
  { value: 'LOT',      label: 'Lót (Giấy tấm)',        group: 'Thùng' },
  { value: 'KHAC',     label: 'Khác',                  group: 'Thùng' },
  // Hộp
  { value: 'HOP_CAI',             label: 'Hộp nắp gài',            group: 'Hộp' },
  { value: 'HOP_CAI_CHAU',        label: 'Hộp cài có chấu',        group: 'Hộp' },
  { value: 'HOP_GIAY',            label: 'Hộp giày',               group: 'Hộp' },
  { value: 'HOP_PIZZA',           label: 'Hộp pizza',              group: 'Hộp' },
  { value: 'HOP_NAP_CAI_DAY_GAI', label: 'Hộp nắp cài đáy gài',   group: 'Hộp' },
  { value: 'HOP_NAP_CAI_2_DAU',   label: 'Hộp nắp cài 2 đầu',     group: 'Hộp' },
  { value: 'HOP_AM_DUONG_THAN',   label: 'Hộp âm dương — thân',   group: 'Hộp' },
  { value: 'HOP_AM_DUONG_NAP',    label: 'Hộp âm dương — nắp',    group: 'Hộp' },
  // Khay
  { value: 'KHAY_1_THANH',       label: 'Khay 1 thành',            group: 'Khay' },
  { value: 'KHAY_2_THANH',       label: 'Khay 2 thành',            group: 'Khay' },
  { value: 'KHAY_1_THANH_CHAU',  label: 'Khay 1 thành có chấu',   group: 'Khay' },
  { value: 'KHAY_NUOC_GK',       label: 'Khay nước GK',            group: 'Khay' },
]

export const LOAI_BE_OPTIONS = [
  { value: 'be_tay',        label: 'Bế tay (+1/+1 cm)' },
  { value: 'be_tu_dong_3',  label: 'Bế tự động 3 lớp (+2/+1.5 cm)' },
  { value: 'be_tu_dong_5',  label: 'Bế tự động 5 lớp (+2/+2 cm)' },
  { value: 'be_tu_dong_7',  label: 'Bế tự động 7 lớp (+2/+2 cm)' },
  { value: 'be_tem_offset',  label: 'Bế tem offset (+2/+2 cm)' },
]

export const DIE_CUT_TYPES = new Set([
  'HOP_CAI', 'HOP_CAI_CHAU', 'HOP_GIAY', 'HOP_PIZZA',
  'HOP_NAP_CAI_DAY_GAI', 'HOP_NAP_CAI_2_DAU',
  'HOP_AM_DUONG_THAN', 'HOP_AM_DUONG_NAP',
  'KHAY_1_THANH', 'KHAY_2_THANH', 'KHAY_1_THANH_CHAU', 'KHAY_NUOC_GK',
])

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
  be_so_con: number = 1,
  loai_be: string | null | undefined = null,
): { kho1: number; dai1: number; so_dao: number; kho_tt: number; dai_tt: number; dien_tich: number; kho_ke_hoach: number; dai_ke_hoach: number; kho_sx: number; dai_sx: number; hai_manh: boolean } | null {
  if (!loai_thung || !dai || !rong || !cao) return null
  const D = dai, R = rong, C = cao
  let kho1 = 0, dai1 = 0, dai_tt = 0
  let kho_ke_hoach = 0, dai_ke_hoach = 0
  let kho_sx = 0, dai_sx = 0
  let isDieCut = false

  // Offset kế hoạch theo số lớp (Tài liệu 02 — Giai đoạn 1)
  const off = so_lop <= 3 ? 0.2 : so_lop <= 5 ? 0.4 : 0.8

  // Tề biên lookup
  const TE_BIEN: Record<string, [number, number]> = {
    be_tay:        [1,   1  ],
    be_tu_dong_3:  [2,   1.5],
    be_tu_dong_5:  [2,   2  ],
    be_tu_dong_7:  [2,   2  ],
    be_tem_offset: [2,   2  ],
  }

  switch (loai_thung) {
    case 'A1':
      kho1 = R + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = so_lop === 7 ? (D + R) * 2 + 5 : (D + R) * 2 + 4
      kho_ke_hoach = R + C + off
      dai_ke_hoach = (D + R) * 2 + 3
      break
    case 'A3':
      kho1 = 2 * R + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = (D + R) * 2 + 5
      kho_ke_hoach = R + C + off
      dai_ke_hoach = (D + R) * 2 + 3
      break
    case 'A5':
      kho1 = 2 * C + R + 3
      dai1 = 2 * C + D + 3
      dai_tt = 2 * C + D
      kho_ke_hoach = 2 * C + R
      dai_ke_hoach = 2 * C + D
      break
    case 'A5_DAY':
      kho_ke_hoach = 2 * C + R
      dai_ke_hoach = 2 * C + D
      kho1 = kho_ke_hoach + 2; dai1 = dai_ke_hoach + 2; dai_tt = dai1
      break
    case 'A5_NAP':
      kho_ke_hoach = 2 * C + R + 4
      dai_ke_hoach = 2 * C + D + 4
      kho1 = kho_ke_hoach + 2; dai1 = dai_ke_hoach + 2; dai_tt = dai1
      break
    case 'A7':
      kho1 = R / 2 + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = so_lop === 7 ? (D + R) * 2 + 5 : (D + R) * 2 + 4
      kho_ke_hoach = R / 2 + C + off / 2
      dai_ke_hoach = (D + R) * 2 + 3
      break
    case 'GOI_GIUA':
      kho1 = 2 * R + C + 3
      dai1 = (D + R) * 2 + 5
      dai_tt = so_lop === 7 ? (D + R) * 2 + 5 : (D + R) * 2 + 4
      kho_ke_hoach = 2 * R + C
      dai_ke_hoach = (D + R) * 2
      break
    case 'GOI_SUON':
      kho1 = 2 * R + C + 3
      dai1 = 2 * D + 3 * R + 5
      dai_tt = D + 2 * C + 3
      kho_ke_hoach = 2 * R + C
      dai_ke_hoach = 2 * D + 3 * R
      break
    // ── HỘP ──────────────────────────────────────────────────────────────
    case 'HOP_CAI':
      isDieCut = true
      kho_sx = 3*C + 2*R;       dai_sx = 4*C + D + 0.5
      kho_ke_hoach = kho_sx + 5; dai_ke_hoach = dai_sx + 9.5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'HOP_CAI_CHAU':
      isDieCut = true
      kho_sx = 3*C + 2*R + 3;    dai_sx = 4*C + D + 0.5
      kho_ke_hoach = kho_sx + 7; dai_ke_hoach = dai_sx + 9.5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'HOP_GIAY':
      isDieCut = true
      kho_sx = 3*C + 2*R + 1;    dai_sx = 3*C + D
      kho_ke_hoach = kho_sx + 9; dai_ke_hoach = dai_sx + 10
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'HOP_PIZZA':
      isDieCut = true
      kho_sx = 4*C + 2*R + 1;   dai_sx = 2*C + D
      kho_ke_hoach = kho_sx + 4; dai_ke_hoach = dai_sx + 5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'HOP_NAP_CAI_DAY_GAI':
      isDieCut = true
      kho_sx = (D + R) * 2 + 3;  dai_sx = C + 1.5*R + 6
      kho_ke_hoach = kho_sx + 5; dai_ke_hoach = C + 2*R + 5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'HOP_NAP_CAI_2_DAU':
      isDieCut = true
      kho_sx = (D + R) * 2 + 3;  dai_sx = C + 2*R + 6
      kho_ke_hoach = (D + R + 5) * 2; dai_ke_hoach = C + 2*R + 8
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'HOP_AM_DUONG_THAN':
      isDieCut = true
      kho_sx = 4*C + D + 1;      dai_sx = 2*C + R + 1
      kho_ke_hoach = kho_sx + 4; dai_ke_hoach = dai_sx + 4
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'HOP_AM_DUONG_NAP':
      isDieCut = true
      kho_sx = 4*C + D + 1;      dai_sx = 2*C + R + 1
      kho_ke_hoach = kho_sx + 5; dai_ke_hoach = dai_sx + 5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    // ── KHAY ─────────────────────────────────────────────────────────────
    case 'KHAY_1_THANH':
      isDieCut = true
      kho_sx = 2*C + R + 2;      dai_sx = 3*C + D
      kho_ke_hoach = kho_sx + 5; dai_ke_hoach = dai_sx + 5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'KHAY_2_THANH':
      isDieCut = true
      kho_sx = 3*C + R;           dai_sx = 4*C + D + 2
      kho_ke_hoach = kho_sx + 5;  dai_ke_hoach = dai_sx + 5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'KHAY_1_THANH_CHAU':
      isDieCut = true
      kho_sx = (8/3)*C + R + 4;   dai_sx = 3*C + D
      kho_ke_hoach = kho_sx + 5;  dai_ke_hoach = dai_sx + 5
      kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
      break
    case 'KHAY_NUOC_GK':
      isDieCut = true
      kho_sx = D + 2*C;            dai_sx = R + 2*C
      kho_ke_hoach = kho_sx;       dai_ke_hoach = dai_sx        // dùng kho_sx để tính kho_tt (giấy SX)
      kho1 = kho_sx + 5;           dai1 = dai_sx + 5; dai_tt = dai1  // dùng +5 để tính diện tích giá
      break
    default:
      return null
  }

  // Apply tề biên for die-cut types
  if (isDieCut && loai_be) {
    const [te_kho, te_dai] = TE_BIEN[loai_be] ?? [0, 0]
    kho_ke_hoach += te_kho; dai_ke_hoach += te_dai
    kho_sx       += te_kho; dai_sx       += te_dai
    kho1 = kho_ke_hoach; dai1 = dai_ke_hoach; dai_tt = dai1
    // KHAY_NUOC_GK: kho_ke_hoach = kho_sx (không có +5), kho1 tính giá phải cộng thêm +5
    if (loai_thung === 'KHAY_NUOC_GK') { kho1 = kho_ke_hoach + 5; dai1 = dai_ke_hoach + 5 }
  }

  // For non-die-cut types, kho_sx = kho_ke_hoach, dai_sx = dai_ke_hoach
  if (!isDieCut) {
    kho_sx = kho_ke_hoach; dai_sx = dai_ke_hoach
  }

  if (kho1 <= 0 || dai1 <= 0) return null

  // 2 mảnh: A1/A3/A7 khi ≥3 lớp và dai_ke_hoach > 270 cm
  // Mỗi mảnh: dai_kh_manh = (D+R)+3, diện tích tổng = 2 × kho1 × dai1_manh
  const HAI_MANH_TYPES = new Set(['A1', 'A3', 'A7'])
  let hai_manh = false
  if (so_lop >= 3 && dai_ke_hoach > 270 && HAI_MANH_TYPES.has(loai_thung)) {
    hai_manh = true
    dai_ke_hoach = D + R + 3
    dai1         = D + R + 5
    dai_tt       = D + R + (so_lop === 7 ? 5 : 4)
  }

  // Số dao = số nhóm khuôn bế vừa vào máy 180 cm
  // be_so_con > 1: mỗi nhóm chiếm kho_ke_hoach × be_so_con → số nhóm ít hơn
  const beN = Math.max(1, be_so_con)
  let so_dao = Math.max(1, Math.floor(180 / (kho_ke_hoach * beN)))
  // Khổ thực tế = làm tròn lên bội số 5 của (kho_ke_hoach × beN × soDao + 1.8)
  let kho_tt = Math.ceil((kho_ke_hoach * beN * so_dao + 1.8) / 5) * 5
  // Cap: nếu kho_tt > 180 (vd 60×3+1.8=181.8) thì giảm so_dao xuống 1
  if (kho_tt > 180 && so_dao > 1) {
    so_dao -= 1
    kho_tt = Math.ceil((kho_ke_hoach * beN * so_dao + 1.8) / 5) * 5
  }
  // Diện tích 1 con (m²): 2 mảnh × diện tích mỗi mảnh; bình thường kho1 × dai1
  const dien_tich = hai_manh
    ? 2 * kho1 * dai1 / 10000
    : kho1 >= 180
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
    kho_sx: Math.round(kho_sx * 10) / 10,
    dai_sx: Math.round(dai_sx * 10) / 10,
    hai_manh,
  }
}

// ─── Offset / Tem cost calculator ────────────────────────────────────────────
export interface OffsetCostResult {
  gia_ban_tem_per_cai: number
  so_to: number
  dien_tich_to: number
  detail: {
    chi_phi_giay: number
    chi_phi_in: number
    chi_phi_can_mang: number
    chi_phi_khuon_be: number
    chi_phi_uv: number
    chi_phi_suppo: number
    chi_phi_luoi: number
    tong_chi_phi: number
  }
}

export function calcOffsetCost(
  qty: number,
  ci: Partial<QuoteItem>,
): OffsetCostResult | null {
  if (!qty || qty <= 0 || !ci.co_tem_offset) return null

  const spPerTo = Math.max(ci.tem_sp_per_to ?? 2, 1)
  const wasteTo  = ci.tem_waste_to ?? 150
  const soTo     = (Math.ceil(qty / spPerTo) + wasteTo) * (ci.tem_hai_manh ? 2 : 1)

  const dtTo = ((ci.tem_dai_to ?? 0) * (ci.tem_rong_to ?? 0)) / 10000

  const chiPhiGiay =
    ci.tem_gsm && ci.tem_don_gia_kg && dtTo
      ? soTo * dtTo * (ci.tem_gsm / 1000) * ci.tem_don_gia_kg
      : 0

  const soMau = ci.tem_so_mau ?? 0
  const chiPhiIn =
    soMau > 0
      ? soMau * ((ci.tem_gia_kem_mau ?? 0) * (ci.tem_khac_thiet_ke ? 2 : 1) + (ci.tem_gia_in_1000to ?? 0) * soTo / 1000)
      : 0

  const chiPhiCanMang =
    ci.tem_co_can_mang && ci.tem_gia_can_mang_m2 && dtTo
      ? soTo * dtTo * ci.tem_gia_can_mang_m2
      : 0

  const chiPhiKhuonBe =
    ci.tem_co_khuon_be && ci.tem_gia_khuon_be
      ? (ci.tem_gia_khuon_be / Math.max(ci.tem_khuon_be_phan_bo ?? 10000, 1)) * qty * (ci.tem_khac_thiet_ke ? 2 : 1)
      : 0

  const chiPhiUv =
    ci.tem_co_uv && ci.tem_gia_uv_m2 && dtTo
      ? soTo * dtTo * ci.tem_gia_uv_m2
      : 0

  const chiPhiSuppo =
    ci.tem_co_suppo && ci.tem_gia_suppo_m2 && dtTo
      ? soTo * dtTo * ci.tem_gia_suppo_m2
      : 0

  const chiPhiLuoi =
    ci.tem_co_luoi && ci.tem_gia_luoi_m2 && dtTo
      ? soTo * dtTo * ci.tem_gia_luoi_m2
      : 0

  const tong = chiPhiGiay + chiPhiIn + chiPhiCanMang + chiPhiKhuonBe + chiPhiUv + chiPhiSuppo + chiPhiLuoi
  const perCai = tong / qty

  const r = (v: number) => Math.round(v * 100) / 100
  return {
    gia_ban_tem_per_cai: r(perCai),
    so_to: soTo,
    dien_tich_to: Math.round(dtTo * 1000000) / 1000000,
    detail: {
      chi_phi_giay:     r(chiPhiGiay),
      chi_phi_in:       r(chiPhiIn),
      chi_phi_can_mang: r(chiPhiCanMang),
      chi_phi_khuon_be: r(chiPhiKhuonBe),
      chi_phi_uv:       r(chiPhiUv),
      chi_phi_suppo:    r(chiPhiSuppo),
      chi_phi_luoi:     r(chiPhiLuoi),
      tong_chi_phi:     r(tong),
    },
  }
}

// ─── Offset sheet auto-calc from box dims (dóng + 1cm/cạnh tề) ───────────────
// kho_dong = R+C; dai_dong_1manh = (D+R)*2+3; dai_dong_2manh = (D+R)+3
// rong_to = kho_dong + 2cm; dai_to = dai_dong + 2cm  (1cm mỗi cạnh, 2 cạnh mỗi chiều)
export function calcOffsetSheetDims(d: number, r: number, c: number, haiManh: boolean) {
  const TE = 2
  const khoDong = r + c
  const daiDong = haiManh ? (d + r) + 3 : (d + r) * 2 + 3
  return {
    rong_to: Math.round((khoDong + TE) * 100) / 100,
    dai_to:  Math.round((daiDong  + TE) * 100) / 100,
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

// ─── Auto-tính don_gia_m2 từ gia_ban từng lớp giấy
// Lớp phẳng (mặt): gia_ban × dl / 1000
// Lớp sóng:        gia_ban × dl / 1000 × 1.5  (hệ số uốn sóng)
export function calcDonGiaM2(
  item: Pick<QuoteItem,
    'mat' | 'mat_dl' | 'song_1' | 'song_1_dl' | 'mat_1' | 'mat_1_dl' |
    'song_2' | 'song_2_dl' | 'mat_2' | 'mat_2_dl' | 'song_3' | 'song_3_dl' | 'mat_3' | 'mat_3_dl'
  >,
  giaBanMap: Record<string, number>,
): number | null {
  const layers: { mk: string | null | undefined; dl: number | null | undefined; isSong: boolean }[] = [
    { mk: item.mat,    dl: item.mat_dl,    isSong: false },
    { mk: item.song_1, dl: item.song_1_dl, isSong: true  },
    { mk: item.mat_1,  dl: item.mat_1_dl,  isSong: false },
    { mk: item.song_2, dl: item.song_2_dl, isSong: true  },
    { mk: item.mat_2,  dl: item.mat_2_dl,  isSong: false },
    { mk: item.song_3, dl: item.song_3_dl, isSong: true  },
    { mk: item.mat_3,  dl: item.mat_3_dl,  isSong: false },
  ]

  const active = layers.filter(
    (l): l is { mk: string; dl: number; isSong: boolean } => !!l.mk && l.dl != null && l.dl > 0,
  )
  if (active.length === 0) return null

  let total = 0
  for (const { mk, dl, isSong } of active) {
    const key = paperCodeKey(mk, dl)
    const giaBan = giaBanMap[key]
    if (giaBan == null) return null  // thiếu giá 1 lớp → không auto-fill
    total += giaBan * dl / 1000 * (isSong ? 1.5 : 1)
  }
  return Math.round(total)
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

  bulkCancel: (ids: number[]) =>
    client.post<{ cancelled: number }>('/quotes/bulk-cancel', { ids }),

  copy: (id: number) => client.post<Quote>(`/quotes/${id}/copy`),

  calculateItemPrice: (item: QuoteItem) =>
    client.post<{ gia_ban: number; gia_phoi: number; gia_noi_bo: number }>('/quotes/calculate-item-price', { item }),

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
    client.get<{ ma_ky_hieu: string[]; by_mk: Record<string, number[]>; paper_codes?: Record<string, string>; raw_to_mk?: Record<string, string>; gia_ban_map?: Record<string, number> }>(
      '/paper-materials/options'
    ),
}
