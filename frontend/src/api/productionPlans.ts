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
  dai_tt: number | null
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

export const productionPlansApi = {
  list: (params?: {
    search?: string
    trang_thai?: string
    tu_ngay?: string
    den_ngay?: string
    page?: number
    page_size?: number
  }) => client.get<PlanPagedResponse>('/production-plans', { params }),

  get: (id: number) =>
    client.get<PlanResponse>(`/production-plans/${id}`),

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
