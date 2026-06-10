export type DashboardType =
  | 'bgd'
  | 'sales_manager'
  | 'sales_staff'
  | 'accounting'
  | 'production'
  | 'warehouse'
  | 'purchase'
  | 'default'

const ROLE_DASHBOARD_MAP: Record<string, DashboardType> = {
  // Ban Giám Đốc + Admin — thấy toàn bộ
  ADMIN: 'bgd',
  BGD_GIAM_DOC: 'bgd',
  BGD_TO_TRUONG: 'bgd',
  BGD_NHAN_VIEN: 'bgd',

  // Trưởng phòng Kinh Doanh / Sale Admin — thấy doanh thu, phê duyệt, team
  TRUONG_PHONG_SALE_ADMIN: 'sales_manager',
  KINH_DOANH_TO_TRUONG: 'sales_manager',
  SALE_ADMIN_TO_TRUONG: 'sales_manager',

  // Nhân viên Kinh Doanh / Sale Admin — thấy tác vụ hằng ngày
  KINH_DOANH_NHAN_VIEN: 'sales_staff',
  SALE_ADMIN_NHAN_VIEN: 'sales_staff',
  SALE_ADMIN: 'sales_staff',

  // Kế Toán
  KE_TOAN_TRUONG: 'accounting',
  KETOAN_TO_TRUONG: 'accounting',
  KE_TOAN_CONG_NO: 'accounting',
  KETOAN_NHAN_VIEN: 'accounting',
  KE_TOAN_MUA_HANG: 'accounting',

  // Sản Xuất
  SAN_XUAT_GIAM_SAT: 'production',
  SAN_XUAT_TO_TRUONG: 'production',
  SAN_XUAT_THO: 'production',

  // Kho
  KHO_TO_TRUONG: 'warehouse',
  KHO_NHAN_VIEN: 'warehouse',

  // Mua hàng
  MUA_HANG_TRUONG_PHONG: 'purchase',
  MUA_HANG_NHAN_VIEN: 'purchase',
}

export function getDashboardType(role: string | null | undefined): DashboardType {
  if (!role) return 'default'
  return ROLE_DASHBOARD_MAP[role] ?? 'default'
}
