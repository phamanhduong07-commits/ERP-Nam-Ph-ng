import client from './client'

export interface MayIn {
  id: number
  ten_may: string
  sort_order: number
  active: boolean
  capacity: number | null
}

export interface ShiftCa {
  id: number
  name: string
  leader: string | null
  active: boolean
}

export interface ShiftConfigItem {
  id: number
  may_in_id: number
  ten_may: string | null
  shift_ca_id: number
  ten_ca: string | null
  ngay: string
  gio_lam: number | null
  gio_bat_dau: string | null
  gio_ket_thuc: string | null
  nghi_1: number | null
  nghi_2: number | null
  created_at: string
}

export interface PrinterUser {
  id: number
  rfid_key: string | null
  token_user: string
  shift: number | null
  active: boolean
  created_at: string
}

export interface MaySauIn {
  id: number
  ten_may: string
  sort_order: number
  active: boolean
}

export interface PhieuIn {
  id: number
  so_phieu: string
  production_order_id: number | null
  may_in_id: number | null
  ten_may: string | null
  trang_thai: string
  sort_order: number
  ten_hang: string | null
  ma_kh: string | null
  ten_khach_hang: string | null
  quy_cach: string | null
  so_luong_phoi: number | null
  ngay_lenh: string | null
  loai_in: string | null
  loai: string | null
  ths: string | null
  pp_ghep: string | null
  ghi_chu_printer: string | null
  ghi_chu_prepare: string | null
  so_don: string | null
  ngay_giao_hang: string | null
  ghi_chu: string | null
  ngay_in: string | null
  ca: string | null
  so_luong_in_ok: number | null
  so_luong_loi: number | null
  so_luong_setup: number | null
  so_lan_setup: number | null
  ghi_chu_ket_qua: string | null
  ngay_sau_in: string | null
  ca_sau_in: string | null
  so_luong_sau_in_ok: number | null
  so_luong_sau_in_loi: number | null
  ghi_chu_sau_in: string | null
  may_sau_in_id: number | null
  ten_may_sau_in: string | null
  created_at: string
}

export interface SauInKanbanData {
  may_sau_ins: { id: number; ten_may: string }[]
  cho_gang_may: PhieuIn[]
  machines: Record<string, PhieuIn[]>
}

export interface KanbanData {
  may_ins: MayIn[]
  columns: Record<string, PhieuIn[]>
}

export interface CreatePhieuInPayload {
  production_order_id?: number
  ten_hang?: string
  ma_kh?: string
  ten_khach_hang?: string
  quy_cach?: string
  so_luong_phoi?: number
  ngay_lenh?: string
  loai_in?: string
  loai?: string
  ths?: string
  pp_ghep?: string
  ghi_chu_printer?: string
  ghi_chu_prepare?: string
  so_don?: string
  ngay_giao_hang?: string
  ghi_chu?: string
}

export interface CompletePayload {
  ngay_in?: string
  ca?: string
  so_luong_in_ok?: number
  so_luong_loi?: number
  so_luong_setup?: number
  so_lan_setup?: number
  ghi_chu_ket_qua?: string
}

export interface SauInPayload {
  ngay_sau_in?: string
  ca_sau_in?: string
  so_luong_sau_in_ok?: number
  so_luong_sau_in_loi?: number
  ghi_chu_sau_in?: string
}

export interface MayScan {
  id: number
  ten_may: string
  sort_order: number
  active: boolean
  don_gia: number | null
}

export interface ScanLog {
  id: number
  may_scan_id: number
  ten_may: string | null
  so_lsx: string
  ten_hang: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  kho_tt: number | null
  dien_tich: number | null
  so_luong_tp: number
  don_gia: number | null
  tien_luong: number | null
  nguoi_sx: string | null
  ghi_chu: string | null
  created_at: string
}

export interface ScanLookupResult {
  so_lsx: string
  ten_hang: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  kho_tt: number | null
  dai_tt: number | null
  dien_tich_don_vi: number | null
}

export interface ScanLogCreate {
  may_scan_id: number
  so_lsx: string
  ten_hang?: string
  dai?: number
  rong?: number
  cao?: number
  kho_tt?: number
  dien_tich?: number
  so_luong_tp: number
  don_gia?: number
  nguoi_sx?: string
  ghi_chu?: string
}

export interface DashboardData {
  phieu_in_counts: Record<string, number>
  scan_24h: {
    so_lan: number
    so_luong_tp: number
    dien_tich: number
    tien_luong: number
  }
  in_hoan_thanh_hom_nay: number
  may_scan_stats: {
    may_scan_id: number
    ten_may: string
    so_lan: number
    sl_tp: number
    tien_luong: number
  }[]
}

export const TRANG_THAI_LABELS: Record<string, string> = {
  dang_sau_in: 'Đang sau in',
  cho_in: 'Chờ in',
  ke_hoach: 'Kế hoạch',
  dang_in: 'Đang in',
  cho_dinh_hinh: 'Chờ định hình',
  sau_in: 'Sau in',
  hoan_thanh: 'Hoàn thành',
  huy: 'Huỷ',
}

export const TRANG_THAI_COLORS: Record<string, string> = {
  cho_in: 'default',
  ke_hoach: 'blue',
  dang_in: 'orange',
  cho_dinh_hinh: 'purple',
  sau_in: 'cyan',
  hoan_thanh: 'green',
  huy: 'red',
}

export const cd2Api = {
  // Máy in
  listMayIn: () => client.get<MayIn[]>('/cd2/may-in'),
  createMayIn: (data: { ten_may: string; sort_order?: number }) =>
    client.post<MayIn>('/cd2/may-in', data),
  updateMayIn: (id: number, data: Partial<MayIn>) =>
    client.put<MayIn>(`/cd2/may-in/${id}`, data),
  deleteMayIn: (id: number) => client.delete(`/cd2/may-in/${id}`),

  // Kanban
  getKanban: () => client.get<KanbanData>('/cd2/kanban'),

  // Phiếu in
  listPhieuIn: (params?: { search?: string; trang_thai?: string }) =>
    client.get<PhieuIn[]>('/cd2/phieu-in', { params }),
  getPhieuIn: (id: number) => client.get<PhieuIn>(`/cd2/phieu-in/${id}`),
  createPhieuIn: (data: CreatePhieuInPayload) =>
    client.post<PhieuIn>('/cd2/phieu-in', data),
  createFromLenhSx: (orderId: number) =>
    client.post<PhieuIn>(`/cd2/phieu-in/tu-lenh-sx/${orderId}`),
  updatePhieuIn: (id: number, data: Partial<CreatePhieuInPayload>) =>
    client.put<PhieuIn>(`/cd2/phieu-in/${id}`, data),
  deletePhieuIn: (id: number) => client.delete(`/cd2/phieu-in/${id}`),
  movePhieuIn: (id: number, body: { trang_thai: string; may_in_id?: number | null; sort_order?: number }) =>
    client.patch<PhieuIn>(`/cd2/phieu-in/${id}/move`, body),
  startPrinting: (id: number) => client.patch<PhieuIn>(`/cd2/phieu-in/${id}/start`),
  completePrinting: (id: number, data: CompletePayload) =>
    client.patch<PhieuIn>(`/cd2/phieu-in/${id}/complete`, data),
  startSauIn: (id: number, data: SauInPayload) =>
    client.patch<PhieuIn>(`/cd2/phieu-in/${id}/sau-in`, data),
  hoanThanh: (id: number) => client.patch<PhieuIn>(`/cd2/phieu-in/${id}/hoan-thanh`),
  assignSauIn: (id: number, maySauInId: number | null) =>
    client.patch<PhieuIn>(`/cd2/phieu-in/${id}/assign-sauin`, { may_sau_in_id: maySauInId }),
  batDauSauIn: (id: number) => client.patch<PhieuIn>(`/cd2/phieu-in/${id}/bat-dau-sauin`),
  traVeSauIn: (id: number) => client.patch<PhieuIn>(`/cd2/phieu-in/${id}/tra-ve-sauin`),
  huyPhieu: (id: number) => client.patch<PhieuIn>(`/cd2/phieu-in/${id}/huy`),

  // Máy sau in
  listMaySauIn: () => client.get<MaySauIn[]>('/cd2/may-sau-in'),
  createMaySauIn: (data: { ten_may: string; sort_order?: number }) =>
    client.post<MaySauIn>('/cd2/may-sau-in', data),
  updateMaySauIn: (id: number, data: Partial<MaySauIn>) =>
    client.put<MaySauIn>(`/cd2/may-sau-in/${id}`, data),
  deleteMaySauIn: (id: number) => client.delete(`/cd2/may-sau-in/${id}`),

  // Sauin kanban
  getSauInKanban: () => client.get<SauInKanbanData>('/cd2/sauin/kanban'),

  // Máy Scan
  listMayScan: () => client.get<MayScan[]>('/cd2/may-scan'),
  createMayScan: (data: { ten_may: string; sort_order?: number; don_gia?: number }) =>
    client.post<MayScan>('/cd2/may-scan', data),
  updateMayScan: (id: number, data: Partial<MayScan>) =>
    client.put<MayScan>(`/cd2/may-scan/${id}`, data),
  deleteMayScan: (id: number) => client.delete(`/cd2/may-scan/${id}`),

  // Scan
  scanLookup: (soLsx: string) => client.get<ScanLookupResult>(`/cd2/scan/lookup/${encodeURIComponent(soLsx)}`),
  createScanLog: (data: ScanLogCreate) => client.post<ScanLog>('/cd2/scan/log', data),
  getScanHistory: (params?: { may_scan_id?: number; days?: number; so_lsx?: string }) =>
    client.get<ScanLog[]>('/cd2/scan/history', { params }),
  deleteScanLog: (id: number) => client.delete(`/cd2/scan/log/${id}`),

  // Dashboard & History
  getDashboard: () => client.get<DashboardData>('/cd2/dashboard'),
  getHistoryPhieuIn: (params?: { days?: number; search?: string; trang_thai?: string }) =>
    client.get<PhieuIn[]>('/cd2/history/phieu-in', { params }),

  // Shift ca
  listShiftCa: () => client.get<ShiftCa[]>('/cd2/shift/ca'),
  createShiftCa: (data: { name: string; leader?: string }) =>
    client.post<ShiftCa>('/cd2/shift/ca', data),
  updateShiftCa: (id: number, data: Partial<ShiftCa>) =>
    client.put<ShiftCa>(`/cd2/shift/ca/${id}`, data),
  deleteShiftCa: (id: number) => client.delete(`/cd2/shift/ca/${id}`),

  // Shift config
  listShiftConfig: (params?: { may_in_id?: number; shift_ca_id?: number; days?: number }) =>
    client.get<ShiftConfigItem[]>('/cd2/shift/config', { params }),
  createShiftConfig: (data: {
    may_in_id: number; shift_ca_id: number; ngay: string;
    gio_lam?: number; gio_bat_dau?: string; gio_ket_thuc?: string;
    nghi_1?: number; nghi_2?: number
  }) => client.post<ShiftConfigItem>('/cd2/shift/config', data),
  deleteShiftConfig: (id: number) => client.delete(`/cd2/shift/config/${id}`),

  // Printer user
  listPrinterUser: () => client.get<PrinterUser[]>('/cd2/config/printer-user'),
  createPrinterUser: (data: { token_user: string; token_password: string; rfid_key?: string; shift?: number }) =>
    client.post<PrinterUser>('/cd2/config/printer-user', data),
  updatePrinterUser: (id: number, data: { token_user?: string; token_password?: string; rfid_key?: string; shift?: number; active?: boolean }) =>
    client.put<PrinterUser>(`/cd2/config/printer-user/${id}`, data),
  deletePrinterUser: (id: number) => client.delete(`/cd2/config/printer-user/${id}`),
}
