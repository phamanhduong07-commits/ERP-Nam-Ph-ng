import client from './client'

export interface PhanXuong {
  id: number
  ma_xuong: string
  ten_xuong: string
  dia_chi: string | null
  cong_doan: string  // "cd1_cd2" | "cd2"
  phoi_tu_phan_xuong_id: number | null
  ten_phoi_tu_phan_xuong: string | null
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
  product_id: number | null
  loai_giao_dich: string
  so_luong: number
  don_gia: number
  gia_tri: number
  ton_sau_giao_dich: number
  chung_tu_loai: string | null
  chung_tu_id: number | null
  ghi_chu: string | null
}

// ── GoodsReceipt (Phiếu nhập kho từ mua hàng) ──────────────────────────────
export interface GoodsReceiptItem {
  id: number
  po_item_id: number | null
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  don_gia: number
  thanh_tien: number
  dinh_luong_thuc_te: number | null
  do_am: number | null
  ket_qua_kiem_tra: string
  ghi_chu: string | null
}

export interface GoodsReceipt {
  id: number
  so_phieu: string
  ngay_nhap: string
  po_id: number | null
  supplier_id: number
  ten_ncc: string
  warehouse_id: number
  ten_kho: string
  loai_nhap: string
  tong_gia_tri: number
  trang_thai: string
  ghi_chu: string | null
  created_at: string | null
  items: GoodsReceiptItem[]
}

export interface CreateGoodsReceiptPayload {
  ngay_nhap: string
  po_id?: number | null
  supplier_id: number
  warehouse_id: number
  loai_nhap?: string
  ghi_chu?: string | null
  items: Omit<GoodsReceiptItem, 'id' | 'thanh_tien'>[]
}

// ── MaterialIssue (Phiếu xuất NVL) ──────────────────────────────────────────
export interface MaterialIssueItem {
  id: number
  paper_material_id: number | null
  other_material_id: number | null
  ten_hang: string
  so_luong_ke_hoach: number
  so_luong_thuc_xuat: number
  dvt: string
  don_gia: number
  ghi_chu: string | null
}

export interface MaterialIssue {
  id: number
  so_phieu: string
  ngay_xuat: string
  production_order_id: number
  so_lenh: string
  warehouse_id: number
  ten_kho: string
  trang_thai: string
  ghi_chu: string | null
  created_at: string | null
  items: MaterialIssueItem[]
}

export interface CreateMaterialIssuePayload {
  ngay_xuat: string
  production_order_id: number
  warehouse_id?: number | null
  ghi_chu?: string | null
  items: Omit<MaterialIssueItem, 'id'>[]
}

// ── ProductionOutput (Nhập TP từ sản xuất) ──────────────────────────────────
export interface ProductionOutput {
  id: number
  so_phieu: string
  ngay_nhap: string
  production_order_id: number
  so_lenh: string
  warehouse_id: number
  ten_kho: string
  product_id: number | null
  ten_hang: string | null
  so_luong_nhap: number
  so_luong_loi: number
  dvt: string
  don_gia_xuat_xuong: number
  ghi_chu: string | null
  created_at: string | null
}

export interface CreateProductionOutputPayload {
  ngay_nhap: string
  production_order_id: number
  warehouse_id?: number | null
  product_id?: number | null
  ten_hang?: string
  so_luong_nhap: number
  so_luong_loi?: number
  dvt?: string
  don_gia_xuat_xuong?: number
  ghi_chu?: string | null
}

// ── DeliveryOrder (Phiếu xuất giao hàng) ─────────────────────────────────────
export interface DeliveryOrderItem {
  id: number
  sales_order_item_id: number | null
  product_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  ghi_chu: string | null
}

export interface DeliveryOrder {
  id: number
  so_phieu: string
  ngay_xuat: string
  sales_order_id: number
  so_don: string
  customer_id: number
  ten_khach: string
  warehouse_id: number
  ten_kho: string
  dia_chi_giao: string | null
  nguoi_nhan: string | null
  xe_van_chuyen: string | null
  trang_thai: string
  ghi_chu: string | null
  created_at: string | null
  items: DeliveryOrderItem[]
}

export interface CreateDeliveryPayload {
  ngay_xuat: string
  sales_order_id: number
  warehouse_id?: number | null
  dia_chi_giao?: string | null
  nguoi_nhan?: string | null
  xe_van_chuyen?: string | null
  ghi_chu?: string | null
  items: Omit<DeliveryOrderItem, 'id'>[]
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

// ── Kho theo xưởng ────────────────────────────────────────────────────────────
export interface WarehouseSlot {
  id: number
  ma_kho: string
  ten_kho: string
  loai_kho: string
  trang_thai: boolean
  dien_tich: number | null
  suc_chua: number | null
  don_vi_suc_chua: string | null
  tong_so_mat_hang: number
  tong_gia_tri: number
  tong_so_luong: number
  phan_tram_lap_day: number | null
}

export interface WarehouseSlotNA {
  not_applicable: true
}

export interface PhanXuongWithWarehouses {
  id: number
  ma_xuong: string
  ten_xuong: string
  cong_doan: string
  trang_thai: boolean
  warehouses: {
    GIAY_CUON: WarehouseSlot | WarehouseSlotNA | null
    NVL_PHU: WarehouseSlot | null
    PHOI: WarehouseSlot | null
    THANH_PHAM: WarehouseSlot | null
  }
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

export interface CreatePhanXuongPayload {
  ma_xuong: string
  ten_xuong: string
  dia_chi?: string | null
  cong_doan: string
  phoi_tu_phan_xuong_id?: number | null
  trang_thai: boolean
}

export const warehouseApi = {
  // Phân xưởng
  listPhanXuong: () => client.get<PhanXuong[]>('/warehouse/phan-xuong'),
  createPhanXuong: (data: CreatePhanXuongPayload) => client.post<PhanXuong>('/warehouse/phan-xuong', data),
  updatePhanXuong: (id: number, data: CreatePhanXuongPayload) => client.put<PhanXuong>(`/warehouse/phan-xuong/${id}`, data),
  deletePhanXuong: (id: number) => client.delete(`/warehouse/phan-xuong/${id}`),

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
  getGiaoDich: (params?: { warehouse_id?: number; paper_material_id?: number; other_material_id?: number; product_id?: number; loai_giao_dich?: string; tu_ngay?: string; den_ngay?: string; limit?: number }) =>
    client.get<GiaoDich[]>('/warehouse/giao-dich', { params }),

  // Phiếu nhập kho (GoodsReceipt — linked to PO)
  listGoodsReceipts: (params?: { warehouse_id?: number; supplier_id?: number; po_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<GoodsReceipt[]>('/warehouse/goods-receipts', { params }),
  getGoodsReceipt: (id: number) => client.get<GoodsReceipt>(`/warehouse/goods-receipts/${id}`),
  createGoodsReceipt: (data: CreateGoodsReceiptPayload) => client.post<GoodsReceipt>('/warehouse/goods-receipts', data),
  deleteGoodsReceipt: (id: number) => client.delete(`/warehouse/goods-receipts/${id}`),

  // Phiếu xuất NVL (MaterialIssue — linked to LSX)
  listMaterialIssues: (params?: { warehouse_id?: number; production_order_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<MaterialIssue[]>('/warehouse/material-issues', { params }),
  getMaterialIssue: (id: number) => client.get<MaterialIssue>(`/warehouse/material-issues/${id}`),
  createMaterialIssue: (data: CreateMaterialIssuePayload) => client.post<MaterialIssue>('/warehouse/material-issues', data),
  deleteMaterialIssue: (id: number) => client.delete(`/warehouse/material-issues/${id}`),

  // Nhập thành phẩm từ sản xuất (ProductionOutput)
  listProductionOutputs: (params?: { warehouse_id?: number; production_order_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<ProductionOutput[]>('/warehouse/production-outputs', { params }),
  getProductionOutput: (id: number) => client.get<ProductionOutput>(`/warehouse/production-outputs/${id}`),
  createProductionOutput: (data: CreateProductionOutputPayload) => client.post<ProductionOutput>('/warehouse/production-outputs', data),
  deleteProductionOutput: (id: number) => client.delete(`/warehouse/production-outputs/${id}`),

  // Phiếu xuất giao hàng (DeliveryOrder — linked to SalesOrder)
  listDeliveries: (params?: { warehouse_id?: number; sales_order_id?: number; customer_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<DeliveryOrder[]>('/warehouse/deliveries', { params }),
  getDelivery: (id: number) => client.get<DeliveryOrder>(`/warehouse/deliveries/${id}`),
  createDelivery: (data: CreateDeliveryPayload) => client.post<DeliveryOrder>('/warehouse/deliveries', data),
  deleteDelivery: (id: number) => client.delete(`/warehouse/deliveries/${id}`),

  // Kho theo xưởng
  listTheoPhanXuong: () => client.get<PhanXuongWithWarehouses[]>('/warehouse/theo-phan-xuong'),
  initWarehousesForPhanXuong: (pxId: number) =>
    client.post<{ id: number; ma_kho: string; ten_kho: string; created: boolean }[]>(
      `/warehouse/phan-xuong/${pxId}/init-warehouses`
    ),
}
