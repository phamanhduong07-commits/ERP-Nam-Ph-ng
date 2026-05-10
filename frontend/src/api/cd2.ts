import client from './client'

export interface Machine {
  id: number
  ten_may: string
  ma_may?: string
  loai_may: string
  sort_order: number
  active: boolean
  phan_xuong_id?: number
}

export interface ProductionLog {
  id: number
  production_order_id: number
  phieu_in_id?: number
  machine_id: number
  event_type: string
  quantity_ok?: number
  quantity_loi?: number
  quantity_setup?: number
  ghi_chu?: string
  created_at: string
  worker?: string
}

export interface TrackPayload {
  production_order_id: number
  so_lsx?: string
  machine_id: number
  event_type: 'start' | 'stop' | 'resume' | 'complete' | 'error'
  quantity_ok?: number
  quantity_loi?: number
  quantity_setup?: number
  ghi_chu?: string
}

export interface MayIn {
  id: number
  ten_may: string
  active: boolean
  sort_order: number
  phan_xuong_id?: number
  capacity?: number | null
}

export interface MaySauIn {
  id: number
  ten_may: string
  active: boolean
  sort_order: number
  phan_xuong_id?: number
}

export interface MayScan {
  id: number
  ten_may: string
  active: boolean
  sort_order: number
  phan_xuong_id?: number
  don_gia: number | null
}

export interface PrinterUser {
  id: number
  token_user: string
  token_password?: string
  rfid_key?: string | null
  shift?: number | null
  active: boolean
  machine_id?: number | null
  machine_name?: string
}

export interface WorkerSession {
  printer_user_id: number
  worker_name: string
  shift?: number | null
  machine_id: number
  machine_name: string
  loai_may: string
}

export interface PhieuIn {
  id: number
  so_phieu: string
  so_lsx: string
  production_order_id?: number | null
  ten_hang?: string
  ten_khach_hang?: string
  ma_kh?: string
  quy_cach?: string
  loai?: string
  loai_in?: string
  pp_ghep?: string
  so_don?: string
  ngay_lenh?: string
  ngay_giao_hang?: string
  ghi_chu_printer?: string
  ghi_chu_prepare?: string
  ghi_chu?: string
  so_luong_phoi: number
  trang_thai: string
  may_in_id?: number | null
  ten_may?: string
  nguoi_in_id?: number
  ten_nguoi_in?: string
  ghi_chu_in?: string
  created_at: string
  updated_at: string
  kho_tt?: number
  dai_tt?: number
  ths?: string
  // Kết quả in
  so_luong_in_ok?: number
  ngay_in?: string
  ca?: string
  so_luong_loi?: number
  so_luong_setup?: number
  so_lan_setup?: number
  ghi_chu_ket_qua?: string
  // Kết quả sau in
  ngay_sau_in?: string
  ca_sau_in?: string
  so_luong_sau_in_ok?: number
  so_luong_sau_in_loi?: number
  ghi_chu_sau_in?: string
  // Thời gian thực (timestamps)
  gio_bat_dau_in?: string
  gio_hoan_thanh?: string
  gio_bat_dau_dinh_hinh?: string
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

export interface KanbanData {
  columns: Record<string, PhieuIn[]>
  may_ins: MayIn[]
}

export interface SauInKanbanData {
  may_sau_ins: MaySauIn[]
  cho_gang_may: PhieuIn[]
  machines: Record<string, PhieuIn[]>
}

export interface ScanLog {
  id: number
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
  tien_luong?: number
  nguoi_sx?: string
  created_at: string
}

export interface ScanLookupResult {
  so_lsx: string
  ten_hang?: string
  kho_tt?: number
  dai_tt?: number
  dien_tich_don_vi?: number
  dai?: number
  rong?: number
  cao?: number
}

export interface ShiftCa {
  id: number
  name: string
  leader?: string | null
  active: boolean
  phan_xuong_id?: number
}

export interface ShiftConfigItem {
  id: number
  may_in_id: number
  shift_ca_id: number
  ngay: string
  gio_lam?: number | null
  gio_bat_dau?: string | null
  gio_ket_thuc?: string | null
  nghi_1?: number | null
  nghi_2?: number | null
  ten_may?: string
  ten_ca?: string
}

export const TRANG_THAI_COLORS: Record<string, string> = {
  cho_in: 'orange',
  ke_hoach: 'blue',
  dang_in: 'volcano',
  cho_dinh_hinh: 'purple',
  sau_in: 'cyan',
  dang_sau_in: 'geekblue',
  hoan_thanh: 'green',
}

export const TRANG_THAI_LABELS: Record<string, string> = {
  cho_in: 'Chờ in',
  ke_hoach: 'Kế hoạch',
  dang_in: 'Đang in',
  cho_dinh_hinh: 'Chờ định hình',
  sau_in: 'Sau in',
  dang_sau_in: 'Đang sau in',
  hoan_thanh: 'Hoàn thành',
}

export interface KhoRow {
  production_order_id: number
  so_lenh: string
  ten_hang: string | null
  ten_khach_hang: string | null
  ten_phap_nhan_sx: string | null
  order_ten_phan_xuong: string | null
  warehouse_id: number | null
  ten_phan_xuong: string | null
  phan_xuong_id: number | null
  cong_doan: string | null
  co_in: boolean
  chieu_kho: number | null
  chieu_cat: number | null
  tong_nhap: number
  tong_xuat: number
  tong_chuyen_phoi: number
  ton_kho: number
  ton_kho_tai_nguon: number  // phôi còn tại kho Hoàng Gia chưa chuyển đi (chỉ có nghĩa với CD2 xưởng)
  ton_kho_tai_cd2: number    // phôi đã đến kho CD2 chưa sản xuất
  don_gia_noi_bo: number | null  // giá nội bộ chuyển kho (đ/tấm) — từ LSX, dùng cho hạch toán quản trị
  phieu_in_hien_tai: { so_phieu: string; trang_thai: string } | null
}

export const cd2Api = {
  // Dashboard & monitor
  getDashboard: (params?: any) => client.get('/cd2/dashboard', { params }),
  getMachinesStatus: (phanXuongId?: number) =>
    client.get<any[]>('/cd2/monitor/machines', { params: { phan_xuong_id: phanXuongId } }),

  // Phiếu in — list / kanban
  listPhieuIn: (params?: any) => client.get<PhieuIn[]>('/cd2/phieu-in', { params }),
  getPhieuIn: (id: number) => client.get<PhieuIn>(`/cd2/phieu-in/${id}`),
  getKanban: (params?: any) => client.get<KanbanData>('/cd2/kanban', { params }),
  getSauInKanban: (params?: any) => client.get<SauInKanbanData>('/cd2/sau-in-kanban', { params }),
  getHistoryPhieuIn: (params?: any) => client.get<PhieuIn[]>('/cd2/history/phieu-in', { params }),

  // Phiếu in — CRUD & actions
  createPhieuIn: (data: any) => client.post<PhieuIn>('/cd2/phieu-in', data),
  updatePhieuIn: (id: number, data: any) => client.put<PhieuIn>(`/cd2/phieu-in/${id}`, data),
  deletePhieuIn: (id: number) => client.delete(`/cd2/phieu-in/${id}`),
  movePhieuIn: (id: number, data: { trang_thai?: string; may_in_id?: number | null; sort_order?: number }) =>
    client.put(`/cd2/phieu-in/${id}/move`, data),
  startPrinting: (id: number) => client.post(`/cd2/phieu-in/${id}/start`),
  completePrinting: (id: number, data: CompletePayload) => client.post(`/cd2/phieu-in/${id}/complete`, data),
  startSauIn: (id: number, data: SauInPayload) => client.post(`/cd2/phieu-in/${id}/sau-in`, data),
  hoanThanh: (id: number) => client.post(`/cd2/phieu-in/${id}/hoan-thanh`),
  huyPhieu: (id: number) => client.post(`/cd2/phieu-in/${id}/huy`),
  assignSauIn: (id: number, maySauInId: number) =>
    client.post(`/cd2/phieu-in/${id}/assign-sau-in`, { may_sau_in_id: maySauInId }),
  batDauSauIn: (id: number) => client.post(`/cd2/phieu-in/${id}/bat-dau-sau-in`),
  traVeSauIn: (id: number) => client.post(`/cd2/phieu-in/${id}/tra-ve-sau-in`),
  createFromLenhSx: (orderId: number, target: 'in' | 'sau_in' | 'auto') =>
    client.post(`/cd2/phieu-in/tu-lenh-sx/${orderId}`, null, { params: { target } }),

  // Kho phôi
  getTonKhoLsx: () => client.get<KhoRow[]>('/cd2/ton-kho-lsx'),

  // Máy in
  listMayIn: (params?: any) => client.get<MayIn[]>('/cd2/may-in', { params }),
  createMayIn: (data: Partial<MayIn>) => client.post<MayIn>('/cd2/may-in', data),
  updateMayIn: (id: number, data: Partial<MayIn>) => client.put<MayIn>(`/cd2/may-in/${id}`, data),
  deleteMayIn: (id: number) => client.delete(`/cd2/may-in/${id}`),

  // Máy sau in
  listMaySauIn: (params?: any) => client.get<MaySauIn[]>('/cd2/may-sau-in', { params }),
  createMaySauIn: (data: Partial<MaySauIn>) => client.post<MaySauIn>('/cd2/may-sau-in', data),
  updateMaySauIn: (id: number, data: Partial<MaySauIn>) => client.put<MaySauIn>(`/cd2/may-sau-in/${id}`, data),
  deleteMaySauIn: (id: number) => client.delete(`/cd2/may-sau-in/${id}`),

  // Máy scan
  listMayScan: (params?: any) => client.get<MayScan[]>('/cd2/may-scan', { params }),
  createMayScan: (data: Partial<MayScan>) => client.post<MayScan>('/cd2/may-scan', data),
  updateMayScan: (id: number, data: Partial<MayScan>) => client.put<MayScan>(`/cd2/may-scan/${id}`, data),
  deleteMayScan: (id: number) => client.delete(`/cd2/may-scan/${id}`),

  // Scan log
  getScanHistory: (params?: any) => client.get<ScanLog[]>('/cd2/scan-logs/history-list', { params }),
  createScanLog: (data: {
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
  }) => client.post<ScanLog>('/cd2/scan-logs/submit', data),
  deleteScanLog: (id: number) => client.delete(`/cd2/scan-logs/delete/${id}`),
  // Tra cứu theo Số lệnh (Production Order) - Dành cho trang Scan Máy
  scanLookup: (code: string) => client.get<ScanLookupResult>(`/cd2/scan/lookup/${code}`),
  // Tra cứu theo Số phiếu (Phieu In) - Dành cho Mobile Tracking QR
  phieuLookup: (code: string) => client.get<any>(`/cd2/scan-lookup/${code}`),

  // Ca làm việc
  listShiftCa: (params?: any) => client.get<ShiftCa[]>('/cd2/shift/ca', { params }),
  createShiftCa: (data: { name: string; leader?: string }) => client.post<ShiftCa>('/cd2/shift/ca', data),
  updateShiftCa: (id: number, data: Partial<ShiftCa>) => client.put<ShiftCa>(`/cd2/shift/ca/${id}`, data),
  deleteShiftCa: (id: number) => client.delete(`/cd2/shift/ca/${id}`),

  // Lịch ca
  listShiftConfig: (params?: any) => client.get<ShiftConfigItem[]>('/cd2/shift/config', { params }),
  createShiftConfig: (data: {
    may_in_id: number
    shift_ca_id: number
    ngay: string
    gio_lam?: number
    gio_bat_dau?: string
    gio_ket_thuc?: string
    nghi_1?: number
    nghi_2?: number
  }) => client.post<ShiftConfigItem>('/cd2/shift/config', data),
  deleteShiftConfig: (id: number) => client.delete(`/cd2/shift/config/${id}`),

  // Machine login (no JWT required)
  machineLogin: (data: { token_user?: string; token_password?: string; rfid_key?: string }) =>
    client.post<WorkerSession>('/cd2/machine-login', data),

  // Người in
  listPrinterUser: (params?: any) => client.get<PrinterUser[]>('/cd2/config/printer-user', { params }),
  createPrinterUser: (data: Partial<PrinterUser> & { token_user: string; token_password: string }) =>
    client.post<PrinterUser>('/cd2/config/printer-user', data),
  updatePrinterUser: (id: number, data: Partial<PrinterUser>) =>
    client.put<PrinterUser>(`/cd2/config/printer-user/${id}`, data),
  deletePrinterUser: (id: number) => client.delete(`/cd2/config/printer-user/${id}`),

  // Máy sản xuất (Machine — loai_may)
  listMachines: (params?: any) => client.get<Machine[]>('/cd2/machines', { params }),
  createMachine: (data: Partial<Machine>) => client.post<Machine>('/cd2/machines', data),
  updateMachine: (id: number, data: Partial<Machine>) => client.put<Machine>(`/cd2/machines/${id}`, data),
  getMachineLogs: (machineId: number) => client.get<any[]>(`/cd2/machines/${machineId}/logs`),
  trackProduction: (data: TrackPayload) => client.post<{ ok: boolean; log_id: number }>('/cd2/track', data),
  getOrderProgress: (orderId: number) => client.get<ProductionLog[]>(`/cd2/progress/${orderId}`),
}
