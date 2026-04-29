import client from './client'

export interface PhanXuong {
  id: number
  ma_xuong: string
  ten_xuong: string
  dia_chi: string | null
  cong_doan: string  // "cd1_cd2" | "cd2"
  trang_thai: boolean
}

export interface WarehouseInfo {
  id: number
  ma_kho: string
  ten_kho: string
  loai_kho: string
  phan_xuong_id: number | null
  trang_thai: boolean
}

export interface TonKho {
  id: number
  warehouse_id: number
  ten_kho: string
  phan_xuong_id: number | null
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string
  don_vi: string
  ton_luong: number
  don_gia_binh_quan: number
  gia_tri_ton: number
  ton_toi_thieu: number
  cap_nhat_luc: string | null
}

export interface PhieuKhoItem {
  id?: number
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string
  don_vi: string
  so_luong: number
  don_gia: number
  thanh_tien?: number
  ghi_chu?: string | null
}

export interface PhieuNhapKho {
  id: number
  so_phieu: string
  warehouse_id: number
  ten_kho: string
  ngay: string
  loai_nhap: string
  nha_cung_cap_id: number | null
  ten_ncc: string | null
  tong_tien: number
  ghi_chu: string | null
  trang_thai: string
  created_at: string | null
  items: PhieuKhoItem[]
}

export interface PhieuXuatKho {
  id: number
  so_phieu: string
  warehouse_id: number
  ten_kho: string
  ngay: string
  loai_xuat: string
  tong_tien: number
  ghi_chu: string | null
  trang_thai: string
  created_at: string | null
  items: PhieuKhoItem[]
}

export interface PhieuChuyenKho {
  id: number
  so_phieu: string
  warehouse_xuat_id: number
  ten_kho_xuat: string
  warehouse_nhap_id: number
  ten_kho_nhap: string
  ngay: string
  ghi_chu: string | null
  trang_thai: string
  created_at: string | null
  items: PhieuKhoItem[]
}

export interface GiaoDich {
  id: number
  ngay_giao_dich: string | null
  warehouse_id: number
  paper_material_id: number | null
  other_material_id: number | null
  loai_giao_dich: string
  so_luong: number
  don_gia: number
  gia_tri: number
  ton_sau_giao_dich: number
  chung_tu_loai: string | null
  chung_tu_id: number | null
  ghi_chu: string | null
}

export interface CreatePhieuNhapPayload {
  warehouse_id: number
  ngay: string
  loai_nhap: string
  nha_cung_cap_id?: number | null
  ghi_chu?: string
  items: Omit<PhieuKhoItem, 'id' | 'thanh_tien'>[]
}

export interface CreatePhieuXuatPayload {
  warehouse_id: number
  ngay: string
  loai_xuat: string
  ghi_chu?: string
  items: Omit<PhieuKhoItem, 'id' | 'thanh_tien'>[]
}

export interface CreatePhieuChuyenPayload {
  warehouse_xuat_id: number
  warehouse_nhap_id: number
  ngay: string
  ghi_chu?: string
  items: Omit<PhieuKhoItem, 'id' | 'thanh_tien'>[]
}

export const LOAI_NHAP_LABELS: Record<string, string> = {
  mua_hang: 'Mua hàng',
  tra_hang: 'Trả hàng',
  noi_bo: 'Nội bộ',
  khac: 'Khác',
}

export const LOAI_XUAT_LABELS: Record<string, string> = {
  san_xuat: 'Sản xuất',
  ban_hang: 'Bán hàng',
  noi_bo: 'Nội bộ',
  khac: 'Khác',
}

export const warehouseApi = {
  // Phân xưởng
  listPhanXuong: () => client.get<PhanXuong[]>('/warehouse/phan-xuong'),

  // Tồn kho
  getTonKho: (params?: { warehouse_id?: number; phan_xuong_id?: number; loai?: string; search?: string }) =>
    client.get<TonKho[]>('/warehouse/ton-kho', { params }),

  // Phiếu nhập kho
  listPhieuNhap: (params?: { warehouse_id?: number; phan_xuong_id?: number; loai_nhap?: string; tu_ngay?: string; den_ngay?: string }) =>
    client.get<PhieuNhapKho[]>('/warehouse/phieu-nhap', { params }),
  getPhieuNhap: (id: number) => client.get<PhieuNhapKho>(`/warehouse/phieu-nhap/${id}`),
  createPhieuNhap: (data: CreatePhieuNhapPayload) => client.post<PhieuNhapKho>('/warehouse/phieu-nhap', data),
  deletePhieuNhap: (id: number) => client.delete(`/warehouse/phieu-nhap/${id}`),

  // Phiếu xuất kho
  listPhieuXuat: (params?: { warehouse_id?: number; phan_xuong_id?: number; loai_xuat?: string; tu_ngay?: string; den_ngay?: string }) =>
    client.get<PhieuXuatKho[]>('/warehouse/phieu-xuat', { params }),
  getPhieuXuat: (id: number) => client.get<PhieuXuatKho>(`/warehouse/phieu-xuat/${id}`),
  createPhieuXuat: (data: CreatePhieuXuatPayload) => client.post<PhieuXuatKho>('/warehouse/phieu-xuat', data),
  deletePhieuXuat: (id: number) => client.delete(`/warehouse/phieu-xuat/${id}`),

  // Phiếu chuyển kho
  listPhieuChuyen: (params?: { warehouse_xuat_id?: number; warehouse_nhap_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<PhieuChuyenKho[]>('/warehouse/phieu-chuyen', { params }),
  getPhieuChuyen: (id: number) => client.get<PhieuChuyenKho>(`/warehouse/phieu-chuyen/${id}`),
  createPhieuChuyen: (data: CreatePhieuChuyenPayload) => client.post<PhieuChuyenKho>('/warehouse/phieu-chuyen', data),
  deletePhieuChuyen: (id: number) => client.delete(`/warehouse/phieu-chuyen/${id}`),

  // Lịch sử giao dịch
  getGiaoDich: (params?: { warehouse_id?: number; paper_material_id?: number; other_material_id?: number; loai_giao_dich?: string; tu_ngay?: string; den_ngay?: string; limit?: number }) =>
    client.get<GiaoDich[]>('/warehouse/giao-dich', { params }),
}
