import client from './client'

// ── Đơn vị tính ────────────────────────────────────────────────
export interface DonViTinh {
  id: number; ten: string; ky_hieu: string | null; ghi_chu: string | null; trang_thai: boolean
}
export const donViTinhApi = {
  list: () => client.get<DonViTinh[]>('/don-vi-tinh'),
  create: (d: Omit<DonViTinh,'id'>) => client.post<DonViTinh>('/don-vi-tinh', d),
  update: (id: number, d: Partial<Omit<DonViTinh,'id'>>) => client.put<DonViTinh>(`/don-vi-tinh/${id}`, d),
  delete: (id: number) => client.delete(`/don-vi-tinh/${id}`),
}

// ── Vị trí ─────────────────────────────────────────────────────
export interface ViTri {
  id: number; ma_vi_tri: string; ten_vi_tri: string; loai: string | null; ghi_chu: string | null; trang_thai: boolean
}
export const viTriApi = {
  list: (params?: { loai?: string }) => client.get<ViTri[]>('/vi-tri', { params }),
  create: (d: Omit<ViTri,'id'>) => client.post<ViTri>('/vi-tri', d),
  update: (id: number, d: Partial<Omit<ViTri,'id'>>) => client.put<ViTri>(`/vi-tri/${id}`, d),
  delete: (id: number) => client.delete(`/vi-tri/${id}`),
}

// ── Xe ─────────────────────────────────────────────────────────
export interface Xe {
  id: number; bien_so: string; loai_xe: string | null; trong_tai: number | null; ghi_chu: string | null; trang_thai: boolean
}
export const xeApi = {
  list: () => client.get<Xe[]>('/xe'),
  create: (d: Omit<Xe,'id'>) => client.post<Xe>('/xe', d),
  update: (id: number, d: Partial<Omit<Xe,'id'>>) => client.put<Xe>(`/xe/${id}`, d),
  delete: (id: number) => client.delete(`/xe/${id}`),
}

// ── Tài xế ─────────────────────────────────────────────────────
export interface TaiXe {
  id: number; ho_ten: string; so_dien_thoai: string | null; so_bang_lai: string | null; ghi_chu: string | null; trang_thai: boolean
}
export const taiXeApi = {
  list: () => client.get<TaiXe[]>('/tai-xe'),
  create: (d: Omit<TaiXe,'id'>) => client.post<TaiXe>('/tai-xe', d),
  update: (id: number, d: Partial<Omit<TaiXe,'id'>>) => client.put<TaiXe>(`/tai-xe/${id}`, d),
  delete: (id: number) => client.delete(`/tai-xe/${id}`),
}

// ── Tỉnh thành ─────────────────────────────────────────────────
export interface TinhThanh {
  id: number; ma_tinh: string; ten_tinh: string; trang_thai: boolean
}
export const tinhThanhApi = {
  list: () => client.get<TinhThanh[]>('/tinh-thanh'),
  create: (d: Omit<TinhThanh,'id'>) => client.post<TinhThanh>('/tinh-thanh', d),
  update: (id: number, d: Partial<Omit<TinhThanh,'id'>>) => client.put<TinhThanh>(`/tinh-thanh/${id}`, d),
  delete: (id: number) => client.delete(`/tinh-thanh/${id}`),
}

// ── Phường xã ──────────────────────────────────────────────────
export interface PhuongXa {
  id: number; ma_phuong: string; ten_phuong: string; tinh_id: number | null; ten_tinh: string | null; trang_thai: boolean
}
export const phuongXaApi = {
  list: (params?: { tinh_id?: number }) => client.get<PhuongXa[]>('/phuong-xa', { params }),
  create: (d: Omit<PhuongXa,'id'|'ten_tinh'>) => client.post<PhuongXa>('/phuong-xa', d),
  update: (id: number, d: Partial<Omit<PhuongXa,'id'|'ten_tinh'>>) => client.put<PhuongXa>(`/phuong-xa/${id}`, d),
  delete: (id: number) => client.delete(`/phuong-xa/${id}`),
}

// ── Đơn giá vận chuyển ─────────────────────────────────────────
export interface DonGiaVanChuyen {
  id: number; ten_tuyen: string; khu_vuc_tu: string | null; khu_vuc_den: string | null; don_gia: number; dvt: string; ghi_chu: string | null; trang_thai: boolean
}
export const donGiaVanChuyenApi = {
  list: () => client.get<DonGiaVanChuyen[]>('/don-gia-van-chuyen'),
  create: (d: Omit<DonGiaVanChuyen,'id'>) => client.post<DonGiaVanChuyen>('/don-gia-van-chuyen', d),
  update: (id: number, d: Partial<Omit<DonGiaVanChuyen,'id'>>) => client.put<DonGiaVanChuyen>(`/don-gia-van-chuyen/${id}`, d),
  delete: (id: number) => client.delete(`/don-gia-van-chuyen/${id}`),
}
