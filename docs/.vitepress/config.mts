import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Nam Phương ERP",
  description: "Tài liệu Hướng dẫn sử dụng phần mềm ERP Nam Phương",
  themeConfig: {
    logo: '/logo.png', // Tùy chọn: Thêm logo vào docs/public/logo.png
    nav: [
      { text: 'Trang Chủ', link: '/' },
      { text: 'Bán Hàng', link: '/sales/01_tao_khach_hang_moi' }
    ],
    sidebar: [
      {
        text: 'Chặng 1: Bán Hàng & Báo Giá',
        collapsed: false,
        items: [
          { text: '1. Tạo Khách Hàng', link: '/user_guide/01_sales/01_tao_khach_hang_moi' },
          { text: '2. Lập Báo Giá', link: '/user_guide/01_sales/02_lap_bao_gia_thung_carton' },
          { text: '3. Chốt SO & Giao Hàng', link: '/user_guide/01_sales/03_chuyen_doi_so_va_giao_hang' }
        ]
      },
      {
        text: 'Chặng 2: Mua Hàng & Kho',
        collapsed: true,
        items: [
          { text: '1. Dự báo & Lên PO', link: '/user_guide/02_kho_mua_hang/01_du_bao_va_len_po' },
          { text: '2. Nhập & Xuất Kho', link: '/user_guide/02_kho_mua_hang/02_nhap_kho_va_xuat_kho' },
          { text: '3. Thẻ Kho & Kiểm Kê', link: '/user_guide/02_kho_mua_hang/03_the_kho_va_kiem_ke' }
        ]
      },
      {
        text: 'Chặng 3: Sản Xuất & CD2',
        collapsed: true,
        items: [
          { text: 'Quy trình Sản xuất', link: '/user_guide/03_san_xuat/overview' },
          { text: 'Kanban & Scan', link: '/user_guide/03_san_xuat/kanban_scan' }
        ]
      },
      {
        text: 'Chặng 4: Kế Toán & Nhân Sự',
        collapsed: true,
        items: [
          { text: 'Kế toán & Giá thành', link: '/user_guide/04_ke_toan_nhan_su/ke_toan' },
          { text: 'Nhân sự & Tiền lương', link: '/user_guide/04_ke_toan_nhan_su/nhan_su' }
        ]
      },
      {
        text: 'Chặng 5: Quản Trị & Admin',
        collapsed: true,
        items: [
          { text: 'Print Templates', link: '/user_guide/05_admin/print_templates' },
          { text: 'Báo cáo Quản trị', link: '/user_guide/05_admin/reports' }
        ]
      }
    ],
    search: {
      provider: 'local'
    },
    docFooter: {
      prev: 'Bài trước',
      next: 'Bài tiếp theo'
    }
  },
  markdown: {
    config: (md) => {
      // Có thể thêm plugin mermaid ở đây nếu cài plugin
    }
  }
})
