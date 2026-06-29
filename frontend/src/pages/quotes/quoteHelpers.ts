import type { QuoteItem } from '../../api/quotes'
import { LOAI_THUNG_OPTIONS } from '../../api/quotes'

// ─── Finance state type ──────────────────────────────────────────────────────
export interface QuoteFinance {
  chi_phi_bang_in: number
  chi_phi_khuon: number
  chi_phi_van_chuyen: number
  tong_tien_hang: number
  ty_le_vat: number
  tien_vat: number
  chi_phi_hang_hoa_dv: number
  tong_cong: number
  chi_phi_khac_1_ten: string
  chi_phi_khac_1: number
  chi_phi_khac_2_ten: string
  chi_phi_khac_2: number
  chiet_khau: number
  gia_ban: number
  gia_phoi: number
  gia_xuat_phoi_vsp: number
}

export const DEFAULT_FINANCE: QuoteFinance = {
  chi_phi_bang_in: 0,
  chi_phi_khuon: 0,
  chi_phi_van_chuyen: 0,
  tong_tien_hang: 0,
  ty_le_vat: 8,
  tien_vat: 0,
  chi_phi_hang_hoa_dv: 0,
  tong_cong: 0,
  chi_phi_khac_1_ten: '',
  chi_phi_khac_1: 0,
  chi_phi_khac_2_ten: '',
  chi_phi_khac_2: 0,
  chiet_khau: 0,
  gia_ban: 0,
  gia_phoi: 0,
  gia_xuat_phoi_vsp: 0,
}

// ─── Grouped Select options ──────────────────────────────────────────────────
export const LOAI_THUNG_GROUPED = [
  { label: 'Thùng', options: LOAI_THUNG_OPTIONS.filter(o => (o as { group?: string }).group === 'Thùng') },
  { label: 'Hộp',   options: LOAI_THUNG_OPTIONS.filter(o => (o as { group?: string }).group === 'Hộp') },
  { label: 'Khay',  options: LOAI_THUNG_OPTIONS.filter(o => (o as { group?: string }).group === 'Khay') },
]

export const TEM_LOAI_GIAY_OPTIONS = [
  { value: 'duplex',  label: 'Duplex (DUP)' },
  { value: 'ivory',   label: 'Ivory' },
  { value: 'couche',  label: 'Couche' },
  { value: 'kraft',   label: 'Kraft' },
]

// ─── Addon trigger keys (fields that auto-regenerate ghi_chu) ────────────────
export const ADDON_TRIGGER_KEYS: (keyof QuoteItem)[] = [
  'loai_in', 'so_mau', 'do_phu',
  'boi', 'ghim', 'dan', 'chap_xa', 'be_lo', 'do_kho',
  'c_tham', 'can_man',
  'may_in', 'loai_lan', 'ban_ve_kt',
]

// ─── Auto-generate ghi_chu from processing details ──────────────────────────
export function buildGhiChu(ci: QuoteItem): string {
  const parts: string[] = []

  if (ci.loai_in === 'flexo' && (ci.so_mau ?? 0) > 0) {
    parts.push(`FL${ci.so_mau}m${ci.do_phu ? '+PN' : ''}`)
  } else if (ci.loai_in === 'ky_thuat_so') {
    parts.push(ci.do_phu ? 'KTS+PN' : 'KTS')
  } else if (ci.do_phu) {
    parts.push('PN')
  }

  if (ci.boi)     parts.push('Bồi')
  if (ci.ghim)    parts.push('Ghim')
  if (ci.dan)     parts.push('Dán')
  if (ci.chap_xa) parts.push('CX')
  if (ci.be_lo)   parts.push('BL')
  if (ci.do_kho)  parts.push('SP khó')

  if (ci.be_so_con && ci.be_so_con > 1) {
    parts.push(`Bế ${ci.be_so_con}c`)
  }

  if (ci.c_tham && ci.c_tham !== 'Không') {
    const m = ci.c_tham.replace('mặt', 'm').replace(/\s+/, '')
    parts.push(`CT ${m}`)
  }

  if (ci.can_man && ci.can_man !== 'Không') {
    const m = ci.can_man.replace('mặt', 'm').replace(/\s+/, '')
    parts.push(`CM ${m}`)
  }

  if (ci.loai_lan === 'lan_bang')          parts.push('Lằn B')
  else if (ci.loai_lan === 'lan_am_duong') parts.push('Lằn ÂD')
  else if (ci.loai_lan)                    parts.push(ci.loai_lan)

  if (ci.ban_ve_kt) parts.push(`BV:${ci.ban_ve_kt}`)

  return parts.join(' / ')
}

// ─── Empty item template ─────────────────────────────────────────────────────
export function emptyItem(): QuoteItem {
  return {
    stt: 1,
    product_id: null,
    loai: null,
    ma_amis: null,
    ma_ky_hieu: null,
    ten_hang: '',
    dvt: 'Thùng',
    so_luong: 1,
    so_mau: 0,
    so_lop: 3,
    to_hop_song: null,
    mat: null,    mat_dl: null,
    song_1: null, song_1_dl: null,
    mat_1: null,  mat_1_dl: null,
    song_2: null, song_2_dl: null,
    mat_2: null,  mat_2_dl: null,
    song_3: null, song_3_dl: null,
    mat_3: null,  mat_3_dl: null,
    lay_gia_moi_nl: false,
    don_gia_m2: null,
    loai_thung: null,
    dai: null, rong: null, cao: null,
    kho_tt: null, dai_tt: null, dien_tich: null,
    khong_ct: false,
    loai_be: null, kho_sx: null, dai_sx: null,
    ho_mo: false, ho_nap: null, ho_day: null,
    co_be: false,
    be_hai_manh: false,
    nhom_san_pham: null,
    co_tem_offset: false,
    tem_loai_giay: null, tem_gsm: null, tem_don_gia_kg: null,
    tem_dai_to: null, tem_rong_to: null,
    tem_sp_per_to: 2, tem_waste_to: 150, tem_so_mau: 0,
    tem_gia_kem_mau: null, tem_gia_in_1000to: null,
    tem_co_can_mang: false, tem_gia_can_mang_m2: null,
    tem_co_khuon_be: false, tem_gia_khuon_be: null, tem_khuon_be_phan_bo: 10000,
    tem_co_uv: false, tem_gia_uv_m2: null,
    tem_co_suppo: false, tem_gia_suppo_m2: null,
    tem_co_luoi: false, tem_gia_luoi_m2: null,
    tem_hai_manh: false,
    tem_khac_thiet_ke: false,
    loai_in: 'khong_in',
    do_kho: false, ghim: false, chap_xa: false,
    do_phu: false, dan: false, boi: false, be_lo: false,
    c_tham: null, can_man: null, be_so_con: null,
    may_in: null, loai_lan: null, ban_ve_kt: null,
    gia_ban: 0,
    gia_phoi: 0,
    gia_noi_bo: 0,
    ghi_chu: null,
    phan_xuong_id: null,
  }
}
