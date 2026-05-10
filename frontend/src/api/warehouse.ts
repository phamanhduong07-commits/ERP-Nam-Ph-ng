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
  product_id: number | null
  ten_hang: string
  don_vi: string
  tinh_trang_hang?: string
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
  production_order_id?: number | null
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

export interface StockAdjustmentItem {
  id: number
  inventory_balance_id: number
  paper_material_id: number | null
  other_material_id: number | null
  product_id: number | null
  ten_hang: string
  don_vi: string
  so_luong_so_sach: number
  so_luong_thuc_te: number
  chenhlech: number
  don_gia: number
  ghi_chu: string | null
}

export interface StockAdjustment {
  id: number
  so_phieu: string
  warehouse_id: number
  ten_kho: string
  ngay: string
  ly_do: string | null
  ghi_chu: string | null
  trang_thai: string
  created_at: string | null
  items: StockAdjustmentItem[]
}

export interface GiaoDich {
  id: number
  ngay_giao_dich: string | null
  warehouse_id: number
  ten_kho: string
  paper_material_id: number | null
  other_material_id: number | null
  product_id: number | null
  ma_hang: string
  ten_hang: string
  loai_giao_dich: string
  tinh_trang_hang?: string | null
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
  kho_mm: number | null
  so_cuon: number | null
  ky_hieu_cuon: string | null
  dai_mm: number | null      // chiều dài phôi tấm (mm)
  so_lop: number | null      // số lớp: 3 | 5 | 7
  ghi_chu: string | null
}

export interface GoodsReceipt {
  id: number
  so_phieu: string
  ngay_nhap: string
  po_id: number | null
  supplier_id: number
  ten_ncc: string
  warehouse_id: number | null
  ten_kho: string
  loai_nhap: string
  tong_gia_tri: number
  trang_thai: 'nhap_nhanh' | 'nhap' | 'da_duyet'
  ghi_chu: string | null
  so_xe: string | null
  phap_nhan_id: number | null
  invoice_image: string | null   // null trong list, có giá trị trong detail
  has_invoice_image: boolean
  hd_tong_kg: number | null
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
  so_xe?: string | null
  invoice_image?: string | null
  hd_tong_kg?: number | null
  items: Omit<GoodsReceiptItem, 'id' | 'thanh_tien'>[]
}

export interface QuickCapturePayload {
  ngay_nhap: string
  supplier_id: number
  phan_xuong_id: number
  loai_kho_auto?: string   // 'GIAY_CUON' | 'NVL_PHU'
  so_xe?: string | null
  invoice_image: string
  hd_tong_kg?: number | null
}

export interface CompleteGoodsReceiptPayload {
  warehouse_id?: number | null
  ghi_chu?: string | null
  hd_tong_kg?: number | null
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
  production_order_id?: number | null
  so_lenh?: string | null
  sales_order_item_id: number | null
  product_id: number | null
  ten_hang: string
  so_luong: number
  dvt: string
  dien_tich?: number
  trong_luong?: number
  the_tich?: number
  don_gia?: number
  thanh_tien?: number
  ghi_chu: string | null
}

export interface DeliveryOrder {
  id: number
  so_phieu: string
  ngay_xuat: string
  sales_order_id: number | null
  so_don: string | null
  customer_id: number
  ten_khach: string | null
  warehouse_id: number
  ten_kho: string | null
  yeu_cau_id: number | null
  dia_chi_giao: string | null
  nguoi_nhan: string | null
  xe_van_chuyen: string | null
  xe_id: number | null
  bien_so: string | null
  loai_xe: string | null
  trong_tai: number | null
  tai_xe_id: number | null
  ten_tai_xe: string | null
  lo_xe: string | null
  don_gia_vc_id: number | null
  ten_tuyen: string | null
  tien_van_chuyen: number
  tong_tien_hang: number
  tong_thanh_toan: number
  tong_dien_tich: number
  tong_trong_luong: number
  tong_the_tich: number
  trang_thai_cong_no: string
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

export interface CreateStockAdjustmentPayload {
  warehouse_id: number
  ngay: string
  ly_do?: string | null
  ghi_chu?: string | null
  items: {
    inventory_balance_id: number
    so_luong_thuc_te: number
    ghi_chu?: string | null
  }[]
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

export interface TonKhoTPRow {
  production_order_id: number
  so_lenh: string
  ngay_lenh: string | null
  sales_order_id: number | null
  so_don: string | null
  customer_id: number | null
  ten_hang: string | null
  product_id: number | null
  sales_order_item_id: number | null
  don_gia: number
  dia_chi_giao: string | null
  ten_khach_hang: string | null
  nv_theo_doi_id: number | null
  ten_nv_theo_doi: string | null
  sl_ke_hoach: number
  tong_nhap: number
  tong_xuat: number
  tong_tra?: number
  tong_tra_da_duyet?: number
  tinh_trang_hang?: string
  ton_kho: number
  dien_tich: number
  trong_luong: number
  the_tich: number
  dvt: string
  warehouse_id: number | null
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  order_ten_phan_xuong: string | null
  phap_nhan_id: number | null
  ten_phap_nhan_sx: string | null
  ten_kho_hien_tai: string | null
  phieu_xuat_gan_nhat: { so_phieu: string; ngay_xuat: string } | null
}

export interface TonKhoPhoiLsxRow {
  production_order_id: number
  so_lenh: string
  ten_hang: string
  ten_khach_hang: string | null
  tong_nhap: number
  tong_xuat: number
  ton_kho: number
  warehouse_id: number
  ten_kho: string
  chieu_kho: number | null
  chieu_cat: number | null
  phieu_in_hien_tai: { so_phieu: string; trang_thai: string } | null
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  cong_doan: string | null
  order_ten_phan_xuong: string | null
  phap_nhan_sx_id: number | null
  ten_phap_nhan_sx: string | null
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

export interface TonKhoGiayRow {
  paper_material_id: number
  ma_chinh: string | null
  ten: string | null
  kho: number | null
  dinh_luong: number | null
  ton_toi_thieu: number
  warehouse_id: number
  ten_kho: string
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  ton_luong: number
  gia_tri_ton: number
  don_gia_binh_quan: number
}

export interface DuTruGiayPeriod {
  label: string
  date_from: string
  date_to: string
  can_kg: number
  ton_sau_ky: number
  am: boolean
  cung_ky_nam_truoc_kg: number
  tang_giam_pct: number | null
}

export interface DuTruGiayRow {
  paper_material_id: number
  ma_chinh: string | null
  ten: string | null
  kho: number | null
  dinh_luong: number | null
  ton_toi_thieu: number
  ton_hien_tai: number
  don_gia_binh_quan: number
  periods: DuTruGiayPeriod[]
  tong_can_kg: number
  can_mua_ngay: number
  gia_tri_can_mua: number
}

// ── KHSX cần mua phôi sóng ngoài ─────────────────────────────────────────────
export interface KHSXCanPhoiNgoaiRow {
  ppl_id: number | null
  so_ke_hoach: string | null
  nguon?: 'khsx' | 'lenh_sx'
  ngay_ke_hoach: string | null
  ngay_chay: string | null
  so_lsx: string
  poi_id: number
  ten_san_pham: string
  so_luong_thung: number
  // KHSX paper sizing
  kho1: number | null
  kho_giay: number | null
  so_dao: number | null
  kho_tt: number | null
  dai_tt: number | null
  // Cấu trúc giấy
  so_lop: number | null
  to_hop_song: string | null
  mat: string | null;   mat_dl: number | null
  song_1: string | null; song_1_dl: number | null
  mat_1: string | null;  mat_1_dl: number | null
  song_2: string | null; song_2_dl: number | null
  mat_2: string | null;  mat_2_dl: number | null
  song_3: string | null; song_3_dl: number | null
  mat_3: string | null;  mat_3_dl: number | null
  // Kích thước thùng
  loai_thung: string | null
  dai: number | null; rong: number | null; cao: number | null
  // QCCL
  c_tham: string | null
  can_man: string | null
  loai_lan: string | null
  qccl: string | null
  // Đã đặt mua
  da_dat_so_tam: number
}

// ── Tồn kho NVL (other_materials) ────────────────────────────────────────────
export interface TonKhoNVLRow {
  id: number
  warehouse_id: number
  ten_kho: string
  phan_xuong_id: number | null
  other_material_id: number | null
  ten_hang: string
  don_vi: string
  ton_luong: number
  don_gia_binh_quan: number
  gia_tri_ton: number
  ton_toi_thieu: number
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

  // Kiem ke / dieu chinh ton kho
  listStockAdjustments: (params?: { warehouse_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<StockAdjustment[]>('/warehouse/stock-adjustments', { params }),
  getStockAdjustment: (id: number) => client.get<StockAdjustment>(`/warehouse/stock-adjustments/${id}`),
  createStockAdjustment: (data: CreateStockAdjustmentPayload) => client.post<StockAdjustment>('/warehouse/stock-adjustments', data),
  deleteStockAdjustment: (id: number) => client.delete(`/warehouse/stock-adjustments/${id}`),

  // Lịch sử giao dịch
  getGiaoDich: (params?: { warehouse_id?: number; paper_material_id?: number; other_material_id?: number; product_id?: number; loai_giao_dich?: string; tu_ngay?: string; den_ngay?: string; limit?: number }) =>
    client.get<GiaoDich[]>('/warehouse/giao-dich', { params }),

  // Phiếu nhập kho (GoodsReceipt — linked to PO)
  listGoodsReceipts: (params?: { warehouse_id?: number; supplier_id?: number; po_id?: number; tu_ngay?: string; den_ngay?: string; loai_hang?: string }) =>
    client.get<GoodsReceipt[]>('/warehouse/goods-receipts', { params }),
  getGoodsReceipt: (id: number) => client.get<GoodsReceipt>(`/warehouse/goods-receipts/${id}`),
  createGoodsReceipt: (data: CreateGoodsReceiptPayload) => client.post<GoodsReceipt>('/warehouse/goods-receipts', data),
  quickCaptureGoodsReceipt: (data: QuickCapturePayload) => client.post<GoodsReceipt>('/warehouse/goods-receipts/quick', data),
  completeGoodsReceipt: (id: number, data: CompleteGoodsReceiptPayload) => client.post<GoodsReceipt>(`/warehouse/goods-receipts/${id}/complete`, data),
  deleteGoodsReceipt: (id: number) => client.delete(`/warehouse/goods-receipts/${id}`),
  approveGoodsReceipt: (id: number) => client.patch(`/warehouse/goods-receipts/${id}/approve`),
  syncGiaBan: (id: number) => client.post<{ ok: boolean; updated: { ma_chinh: string; ten: string; gia_mua: number; gia_ban: number }[] }>(`/warehouse/goods-receipts/${id}/sync-gia-ban`),

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
  getTonKhoTpLsx: (params?: { ten_khach?: string; so_lenh?: string; nv_theo_doi_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<TonKhoTPRow[]>('/warehouse/ton-kho-tp-lsx', { params }),
  initWarehousesForPhanXuong: (pxId: number) =>
    client.post<{ id: number; ma_kho: string; ten_kho: string; created: boolean }[]>(
      `/warehouse/phan-xuong/${pxId}/init-warehouses`
    ),

  getTonKhoPhoiLsx: (params?: { search?: string }) =>
    client.get<TonKhoPhoiLsxRow[]>('/phieu-phoi/ton-kho-lsx', { params }),

  importInventory: (warehouseId: number, file: File, commit: boolean) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(`/warehouse/inventory/import?warehouse_id=${warehouseId}&commit=${commit}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  getTonKhoGiay: (params?: { phan_xuong_id?: number }) =>
    client.get<TonKhoGiayRow[]>('/warehouse/ton-kho-giay', { params }),

  getDuTruGiay: (params?: { weeks?: number }) =>
    client.get<DuTruGiayRow[]>('/warehouse/du-tru-giay', { params }),

  // KHSX line cần mua phôi sóng ngoài
  getKHSXCanPhoiNgoai: (params?: { trang_thai?: string }) =>
    client.get<KHSXCanPhoiNgoaiRow[]>('/warehouse/khsx-can-phoi-ngoai', { params }),

  // Tồn kho NVL khác (reuse ton-kho?loai=khac)
  getTonKhoNVL: (params?: { phan_xuong_id?: number; search?: string }) =>
    client.get<TonKhoNVLRow[]>('/warehouse/ton-kho', {
      params: { loai: 'khac', ...params }
    }),
}
