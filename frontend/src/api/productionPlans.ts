import client from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanLineCreate {
  production_order_item_id: number
  thu_tu?: number
  ngay_chay?: string | null
  kho1?: number | null
  kho_giay?: number | null
  so_dao?: number | null
  so_luong_ke_hoach: number
  ghi_chu?: string | null
}

export interface PlanLineUpdate {
  thu_tu?: number
  ngay_chay?: string | null
  kho1?: number | null
  kho_giay?: number | null
  so_dao?: number | null
  so_luong_ke_hoach?: number
  so_luong_hoan_thanh?: number
  trang_thai?: string
  ghi_chu?: string | null
}

export interface PlanLineResponse {
  id: number
  plan_id: number
  production_order_item_id: number
  thu_tu: number
  ngay_chay: string | null
  kho1: number | null
  kho_giay: number | null
  so_dao: number | null
  kho_tt: number | null
  so_luong_ke_hoach: number
  so_luong_hoan_thanh: number
  trang_thai: string
  mua_phoi_ngoai: boolean
  ghi_chu: string | null
  // Joined fields
  so_lenh: string | null
  ma_kh: string | null
  ten_khach_hang: string | null
  ten_hang: string | null
  ngay_giao_hang: string | null
  loai_thung: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number | null
  to_hop_song: string | null
  // Thông số kỹ thuật
  dai_tt: number | null
  so_lan_cat: number | null
  be_so_con: number | null
  loai_lan: string | null
  loai_in: string | null
  so_mau: number | null
  c_tham: string | null
  can_man: string | null
  qccl: string | null
  cong_doan: string | null
  mat: string | null;     mat_dl: number | null
  song_1: string | null;  song_1_dl: number | null
  mat_1: string | null;   mat_1_dl: number | null
  song_2: string | null;  song_2_dl: number | null
  mat_2: string | null;   mat_2_dl: number | null
  song_3: string | null;  song_3_dl: number | null
  mat_3: string | null;   mat_3_dl: number | null
  mat_loai_giay: string | null
  mat_1_loai_giay: string | null
  mat_2_loai_giay: string | null
  mat_3_loai_giay: string | null
}

export interface PlanCreate {
  ngay_ke_hoach: string
  ghi_chu?: string | null
  lines?: PlanLineCreate[]
}

export interface PlanUpdate {
  ngay_ke_hoach?: string
  ghi_chu?: string | null
}

export interface PlanListItem {
  id: number
  so_ke_hoach: string
  ngay_ke_hoach: string
  trang_thai: string
  so_dong: number
  tong_sl: number
  created_at: string
  created_by_name: string | null
  noi_sx: string | null
}

export interface PlanResponse {
  id: number
  so_ke_hoach: string
  ngay_ke_hoach: string
  ghi_chu: string | null
  trang_thai: string
  lines: PlanLineResponse[]
  created_at: string
  updated_at: string
  created_by_name: string | null
  noi_sx: string | null
}

export interface PlanPagedResponse {
  items: PlanListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PushToQueuePayload {
  production_order_item_id: number
  kho1?: number | null
  kho_giay?: number | null
  so_dao?: number | null
  so_luong_ke_hoach: number
}

export interface QueueLine {
  id: number
  plan_id: number
  so_ke_hoach: string
  production_order_id: number | null
  production_order_item_id: number
  thu_tu: number
  ngay_chay: string | null
  kho1: number | null
  kho_giay: number | null
  so_dao: number | null
  kho_tt: number | null
  so_luong_ke_hoach: number
  so_luong_hoan_thanh: number
  trang_thai: string
  plan_trang_thai: string  // nhap | da_xuat | hoan_thanh
  mua_phoi_ngoai: boolean
  ghi_chu: string | null
  so_lenh: string | null
  ma_kh: string | null
  ten_khach_hang: string | null
  ten_hang: string | null
  ngay_giao_hang: string | null
  loai_thung: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number | null
  to_hop_song: string | null
  loai_lan: string | null
  loai_in: string | null
  so_mau: number | null
  c_tham: string | null
  can_man: string | null
  dai_tt: number | null
  so_lan_cat: number | null
  be_so_con: number | null
  mat: string | null;     mat_dl: number | null
  song_1: string | null;  song_1_dl: number | null
  mat_1: string | null;   mat_1_dl: number | null
  song_2: string | null;  song_2_dl: number | null
  mat_2: string | null;   mat_2_dl: number | null
  song_3: string | null;  song_3_dl: number | null
  mat_3: string | null;   mat_3_dl: number | null
}

export interface AvailableItem {
  production_order_item_id: number
  so_lenh: string
  ma_kh: string | null
  ten_khach_hang: string | null
  ten_hang: string
  so_luong_ke_hoach: number
  ngay_giao_hang: string | null
  loai_thung: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number | null
  to_hop_song: string | null
  kho1_tinh_toan: number | null
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface KhsxBaoCaoLsx {
  id: number
  so_lenh: string
  ngay_chay?: string | null
  trang_thai: string
  ten_hang?: string | null
  so_lop?: number | null
  kho_giay_cm?: number | null
  so_dao?: number | null
  so_tam: number
  so_luong_ke_hoach: number
  so_tam_loi: number
  completion_pct: number
  kg_tot: number
  kg_loi: number
}

export interface KhsxBaoCaoGiay {
  ma_chinh?: string | null
  ten?: string | null
  kho_cm?: number | null
  gsm?: number | null
  kg_xuat: number
}

export interface KhsxBaoCaoResponse {
  plan: { so_ke_hoach: string; trang_thai: string; ngay_ke_hoach: string }
  lsx_list: KhsxBaoCaoLsx[]
  giay_dung: KhsxBaoCaoGiay[]
  warnings: string[]
  completion_pct: number
  tong_so_tam: number
  tong_so_tam_ke_hoach: number
  tong_kg_giay_dung: number
  tong_kg_thanh_pham: number
  tong_kg_loi: number
  hao_hut_kg: number
  hao_hut_pct: number
  tong_so_tam_loi: number
}

export const productionPlansApi = {
  list: (params?: {
    search?: string
    trang_thai?: string
    exclude_nhap?: boolean
    noi_sx?: string
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<PlanPagedResponse>('/production-plans', { params }),

  get: (id: number) =>
    client.get<PlanResponse>(`/production-plans/${id}`),

  getSoLenh: (id: number) =>
    client.get<{ so_lenh: string[] }>(`/production-plans/${id}/so-lenh`),

  create: (data: PlanCreate) =>
    client.post<PlanResponse>('/production-plans', data),

  update: (id: number, data: PlanUpdate) =>
    client.put<PlanResponse>(`/production-plans/${id}`, data),

  delete: (id: number) =>
    client.delete(`/production-plans/${id}`),

  export: (id: number) =>
    client.patch<PlanResponse>(`/production-plans/${id}/export`),

  getAvailableItems: (params?: {
    tu_ngay?: string
    den_ngay?: string
    customer_id?: number
    search?: string
  }) => client.get<AvailableItem[]>('/production-plans/available-items', { params }),

  addLine: (planId: number, data: PlanLineCreate) =>
    client.post<PlanResponse>(`/production-plans/${planId}/lines`, data),

  updateLine: (planId: number, lineId: number, data: PlanLineUpdate) =>
    client.put<PlanResponse>(`/production-plans/${planId}/lines/${lineId}`, data),

  deleteLine: (planId: number, lineId: number) =>
    client.delete<PlanResponse>(`/production-plans/${planId}/lines/${lineId}`),

  completeLine: (planId: number, lineId: number) =>
    client.patch<PlanResponse>(`/production-plans/${planId}/lines/${lineId}/complete`),

  // Queue
  getQueue: (trang_thai?: string) =>
    client.get<QueueLine[]>('/production-plans/queue', trang_thai ? { params: { trang_thai } } : undefined),

  pushToQueue: (data: PushToQueuePayload) =>
    client.post<QueueLine>('/production-plans/push-to-queue', data),

  startQueueLine: (lineId: number) =>
    client.patch<QueueLine>(`/production-plans/queue/${lineId}/start`),

  // Toggle mua phôi ngoài cho line KHSX
  togglePhoiNgoai: (lineId: number, mua_phoi_ngoai: boolean) =>
    client.patch<{ id: number; mua_phoi_ngoai: boolean }>(
      `/production-plans/lines/${lineId}/phoi-ngoai`,
      { mua_phoi_ngoai }
    ),

  getBaoCao: (id: number) =>
    client.get<KhsxBaoCaoResponse>(`/production-plans/${id}/bao-cao`),

  reorderQueue: (items: { id: number; thu_tu: number }[]) =>
    client.patch<{ updated: number }>('/production-plans/queue/reorder', items),

  promoteFromPool: (lineId: number) =>
    client.patch<{ ok: boolean; plan_id: number; so_ke_hoach: string; created: boolean }>(
      `/production-plans/lines/${lineId}/promote-from-pool`
    ),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const PLAN_TRANG_THAI: Record<string, { label: string; color: string }> = {
  nhap:       { label: 'Nháp',          color: 'default' },
  da_xuat:    { label: 'Đã xuất KH',    color: 'blue' },
  hoan_thanh: { label: 'Hoàn thành',    color: 'green' },
}

export const LINE_TRANG_THAI: Record<string, { label: string; color: string }> = {
  cho:        { label: 'Chờ',          color: 'default' },
  dang_chay:  { label: 'Đang chạy',    color: 'processing' },
  hoan_thanh: { label: 'Hoàn thành',   color: 'success' },
}

export function calcSoDao(khoGiay: number | null, kho1: number | null): number | null {
  if (!khoGiay || !kho1 || kho1 <= 0) return null
  return Math.floor(khoGiay / kho1)
}

export function calcKhoTT(kho1: number | null, soDao: number | null): number | null {
  if (!kho1 || !soDao) return null
  return Math.round((kho1 * soDao + 1.8) * 100) / 100
}
