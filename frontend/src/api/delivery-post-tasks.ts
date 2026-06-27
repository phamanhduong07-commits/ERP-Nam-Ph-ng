import client from './client'

export interface DeliveryPostTask {
  id: number
  delivery_id: number
  item_id: number
  trang_thai: 'cho_duyet' | 'cho_kho_nhan' | 'hoan_thanh' | 'tu_choi'
  tinh_trang: string
  huong_xu_ly: string
  so_luong_cu: number
  so_luong_moi: number
  so_luong_bu_hao: number
  ghi_chu_sa?: string | null
  ghi_chu_tp?: string | null
  ghi_chu_kho?: string | null
  created_by: { id: number; full_name: string } | null
  approved_by?: { id: number; full_name: string } | null
  kho_confirmed_by?: { id: number; full_name: string } | null
  created_at: string
  approved_at?: string | null
  kho_confirmed_at?: string | null
  // Joined display fields
  so_phieu?: string | null
  ten_khach?: string | null
  ten_hang?: string | null
  dvt?: string | null
}

export interface ListTasksResponse {
  total: number
  items: DeliveryPostTask[]
}

export interface CreateTaskPayload {
  delivery_id: number
  item_id: number
  tinh_trang: string
  huong_xu_ly: string
  so_luong_moi: number
  so_luong_bu_hao?: number
  ghi_chu_sa?: string
}

export interface ApprovePayload {
  ghi_chu_tp?: string
}

export interface KhoNhanPayload {
  kho_id: number
  ghi_chu_kho?: string
}

export const TINH_TRANG_LABELS: Record<string, string> = {
  giao_thieu: 'Giao thiếu',
  giao_du: 'Giao dư',
  bu_hao: 'Bù hao',
  loi_phat_hien: 'Lỗi phát hiện',
}

export const HUONG_XU_LY_LABELS: Record<string, string> = {
  giao_bu_sau: 'Giao bù đợt sau',
  giam_don_hang: 'Giảm số lượng đơn',
  thu_hoi_ve: 'Thu hồi hàng về',
  tinh_tien_them: 'Tính thêm tiền',
  khach_giu_mien_phi: 'Khách giữ miễn phí',
  xuat_bu_hao: 'Xuất kho bù hao',
  doi_hang: 'Đổi hàng mới',
  nhap_kho_hong: 'Nhập kho hàng hỏng',
  hoan_tien: 'Hoàn tiền',
}

export const TRANG_THAI_LABELS: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  cho_kho_nhan: 'Chờ kho xác nhận',
  hoan_thanh: 'Hoàn thành',
  tu_choi: 'Từ chối',
}

export const createTask = (payload: CreateTaskPayload): Promise<DeliveryPostTask> =>
  client.post('/api/delivery-post-tasks', payload).then(r => r.data)

export const listTasks = (params?: {
  trang_thai?: string
  delivery_id?: number
  page?: number
  page_size?: number
}): Promise<ListTasksResponse> =>
  client.get('/api/delivery-post-tasks', { params }).then(r => r.data)

export const getTask = (id: number): Promise<DeliveryPostTask> =>
  client.get(`/api/delivery-post-tasks/${id}`).then(r => r.data)

export const approveTask = (id: number, payload: ApprovePayload): Promise<DeliveryPostTask> =>
  client.put(`/api/delivery-post-tasks/${id}/duyet`, payload).then(r => r.data)

export const rejectTask = (id: number, payload: ApprovePayload): Promise<unknown> =>
  client.put(`/api/delivery-post-tasks/${id}/tu-choi`, payload).then(r => r.data)

export const khoNhanTask = (id: number, payload: KhoNhanPayload): Promise<DeliveryPostTask> =>
  client.put(`/api/delivery-post-tasks/${id}/kho-nhan`, payload).then(r => r.data)
