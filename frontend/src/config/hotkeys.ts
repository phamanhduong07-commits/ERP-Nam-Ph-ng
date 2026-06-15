export interface HotkeyEntry {
  key: string
  description: string
  group: string
}

export const ALL_HOTKEYS: HotkeyEntry[] = [
  // Toàn cục
  { key: 'ctrl+k',  description: 'Tìm kiếm toàn cục',                     group: 'Toàn cục' },
  { key: '?',       description: 'Hiện danh sách phím tắt',                group: 'Toàn cục' },
  { key: 'escape',  description: 'Đóng modal — hoặc quay lại trang trước', group: 'Toàn cục' },

  // Trang danh sách
  { key: 'ctrl+n',  description: 'Thêm mới (mở form tạo)',                 group: 'Trang danh sách' },

  // Bảng dữ liệu
  { key: 'arrowdown', description: 'Dòng kế tiếp trong bảng',              group: 'Bảng dữ liệu' },
  { key: 'arrowup',   description: 'Dòng trước trong bảng',                group: 'Bảng dữ liệu' },
  { key: 'enter',     description: 'Mở / chỉnh sửa dòng đang chọn',        group: 'Bảng dữ liệu' },

  // Tabs
  { key: 'arrowleft',  description: 'Chuyển sang tab trước',               group: 'Tabs' },
  { key: 'arrowright', description: 'Chuyển sang tab kế tiếp',             group: 'Tabs' },

  // Form / Modal
  { key: 'ctrl+s',  description: 'Lưu / Xác nhận form',                    group: 'Form & Modal' },
]
