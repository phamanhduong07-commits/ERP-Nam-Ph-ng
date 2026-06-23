import client from './client'

export interface PhanXuong {
  id: number
  ma_xuong: string
  ten_xuong: string
  dia_chi: string | null
  cong_doan: string  // "cd1_cd2" | "cd2"
  phoi_tu_phan_xuong_id: number | null
  ten_phoi_tu_phan_xuong: string | null
  phap_nhan_id?: number | null
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
  loai_kho?: string | null
  phan_xuong_id: number | null
  ten_phan_xuong?: string | null
  phap_nhan_id?: number | null
  ten_phap_nhan?: string | null
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
  // Giấy cuộn specific
  ma_chinh?: string | null
  ma_ky_hieu?: string | null
  loai_giay?: string | null
  kho_mm?: number | null
  dinh_luong?: number | null
  so_cuon?: number | null
  bien_dong?: number | null
  ten_nsx?: string | null
  ngay_nhap_gan_nhat?: string | null
}

export interface TonKhoSummary {
  total_gia_tri: number
  total_mat_hang: number
  low_stock_count: number
  by_loai: { loai_kho: string; gia_tri: number; so_mat_hang: number }[]
  by_warehouse: { warehouse_id: number; ten_kho: string; gia_tri: number; so_mat_hang: number }[]
  low_stock: { id: number; ten_hang: string; ten_kho: string; ton_luong: number; ton_toi_thieu: number; don_vi: string; pct: number }[]
}

export interface PhieuKhoItem {
  id?: number
  paper_material_id: number | null
  other_material_id: number | null
  production_order_id?: number | null
  product_id?: number | null
  ten_hang: string
  don_vi: string
  so_luong: number
  don_gia: number
  thanh_tien?: number
  ghi_chu?: string | null
  // LSX-enriched (phôi items)
  so_lsx?: string
  ma_sp?: string
  so_lop?: number | null
  to_hop_song?: string
  quy_cach?: string
  kho_cat?: string
  // Product-enriched (BTP items)
  ten_san_pham?: string
  ma_san_pham?: string
}

export interface PhieuNhapKho {
  id: number
  so_phieu: string
  warehouse_id: number
  ten_kho: string
  phap_nhan_id: number | null
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
  phan_xuong_xuat_id: number | null
  ten_phan_xuong_xuat: string
  phap_nhan_xuat_id: number | null
  ten_phap_nhan_xuat: string
  warehouse_nhap_id: number
  ten_kho_nhap: string
  phan_xuong_nhap_id: number | null
  ten_phan_xuong_nhap: string
  phap_nhan_nhap_id: number | null
  ten_phap_nhan_nhap: string
  ngay: string
  ghi_chu: string | null
  trang_thai: string
  created_at: string | null
  phap_nhan_id_for_print: number | null
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
  phap_nhan_id: number | null
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
  loai_kho?: string | null
  phan_xuong_id?: number | null
  ten_phan_xuong?: string | null
  phap_nhan_id?: number | null
  ten_phap_nhan?: string | null
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
  barcode?: string | null
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
  loai_kho?: string | null
  phan_xuong_id?: number | null
  ten_phan_xuong?: string | null
  loai_nhap: string
  tong_gia_tri: number
  trang_thai: 'nhap_nhanh' | 'nhap' | 'da_duyet'
  ghi_chu: string | null
  so_xe: string | null
  phap_nhan_id: number | null
  ten_phap_nhan?: string | null
  phap_nhan_id_for_print?: number | null
  invoice_image: string | null   // null trong list, có giá trị trong detail
  has_invoice_image: boolean
  ocr_extracted_data: string | null  // JSON string của OcrExtracted
  co_hoa_don: boolean
  qc_phieu_id: number | null
  hd_tong_kg: number | null
  created_at: string | null
  items: GoodsReceiptItem[]
}

export interface CreateGoodsReceiptPayload {
  ngay_nhap: string
  po_id?: number | null
  supplier_id: number
  warehouse_id?: number | null
  phan_xuong_id?: number | null
  loai_kho_auto?: string
  phap_nhan_id?: number | null
  bo_qua_hach_toan?: boolean
  loai_nhap?: string
  ghi_chu?: string | null
  so_xe?: string | null
  invoice_image?: string | null
  hd_tong_kg?: number | null
  items: Omit<GoodsReceiptItem, 'id' | 'thanh_tien'>[]
}

export interface QuickCapturePayload {
  ngay_nhap: string
  supplier_id?: number | null
  phap_nhan_id: number
  loai_kho_auto?: string   // 'GIAY_CUON' | 'NVL_PHU' | 'PHOI'
  so_xe?: string | null
  invoice_image?: string | null
  hd_tong_kg?: number | null
}

export interface OcrExtractedItem {
  ten: string | null
  kho_mm: number | null
  gsm: number | null
  ky_hieu: string | null
  so_cuon: number | null
  trong_luong_kg: number | null
}

export interface OcrExtracted {
  ten_ncc: string | null
  ngay_xuat: string | null
  so_xe: string | null
  hang_hoa: OcrExtractedItem[]
  tong_kg: number | null
  ghi_chu: string | null
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
  ten_xuong?: string
  phap_nhan_id: number | null
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
  phap_nhan_id: number | null
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
  loai_thung?: string | null
  kho_tt?: number | null
  dai_tt?: number | null
  so_lop?: number | null
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
  dien_tich?: number | null
  trong_luong?: number | null
  the_tich?: number | null
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
  phap_nhan_id: number | null
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
  ma_ky_hieu: string | null
  ten: string | null
  kho: number | null
  dinh_luong: number | null
  loai_giay?: string | null
  ton_toi_thieu: number
  warehouse_id: number
  ten_kho: string
  phan_xuong_id: number | null
  ten_phan_xuong: string | null
  phap_nhan_id?: number | null
  ten_phap_nhan?: string | null
  ton_luong: number
  so_cuon: number
  gia_tri_ton: number
  don_gia_binh_quan: number
  ten_nsx?: string | null
  bien_dong?: number | null
  ngay_nhap_gan_nhat?: string | null
}

export interface DoiSoatGiayRow {
  paper_material_id: number
  ma_chinh: string | null
  ma_ky_hieu: string | null
  ten: string | null
  ten_nsx: string | null
  loai_giay: string | null
  ton_sql: number
  gia_sql: number
  tong_nhap_erp: number
  gia_erp: number
  chenh_lech: number
  ty_le_khop: number | null
  chenh_gia: number
  ngay_nhap_erp: string | null
}

export interface GiayRoll {
  id: number
  barcode: string
  goods_receipt_id: number
  goods_receipt_item_id: number | null
  paper_material_id: number | null
  ma_chinh: string | null
  ten: string | null
  ky_hieu: string | null
  kho: number | null
  dinh_luong: number | null
  ma_nsx: string | null
  warehouse_id: number | null
  phan_xuong_id: number | null
  ten_kho: string | null
  so_phieu_nhap: string | null
  ngay_nhap: string | null
  trong_luong_ban_dau: number
  trong_luong_con_lai: number
  trang_thai: 'trong_kho' | 'dang_dung' | 'da_dung'
  created_at: string | null
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

export interface TonDauKyBalance {
  id: number
  warehouse_id: number
  ten_kho: string
  paper_material_id: number | null
  other_material_id: number | null
  product_id: number | null
  ma_hang: string
  ten_hang: string
  don_vi: string
  ton_luong: number
  don_gia_binh_quan: number
  gia_tri_ton: number
  cap_nhat_luc: string | null
}

export interface TonDauKyItemPayload {
  warehouse_id: number
  paper_material_id?: number | null
  other_material_id?: number | null
  so_luong: number
  don_gia: number
  ten_hang?: string | null
  don_vi?: string | null
}

export interface SoNhapXuatTonRow {
  warehouse_id: number
  warehouse_name: string
  warehouse_code: string
  paper_material_id: number | null
  other_material_id: number | null
  ma_hang: string
  ten_hang: string
  don_vi: string
  don_gia: number
  ton_dau: number
  gia_tri_dau: number
  so_luong_nhap: number
  gia_tri_nhap: number
  so_luong_xuat: number
  gia_tri_xuat: number
  ton_cuoi: number
  gia_tri_cuoi: number
}

export interface DoiSoatCuonRow {
  paper_material_id: number
  warehouse_id: number
  warehouse_name: string | null
  ma_giay: string | null
  ten: string | null
  kho_mm: number | null
  dinh_luong: number | null
  so_cuon: number
  paper_roll_ton: number
  balance_ton: number
  chenh_lech: number
  chenh_lech_phan_tram: number | null
}

export const warehouseApi = {
  // Phân xưởng
  listPhanXuong: (params?: { co_kho?: boolean }) => client.get<PhanXuong[]>('/warehouse/phan-xuong', { params }),
  createPhanXuong: (data: CreatePhanXuongPayload) => client.post<PhanXuong>('/warehouse/phan-xuong', data),
  updatePhanXuong: (id: number, data: CreatePhanXuongPayload) => client.put<PhanXuong>(`/warehouse/phan-xuong/${id}`, data),
  deletePhanXuong: (id: number) => client.delete(`/warehouse/phan-xuong/${id}`),

  // Tồn kho
  getTonKho: (params?: { warehouse_id?: number; phan_xuong_id?: number; phap_nhan_id?: number; loai?: string; search?: string }) =>
    client.get<TonKho[]>('/warehouse/ton-kho', { params }),
  getTonKhoSummary: () => client.get<TonKhoSummary>('/warehouse/ton-kho/summary'),
  snapshotTonKho: () => client.post<{ snapped: number }>('/warehouse/ton-kho/snapshot'),

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
  listPhieuChuyen: (params?: { warehouse_xuat_id?: number; warehouse_nhap_id?: number; phan_xuong_xuat_id?: number; phan_xuong_nhap_id?: number; phap_nhan_xuat_id?: number; phap_nhan_nhap_id?: number; phap_nhan_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<PhieuChuyenKho[]>('/warehouse/phieu-chuyen', { params }),
  getPhieuChuyen: (id: number) => client.get<PhieuChuyenKho>(`/warehouse/phieu-chuyen/${id}`),
  createPhieuChuyen: (data: CreatePhieuChuyenPayload) => client.post<PhieuChuyenKho>('/warehouse/phieu-chuyen', data),
  deletePhieuChuyen: (id: number) => client.delete(`/warehouse/phieu-chuyen/${id}`),
  approvePhieuChuyen: (id: number) => client.patch(`/warehouse/phieu-chuyen/${id}/approve`),
  cancelPhieuChuyen: (id: number) => client.post(`/warehouse/phieu-chuyen/${id}/cancel`),
  getBtpPrice: (params: { production_order_id: number; chong_tham?: number; in_flexo_mau?: number; in_flexo_phu_nen?: boolean; in_ky_thuat_so?: boolean; chap_xa?: boolean; boi?: boolean; be_so_con?: number; dan?: boolean; ghim?: boolean; can_mang?: number }) =>
    client.get<{ production_order_id: number; ten_hang: string; gia_phoi: number | null; dien_tich: number | null; addon_detail: Record<string, number>; addon_tong: number; don_gia_btp: number; ghi_chu: string }>('/warehouse/btp-price', { params }),

  // Kiem ke / dieu chinh ton kho
  listStockAdjustments: (params?: { warehouse_id?: number; phan_xuong_id?: number; phap_nhan_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<StockAdjustment[]>('/warehouse/stock-adjustments', { params }),
  getStockAdjustment: (id: number) => client.get<StockAdjustment>(`/warehouse/stock-adjustments/${id}`),
  createStockAdjustment: (data: CreateStockAdjustmentPayload) => client.post<StockAdjustment>('/warehouse/stock-adjustments', data),
  deleteStockAdjustment: (id: number) => client.delete(`/warehouse/stock-adjustments/${id}`),
  confirmStockAdjustment: (id: number) => client.post<StockAdjustment>(`/warehouse/stock-adjustments/${id}/confirm`),
  cancelStockAdjustment: (id: number) => client.post<StockAdjustment>(`/warehouse/stock-adjustments/${id}/cancel`),

  // Lịch sử giao dịch
  getGiaoDich: (params?: { warehouse_id?: number; phan_xuong_id?: number; phap_nhan_id?: number; paper_material_id?: number; other_material_id?: number; product_id?: number; loai_giao_dich?: string; tu_ngay?: string; den_ngay?: string; limit?: number }) =>
    client.get<GiaoDich[]>('/warehouse/giao-dich', { params }),

  // Phiếu nhập kho (GoodsReceipt — linked to PO)
  listGoodsReceipts: (params?: {
    warehouse_id?: number
    supplier_id?: number
    po_id?: number
    trang_thai?: string
    phan_xuong_id?: number
    phap_nhan_id?: number
    tu_ngay?: string
    den_ngay?: string
    loai_hang?: string
    search?: string
  }) =>
    client.get<GoodsReceipt[]>('/warehouse/goods-receipts', { params }),
  getGoodsReceipt: (id: number) => client.get<GoodsReceipt>(`/warehouse/goods-receipts/${id}`),
  createGoodsReceipt: (data: CreateGoodsReceiptPayload) => client.post<GoodsReceipt>('/warehouse/goods-receipts', data),
  quickCaptureGoodsReceipt: (data: QuickCapturePayload) => client.post<GoodsReceipt>('/warehouse/goods-receipts/quick', data),
  getPendingNhapNhanhCount: () => client.get<{ giay: number; nvl: number; phoi: number; total: number }>('/warehouse/goods-receipts/pending-count'),
  completeGoodsReceipt: (id: number, data: CompleteGoodsReceiptPayload) => client.post<GoodsReceipt>(`/warehouse/goods-receipts/${id}/complete`, data),
  extractImageOcr: (id: number) => client.post<{ raw_text: string; extracted: OcrExtracted; warning?: string }>(`/warehouse/goods-receipts/${id}/extract-image`),
  deleteGoodsReceipt: (id: number) => client.delete(`/warehouse/goods-receipts/${id}`),
  approveGoodsReceipt: (id: number) => client.patch(`/warehouse/goods-receipts/${id}/approve`),
  cancelGoodsReceipt: (id: number) => client.post(`/warehouse/goods-receipts/${id}/cancel`),
  getGRMatchingStatus: (id: number) => client.get<{
    gr_id: number; so_phieu_gr: string; so_po: string | null; so_hoa_don: string | null
    gia_tri_gr: number; gia_tri_po: number | null; gia_tri_hd: number | null
    lenh_gia_po_pct: number | null; lenh_hd_pct: number | null; co_invoice: boolean
    lines: { ten_hang: string; gr_so_luong: number; gr_don_gia: number; gr_thanh_tien: number
              po_so_luong: number | null; po_don_gia: number | null
              don_gia_ok: boolean | null; so_luong_ok: boolean | null }[]
  }>(`/warehouse/goods-receipts/${id}/matching-status`),
  syncGiaBan: (id: number) => client.post<{ ok: boolean; updated: { ma_chinh: string; ten: string; gia_mua: number; gia_ban: number }[] }>(`/warehouse/goods-receipts/${id}/sync-gia-ban`),

  // Phiếu xuất NVL (MaterialIssue — linked to LSX)
  listMaterialIssues: (params?: { warehouse_id?: number; production_order_id?: number; phan_xuong_id?: number; phap_nhan_id?: number; tu_ngay?: string; den_ngay?: string }) =>
    client.get<MaterialIssue[]>('/warehouse/material-issues', { params }),
  getMaterialIssue: (id: number) => client.get<MaterialIssue>(`/warehouse/material-issues/${id}`),
  createMaterialIssue: (data: CreateMaterialIssuePayload) => client.post<MaterialIssue>('/warehouse/material-issues', data),
  deleteMaterialIssue: (id: number) => client.delete(`/warehouse/material-issues/${id}`),
  approveMaterialIssue: (id: number) => client.patch(`/warehouse/material-issues/${id}/approve`),
  cancelMaterialIssue: (id: number) => client.post(`/warehouse/material-issues/${id}/cancel`),

  // Nhập thành phẩm từ sản xuất (ProductionOutput)
  listProductionOutputs: (params?: { warehouse_id?: number; production_order_id?: number; phan_xuong_id?: number; phap_nhan_id?: number; tu_ngay?: string; den_ngay?: string }) =>
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
  getTonKhoTpLsx: (params?: { ten_khach?: string; so_lenh?: string; ten_hang?: string; nv_theo_doi_id?: number; tu_ngay?: string; den_ngay?: string }) =>
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

  getTonKhoGiay: (params?: { phan_xuong_id?: number; phap_nhan_id?: number }) =>
    client.get<TonKhoGiayRow[]>('/warehouse/ton-kho-giay', { params }),

  // GiayRoll — per-roll tracking
  createGiayRollsFromReceipt: (grId: number) =>
    client.post<{ created: string[]; existed: string[]; total: number }>(`/warehouse/giay-rolls/from-receipt/${grId}`),
  listGiayRolls: (params?: { warehouse_id?: number; paper_material_id?: number; trang_thai?: string; barcode?: string; so_phieu?: string }) =>
    client.get<GiayRoll[]>('/warehouse/giay-rolls', { params }),
  getGiayRollByBarcode: (barcode: string) =>
    client.get<GiayRoll>(`/warehouse/giay-rolls/by-barcode/${encodeURIComponent(barcode)}`),
  canGiayRoll: (rollId: number, kg_con_lai: number, production_order_id?: number | null, session_id?: number | null) =>
    client.patch<GiayRoll>(`/warehouse/giay-rolls/${rollId}/can`, { kg_con_lai, production_order_id: production_order_id ?? null, session_id: session_id ?? null }),
  printGiayRollLabels: (grId: number) =>
    `/warehouse/giay-rolls/print/${grId}`,
  printGiayRollLabelOne: (rollId: number) =>
    `/warehouse/giay-rolls/print-one/${rollId}`,
  printGiayRollsByMaterial: (materialId: number, warehouseId?: number) =>
    `/warehouse/giay-rolls/print-by-material/${materialId}${warehouseId ? `?warehouse_id=${warehouseId}` : ''}`,

  getDuTruGiay: (params?: { weeks?: number }) =>
    client.get<DuTruGiayRow[]>('/warehouse/du-tru-giay', { params }),

  // KHSX line cần mua phôi sóng ngoài
  getKHSXCanPhoiNgoai: (params?: { trang_thai?: string }) =>
    client.get<KHSXCanPhoiNgoaiRow[]>('/warehouse/khsx-can-phoi-ngoai', { params }),

  // Tồn kho NVL khác (reuse ton-kho?loai=khac)
  getTonKhoNVL: (params?: { phan_xuong_id?: number; phap_nhan_id?: number; search?: string }) =>
    client.get<TonKhoNVLRow[]>('/warehouse/ton-kho', {
      params: { loai: 'khac', ...params }
    }),

  getDoiSoatGiay: (params?: { ncc_id?: number; date_from?: string; date_to?: string }) =>
    client.get<DoiSoatGiayRow[]>('/warehouse/doi-soat-giay', { params }),

  taoPhieuQC: (grId: number) =>
    client.post<{ qc_phieu_id: number; so_phieu: string }>(`/warehouse/goods-receipts/${grId}/tao-phieu-qc`),

  exportGoodsReceiptExcel: (id: number) =>
    client.get(`/warehouse/goods-receipts/${id}/export-excel`, { responseType: 'blob' }).then(r => r.data as Blob),

  exportMaterialIssueExcel: (id: number) =>
    client.get(`/warehouse/material-issues/${id}/export-excel`, { responseType: 'blob' }).then(r => r.data as Blob),

  // Tồn đầu kỳ
  getTonDauKy: (params?: { warehouse_id?: number }) =>
    client.get<TonDauKyBalance[]>('/warehouse/ton-dau-ky', { params }),
  postTonDauKy: (items: TonDauKyItemPayload[]) =>
    client.post<{ success: number; failed: { index: number; error: string }[] }>('/warehouse/ton-dau-ky', { items }),

  // Sổ nhập xuất tồn
  getSoNhapXuatTon: (params?: { tu_ngay?: string; den_ngay?: string; warehouse_id?: number; loai_nvl?: string }) =>
    client.get<SoNhapXuatTonRow[]>('/warehouse/so-nhap-xuat-ton', { params }),
  exportSoNhapXuatTon: (params?: { tu_ngay?: string; den_ngay?: string; warehouse_id?: number; loai_nvl?: string }) =>
    client.get('/warehouse/so-nhap-xuat-ton/export', { params, responseType: 'blob' }).then(r => r.data as Blob),

  // Đối soát cuộn giấy
  getDoiSoatCuon: (showAll?: boolean) =>
    client.get<DoiSoatCuonRow[]>('/warehouse/doi-soat-cuon', { params: showAll ? { show_all: true } : {} }),
  syncCuon: (paper_material_id: number, warehouse_id: number) =>
    client.post<{ paper_material_id: number; warehouse_id: number; old_ton: number; new_ton: number; chenh_lech: number }>(
      `/warehouse/doi-soat-cuon/sync/${paper_material_id}/${warehouse_id}`
    ),

  // ── Phiên sản xuất ──────────────────────────────────────────────────────────
  listProductionSessions: (params?: {
    trang_thai?: string
    phan_xuong_id?: number
    ngay_tu?: string
    ngay_den?: string
    page?: number
    page_size?: number
  }) =>
    client.get<{
      total: number
      page: number
      page_size: number
      items: ProductionSessionSummary[]
    }>('/warehouse/production-sessions', { params }),

  getActiveProductionSessions: (phan_xuong_id?: number) =>
    client.get<ProductionSessionSummary[]>('/warehouse/production-sessions/active', {
      params: phan_xuong_id ? { phan_xuong_id } : {},
    }),

  getProductionSession: (id: number) =>
    client.get<ProductionSessionDetail>(`/warehouse/production-sessions/${id}`),

  createProductionSession: (data: { ten_phien: string; ngay_tao?: string; phan_xuong_id?: number }) =>
    client.post<{ id: number; ten_phien: string; trang_thai: string }>('/warehouse/production-sessions', data),

  assignPhieuSong: (session_id: number, phieu_ids: number[]) =>
    client.post<{ assigned: number[]; session_id: number }>(
      `/warehouse/production-sessions/${session_id}/assign-phieu-song`,
      { phieu_ids }
    ),

  unassignPhieuSong: (session_id: number, phieu_ids: number[]) =>
    client.post<{ removed: number[] }>(
      `/warehouse/production-sessions/${session_id}/unassign-phieu-song`,
      { phieu_ids }
    ),

  updateSessionWastes: (session_id: number, wastes: { flute_type: string; so_kg_hao_hut: number }[]) =>
    client.patch<{ ok: boolean }>(`/warehouse/production-sessions/${session_id}/wastes`, { wastes }),

  updateSessionMaterials: (
    session_id: number,
    materials: { other_material_id: number; so_luong: number; don_gia?: number }[]
  ) =>
    client.patch<{ ok: boolean }>(`/warehouse/production-sessions/${session_id}/materials`, { materials }),

  previewSessionAllocation: (session_id: number) =>
    client.get<ProductionSessionAllocation>(`/warehouse/production-sessions/${session_id}/preview-allocate`),

  closeProductionSession: (session_id: number) =>
    client.post<{ ok: boolean; message: string; allocation: ProductionSessionAllocation }>(
      `/warehouse/production-sessions/${session_id}/close`
    ),

  getSuggestedFlutes: (session_id: number) =>
    client.get<{ flute_types: string[] }>(`/warehouse/production-sessions/${session_id}/suggested-flutes`),

  getDefaultMaterials: (session_id: number) =>
    client.get<{ materials: { id: number; ten: string; dvt: string | null; gia_mua: number }[] }>(
      `/warehouse/production-sessions/${session_id}/default-materials`
    ),

  ensureSessionForShift: (phan_xuong_id?: number) =>
    client.post<{ created: boolean; session: ProductionSessionSummary }>(
      '/warehouse/production-sessions/ensure-for-shift',
      { phan_xuong_id: phan_xuong_id ?? null }
    ),

  mergeSession: (session_id: number, source_session_id: number) =>
    client.post<{ ok: boolean; message: string; session_id: number }>(
      `/warehouse/production-sessions/${session_id}/merge`,
      { source_session_id }
    ),

  splitSession: (
    session_id: number,
    body: { ten_phien_moi: string; phieu_ids: number[]; roll_ids: number[] }
  ) =>
    client.post<{ ok: boolean; message: string; new_session_id: number; new_session: ProductionSessionSummary }>(
      `/warehouse/production-sessions/${session_id}/split`,
      body
    ),

  moveRollToSession: (session_id: number, roll_id: number, target_session_id: number) =>
    client.patch<{ ok: boolean; roll_id: number; from_session_id: number; to_session_id: number }>(
      `/warehouse/production-sessions/${session_id}/rolls/${roll_id}/move`,
      { target_session_id }
    ),

  getProductionSessionReport: (session_id: number) =>
    client.get<SessionReportData>(`/warehouse/production-sessions/${session_id}/report`),

  getProductionSessionsSummaryReport: (params?: {
    tu_ngay?: string
    den_ngay?: string
    phan_xuong_id?: number
  }) =>
    client.get<{ total: number; items: SessionSummaryReportItem[] }>(
      '/warehouse/production-sessions/summary-report',
      { params }
    ),
}

// ── Production Session Types ──────────────────────────────────────────────────

export interface ProductionSessionSummary {
  id: number
  ten_phien: string
  ngay_tao: string | null
  trang_thai: 'dang_chay' | 'cho_phan_bo' | 'da_chot'
  phan_xuong_id: number | null
  phan_xuong_ten: string | null
  so_cuon: number
  so_phieu: number
  created_by: number | null
  created_at: string | null
  closed_at: string | null
}

export interface SessionRollDetail {
  id: number
  giay_roll_id: number
  barcode: string | null
  paper_material_id: number | null
  ten_nvl: string | null
  kho: number | null
  dinh_luong: number | null
  trong_luong_dau: number
  trong_luong_cuoi: number | null
  trong_luong_tieu_hao: number | null
  ngay_can: string | null
}

export interface SessionPhieuSongItem {
  id: number
  production_order_item_id: number
  ten_hang: string | null
  so_lop: number | null
  chieu_kho: number | null
  chieu_cat: number | null
  so_luong_ke_hoach: number
  so_luong_thuc_te: number | null
}

export interface SessionPhieuSong {
  id: number
  so_phieu: string
  ngay: string | null
  ca: string | null
  production_order_id: number
  items: SessionPhieuSongItem[]
}

export interface ProductionSessionDetail extends ProductionSessionSummary {
  rolls: SessionRollDetail[]
  materials: {
    id: number
    other_material_id: number
    ten_nvl: string | null
    so_luong: number
    don_gia: number
    thanh_tien: number
  }[]
  paper_wastes: {
    id: number
    flute_type: string
    so_kg_hao_hut: number
  }[]
  phieu_nhap_phoi_songs: SessionPhieuSong[]
  allocation_detail: AllocationLSXItem[] | null
}

export interface AllocationLSXItem {
  production_order_item_id: number
  production_order_id: number
  ten_hang: string | null
  so_lop: number | null
  so_luong: number
  dien_tich_m2: number
  dien_tich_quy_doi: number
  chi_phi_giay: number
  chi_phi_nvl_phu: number
  chi_phi_tong: number
}

export interface ProductionSessionAllocation {
  session_id: number
  ten_phien: string
  trang_thai: string
  rolls_by_material: {
    pm_id: number
    ten: string
    tieu_hao_kg: number
    don_gia: number
    chi_phi: number
  }[]
  allocation_by_lsx: AllocationLSXItem[]
  total_tieu_hao_giay_kg: number
  total_hao_hut_kg: number
  total_chi_phi_giay: number
  total_chi_phi_nvl_phu: number
  total_chi_phi_phien: number
  errors: string[]
}

// ── Báo cáo quản trị phiên sản xuất ──────────────────────────────────────────

export interface SessionReportLSX {
  production_order_id: number
  so_lenh: string | null
  ten_hang: string
  ke_hoach: number
  thuc_te: number
  loi: number
  ty_le_hoan_thanh: number | null
  ty_le_loi: number | null
}

export interface SessionReportChiPhiLSX {
  production_order_id: number | null
  ten_hang: string | null
  so_luong: number
  chi_phi_giay: number
  chi_phi_nvl_phu: number
  chi_phi_khau: number
  tong: number
}

export interface SessionReportData {
  session: {
    id: number
    ten_phien: string
    ngay_tao: string | null
    trang_thai: string
    phan_xuong_ten: string | null
    created_at: string | null
    closed_at: string | null
  }
  san_luong: {
    ke_hoach: number
    thuc_te: number
    so_luong_loi: number
    ty_le_hoan_thanh: number | null
    ty_le_loi: number | null
    detail_by_lsx: SessionReportLSX[]
  }
  tieu_hao_nvl: {
    tong_kg_giay_tieu_hao: number
    tong_kg_hao_hut: number
    ty_le_hao_hut_pct: number | null
    hao_hut_by_flute: { flute_type: string; so_kg: number }[]
    nvl_phu: { ten_nvl: string | null; don_vi: string | null; so_luong: number; don_gia: number; thanh_tien: number }[]
  }
  chi_phi: {
    tong_chi_phi: number
    chi_phi_giay: number
    chi_phi_nvl_phu: number
    chi_phi_khau: number
    detail_by_lsx: SessionReportChiPhiLSX[]
  } | null
  thoi_gian: {
    tong_phut_chay: number
    tong_phut_dung: number
    hieu_suat_thoi_gian_pct: number | null
    may_dung_log: {
      ngay: string | null
      gio_bat_dau: string | null
      gio_tiep_tuc: string | null
      phut: number
      ly_do: string
      ghi_chu: string | null
    }[]
  }
}

export interface SessionSummaryReportItem {
  id: number
  ten_phien: string
  ngay_tao: string | null
  trang_thai: string
  phan_xuong_ten: string | null
  so_cuon: number
  so_phieu: number
  ke_hoach: number
  thuc_te: number
  so_luong_loi: number
  ty_le_hoan_thanh: number | null
  ty_le_loi: number | null
  tong_kg_tieu_hao: number
  tong_kg_hao_hut: number
  ty_le_hao_hut: number | null
  tong_chi_phi: number | null
  tong_phut_dung: number
  closed_at: string | null
}

