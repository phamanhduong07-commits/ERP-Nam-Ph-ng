// Pure config — no React imports. Add new entities here when needed.

export interface QuickAddField {
  name: string
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'textarea'
  placeholder?: string
}

export interface QuickAddConfig {
  /** POST endpoint relative to /api, e.g. '/customers' */
  endpoint: string
  /** Modal title, e.g. 'Thêm nhanh Khách hàng' */
  title: string
  fields: QuickAddField[]
  /** Field from API response to use as display label after creation */
  labelField: string
  /** Field from API response to use as Select value (default: 'id') */
  valueField?: string
}

export const QUICK_ADD_CONFIGS = {
  customer: {
    endpoint: '/customers',
    title: 'Thêm nhanh Khách hàng',
    labelField: 'ten_viet_tat',
    fields: [
      { name: 'ten_viet_tat', label: 'Tên viết tắt', required: true, placeholder: 'VD: Công ty ABC' },
      { name: 'ten_don_vi', label: 'Tên đầy đủ', placeholder: 'Tên pháp nhân đầy đủ' },
      { name: 'dien_thoai', label: 'Điện thoại' },
    ],
  },
  supplier: {
    endpoint: '/suppliers',
    title: 'Thêm nhanh Nhà cung cấp',
    labelField: 'ten_don_vi',
    fields: [
      { name: 'ten_don_vi', label: 'Tên nhà cung cấp', required: true },
      { name: 'ma_ncc', label: 'Mã NCC' },
      { name: 'so_dien_thoai', label: 'Điện thoại' },
    ],
  },
  employee: {
    endpoint: '/hr/employees',
    title: 'Thêm nhanh Nhân viên',
    labelField: 'ho_ten',
    fields: [
      { name: 'ho_ten', label: 'Họ tên', required: true },
      { name: 'email', label: 'Email' },
    ],
  },
  product: {
    endpoint: '/products',
    title: 'Thêm nhanh Sản phẩm',
    labelField: 'ten_hang',
    fields: [
      { name: 'ma_amis', label: 'Mã hàng', required: true },
      { name: 'ten_hang', label: 'Tên hàng', required: true },
    ],
  },
} satisfies Record<string, QuickAddConfig>
