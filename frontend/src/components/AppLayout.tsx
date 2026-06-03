import { useState } from 'react'
import type { ApiError } from '../api/types'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Typography, Space, theme, Badge, Button, message,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined, ShoppingOutlined, DatabaseOutlined,
  TeamOutlined, UserOutlined, LogoutOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ToolOutlined, ClockCircleOutlined,
  AccountBookOutlined, RobotOutlined, BarChartOutlined, ShopOutlined,
  ThunderboltOutlined, FileTextOutlined, MobileOutlined, CarOutlined,
  TrophyOutlined, CrownOutlined, DollarOutlined,
  CheckCircleOutlined, FileProtectOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { authApi } from '../api/auth'
import { productionPlansApi } from '../api/productionPlans'
const namPhuongLogo = '/logo_namphuong.png'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// ─── Phân quyền menu ──────────────────────────────────────────────────────────
type RawMenuItem = {
  key: string
  icon?: React.ReactNode
  label: React.ReactNode
  roles?: string[]
  permissions?: string[]
  children?: RawMenuItem[]
}

function filterByRole(items: RawMenuItem[], role: string, userPermissions: string[] = []): object[] {
  return items
    .filter(item => {
      // Admin luôn thấy tất cả
      if (role === 'ADMIN' || role === 'admin') return true

      // 1 rule duy nhất: nếu menu có permissions → phải có trong Ma trận mới hiện
      if (item.permissions && item.permissions.length > 0) {
        return item.permissions.some(p => userPermissions.includes(p))
      }

      // Không định nghĩa permissions (VD: Dashboard, Trợ lý AI) → hiện
      return true
    })
    .map(({ roles: _roles, permissions: _perms, children, ...rest }) => ({
      ...rest,
      ...(children ? { children: filterByRole(children, role, userPermissions) } : {}),
    }))
    .filter(item => {
      const c = (item as RawMenuItem).children
      return c === undefined || c.length > 0
    })
}

const ADMIN_GD = ['ADMIN', 'GIAM_DOC']
const BAN_HANG = ['ADMIN', 'GIAM_DOC', 'KINH_DOANH', 'KE_TOAN', 'SALE_ADMIN', 'TRUONG_PHONG_SALE_ADMIN']
const SAN_XUAT_FULL = ['ADMIN', 'GIAM_DOC', 'SAN_XUAT', 'KINH_DOANH']
const SAN_XUAT_ALL = ['ADMIN', 'GIAM_DOC', 'SAN_XUAT', 'KINH_DOANH', 'CONG_NHAN']
const KHO_ROLES = ['ADMIN', 'GIAM_DOC', 'KHO', 'SAN_XUAT', 'KE_TOAN', 'MUA_HANG', 'KHO_TO_TRUONG', 'KHO_NHAN_VIEN']
const MUA_HANG = ['ADMIN', 'GIAM_DOC', 'MUA_HANG', 'KE_TOAN', 'KE_TOAN_TRUONG']
const KE_TOAN_ROLES = ['ADMIN', 'GIAM_DOC', 'KE_TOAN', 'KE_TOAN_TRUONG', 'KETOAN_TO_TRUONG', 'KE_TOAN_CONG_NO', 'KETOAN_NHAN_VIEN']

function buildMenuItems(queueCount: number): RawMenuItem[] {
  return [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Tổng quan</Link>,
    },
    {
      key: 'ban-hang',
      icon: <ShoppingCartOutlined />,
      label: 'Bán hàng',
      permissions: ['sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve'],
      children: [
        { key: '/quotes', label: <Link to="/quotes">Báo giá</Link> },
        { key: '/sales/orders', label: <Link to="/sales/orders">Đơn hàng</Link> },
        { key: '/sales/returns', label: <Link to="/sales/returns">Trả hàng bán</Link> },
        { key: '/sales/theo-don-hang', label: <Link to="/sales/theo-don-hang">Theo dõi đơn hàng</Link> },
        { key: '/sales/giao-hang', label: <Link to="/sales/giao-hang">🚚 Giao hàng</Link> },
        { key: '/billing/invoices', label: <Link to="/billing/invoices">Hóa đơn VAT</Link> },
      ],
    },
    {
      key: 'san-xuat',
      icon: <ShopOutlined />,
      label: 'Sản xuất',
      permissions: ['production_order.view', 'production_order.create', 'production_order.edit'],
      children: [
        { key: '/production/orders', label: <Link to="/production/orders">Lệnh sản xuất</Link>, roles: SAN_XUAT_FULL },
        { key: '/production/plans', label: <Link to="/production/plans">Kế hoạch sản xuất</Link>, roles: SAN_XUAT_FULL },
        { key: '/production/tan-dung', label: <Link to="/production/tan-dung">Kế hoạch tận dụng</Link>, roles: SAN_XUAT_FULL },
        {
          key: '/production/queue',
          roles: SAN_XUAT_FULL,
          label: (
            <Link to="/production/queue">
              <Space>
                KH SX chờ
                {queueCount > 0 && (
                  <Badge count={queueCount} size="small" style={{ marginLeft: 4 }} />
                )}
              </Space>
            </Link>
          ),
        },
        { key: '/production/bom', label: <Link to="/production/bom">Định mức (BOM)</Link>, roles: SAN_XUAT_FULL },
        { key: '/production/phieu-phoi', label: <Link to="/production/phieu-phoi">Phiếu phôi sóng</Link>, roles: SAN_XUAT_FULL },
        { key: '/production/may-song', label: <Link to="/production/may-song">🌊 Máy Sóng</Link>, roles: SAN_XUAT_FULL },
        {
          key: 'cd2-group',
          label: '🖨 Công đoạn 2 (CD2)',
          children: [
            // ── Tổ trưởng ───────────────────────────────────────────────────
            { key: '/production/cd2/dashboard',   label: <Link to="/production/cd2/dashboard">📈 Dashboard</Link>, roles: SAN_XUAT_FULL },
            { key: '/production/cd2',             label: <Link to="/production/cd2">🗂 Kanban máy in</Link> },
            { key: '/production/cd2/sauin-kanban',label: <Link to="/production/cd2/sauin-kanban">🏭 Kanban TP</Link> },
            { key: '/production/cd2/may-in',      label: <Link to="/production/cd2/may-in">📋 Queue máy in</Link> },
            { key: '/production/cd2/history',     label: <Link to="/production/cd2/history">📊 Thống kê sản lượng</Link> },
            // ── Công nhân ───────────────────────────────────────────────────
            { key: '/production/cd2/worker',      label: <Link to="/production/cd2/worker">👷 Máy in của tôi</Link> },
            { key: '/cd2/machine-login',          label: <Link to="/cd2/machine-login">🔑 Đăng nhập máy</Link> },
            { key: '/production/cd2/scan',        label: <Link to="/production/cd2/scan">📊 Scan sản lượng</Link> },
            { key: '/production/cd2/mobile-tracking', label: <Link to="/production/cd2/mobile-tracking">📱 Mobile (kiosk)</Link> },
            // ── Quản trị ────────────────────────────────────────────────────
            { key: '/production/cd2/shift',       label: <Link to="/production/cd2/shift">⏰ Quản lý ca</Link>, roles: SAN_XUAT_FULL },
            { key: '/production/cd2/config',      label: <Link to="/production/cd2/config">⚙ Cấu hình CD2</Link>, roles: ADMIN_GD },
          ],
        },
      ],
    },
    {
      key: 'kho',
      icon: <FileTextOutlined />,
      label: 'Kho',
      permissions: ['inventory.view', 'inventory.import', 'inventory.export', 'inventory.transfer', 'inventory.adjust', 'inventory.phoi_tp'],
      children: [
        { key: '/warehouse/theo-xuong', label: <Link to="/warehouse/theo-xuong">Kho theo xưởng</Link>, permissions: ['inventory.view', 'inventory.import'] },
        { key: '/production/kho-phoi', label: <Link to="/production/kho-phoi">Kho phôi sóng</Link>, permissions: ['inventory.view', 'inventory.phoi_tp'] },
        { key: '/production/kho-thanh-pham', label: <Link to="/production/kho-thanh-pham">Kho thành phẩm</Link>, permissions: ['inventory.view', 'inventory.phoi_tp'] },
        { key: '/production/phieu-nhap-phoi', label: <Link to="/production/phieu-nhap-phoi">DS nhập phôi sóng</Link>, permissions: ['inventory.view', 'inventory.import'] },
        { key: '/warehouse/inventory', label: <Link to="/warehouse/inventory">Tồn kho</Link>, permissions: ['inventory.view', 'inventory.import'] },
        { key: '/warehouse/nhap-nhanh', label: <Link to="/warehouse/nhap-nhanh">📷 Ghi nhận xe nhập giấy</Link>, permissions: ['inventory.import'] },
        { key: '/warehouse/nhap-nhanh?loai=nvl', label: <Link to="/warehouse/nhap-nhanh?loai=nvl">📷 Ghi nhận xe nhập NVL</Link>, permissions: ['inventory.import'] },
        { key: '/warehouse/nhap-nhanh?loai=phoi', label: <Link to="/warehouse/nhap-nhanh?loai=phoi">📷 Ghi nhận xe nhập phôi</Link>, permissions: ['inventory.import'] },
        { key: '/warehouse/nhap-giay', label: <Link to="/warehouse/nhap-giay">Nhập giấy cuộn</Link>, permissions: ['inventory.import'] },
        { key: '/warehouse/nhap-phoi-ngoai', label: <Link to="/warehouse/nhap-phoi-ngoai">Nhập phôi sóng (mua ngoài)</Link>, permissions: ['inventory.import'] },
        { key: '/warehouse/receipts', label: <Link to="/warehouse/receipts">Nhập NVL khác</Link>, permissions: ['inventory.import'] },
        { key: '/warehouse/issues', label: <Link to="/warehouse/issues">Xuất NVL sản xuất</Link>, permissions: ['inventory.export'] },
        { key: '/warehouse/production-output', label: <Link to="/warehouse/production-output">Nhập TP từ SX</Link>, permissions: ['inventory.import'] },
        { key: '/warehouse/transfers', label: <Link to="/warehouse/transfers">Chuyển kho</Link>, permissions: ['inventory.transfer'] },
        { key: '/warehouse/stock-adjustments', label: <Link to="/warehouse/stock-adjustments">Kiểm kê / điều chỉnh</Link>, permissions: ['inventory.adjust'] },
        { key: '/warehouse/the-kho', label: <Link to="/warehouse/the-kho">Sổ chi tiết / Thẻ kho</Link>, permissions: ['inventory.view', 'inventory.import'] },
      ],
    },
    {
      key: 'mua-hang',
      icon: <ShopOutlined />,
      label: 'Mua hàng',
      permissions: ['purchase.import', 'inventory.import'],
      children: [
        { key: '/purchasing/du-bao-nhu-cau', label: <Link to="/purchasing/du-bao-nhu-cau">Dự báo nhu cầu</Link> },
        { key: '/purchasing/ymh', label: <Link to="/purchasing/ymh">Yêu cầu mua hàng (YMH)</Link> },
        { key: '/purchasing/giay-cuon', label: <Link to="/purchasing/giay-cuon">Mua giấy</Link> },
        { key: '/purchasing/nvl-khac', label: <Link to="/purchasing/nvl-khac">Mua NVL khác</Link> },
        { key: '/purchasing/orders', label: <Link to="/purchasing/orders">Đơn mua hàng (PO)</Link> },
        { key: '/purchasing/goods-receipts', label: <Link to="/purchasing/goods-receipts">Phiếu nhập kho (GR)</Link> },
        { key: '/purchasing/dashboard', label: <Link to="/purchasing/dashboard">Dashboard mua hàng</Link> },
        { key: '/purchasing/doi-soat-kho', label: <Link to="/purchasing/doi-soat-kho">Đối soát kho (PO vs GR)</Link> },
        { key: '/accounting/purchase-invoices', label: <Link to="/accounting/purchase-invoices">Hóa đơn mua hàng</Link> },
        { key: '/purchasing/returns', label: <Link to="/purchasing/returns">Trả hàng NCC</Link> },
        { key: '/purchasing/reports', label: <Link to="/purchasing/reports">Báo cáo mua hàng</Link> },
      ],
    },
    {
      key: 'ke-toan-tai-chinh',
      icon: <AccountBookOutlined />,
      label: 'Kế toán - Tài chính',
      permissions: ['accounting.import'],
      children: [
        {
          key: 'cash-bank',
          label: 'Quỹ & Ngân hàng',
          children: [
            { key: '/accounting/receipts', label: <Link to="/accounting/receipts">Phiếu thu</Link> },
            { key: '/accounting/payments', label: <Link to="/accounting/payments">Phiếu chi</Link> },
            { key: '/accounting/cash-book', label: <Link to="/accounting/cash-book">Sổ quỹ tiền mặt</Link> },
            { key: '/accounting/bank-ledger', label: <Link to="/accounting/bank-ledger">Sổ tiền gửi NH</Link> },
          ]
        },
        {
          key: 'cong-no',
          label: 'Quản lý Công nợ',
          children: [
            { key: '/accounting/ar-ledger', label: <Link to="/accounting/ar-ledger">Sổ công nợ phải thu</Link> },
            { key: '/accounting/ap-ledger', label: <Link to="/accounting/ap-ledger">Sổ công nợ phải trả</Link> },
            { key: '/accounting/ar-reconciliation', label: <Link to="/accounting/ar-reconciliation">Đối soát công nợ</Link> },
            { key: '/accounting/ap-reconciliation', label: <Link to="/accounting/ap-reconciliation">Đối chiếu công nợ NCC</Link> },
            { key: '/accounting/customer-refunds', label: <Link to="/accounting/customer-refunds">Hoàn tiền trả hàng</Link> },
            { key: '/billing/adjustments', label: <Link to="/billing/adjustments">Duyệt điều chỉnh HĐ</Link> },
          ]
        },
        { key: '/accounting/journal-entries', label: <Link to="/accounting/journal-entries">Bút toán tổng hợp</Link> },
        { key: '/accounting/hoa-don-dien-tu', icon: <FileProtectOutlined />, label: <Link to="/accounting/hoa-don-dien-tu">Hóa đơn điện tử</Link> },
        { key: '/accounting/workshop-management', label: <Link to="/accounting/workshop-management">Quản trị xưởng (Lương)</Link> },
        { key: '/accounting/ccdc', label: <Link to="/accounting/ccdc">Tài sản & CCDC</Link> },
        { key: '/fixed-assets', label: <Link to="/fixed-assets">Tài sản cố định</Link> },
        { key: '/accounting/general-ledger', label: <Link to="/accounting/general-ledger">Sổ cái tài khoản</Link> },
      ],
    },
    {
      key: 'hrm-group',
      icon: <TeamOutlined />,
      label: 'Nhân sự (HRM)',
      permissions: ['user.view', 'user.create', 'user.edit', 'permission.view', 'permission.manage', 'team.manage_permissions'],
      children: [
        { key: '/hr/employees', label: <Link to="/hr/employees">Hồ sơ nhân viên</Link>, permissions: ['hr.view', 'hr.employees'] },
        { key: '/hr/departments', label: <Link to="/hr/departments">Cơ cấu tổ chức</Link>, permissions: ['hr.departments'] },
        { key: '/hr/permission-matrix', label: <Link to="/hr/permission-matrix">Ma trận phân quyền</Link>, permissions: ['permission.view', 'permission.manage'] },
        { key: '/hr/team-permissions', label: <Link to="/hr/team-permissions">🔑 Quyền cá nhân (Team)</Link>, permissions: ['team.manage_permissions'] },
        { key: '/hr/attendance', label: <Link to="/hr/attendance">Chấm công & Đơn từ</Link>, permissions: ['hr.attendance'] },
        { key: '/hr/payroll', label: <Link to="/hr/payroll">Bảng lương sản phẩm</Link>, permissions: ['hr.payroll'] },
        { key: '/hr/payroll-config', label: <Link to="/hr/payroll-config">Cấu hình hệ số lương</Link>, permissions: ['hr.payroll_config'] },
        { key: '/hr/approvals', label: <Link to="/hr/approvals">📝 Phê duyệt đơn từ</Link>, permissions: ['hr.approvals'] },
        { key: '/hr/rewards', label: <Link to="/hr/rewards">🏆 Khen thưởng & Kỷ luật</Link>, permissions: ['hr.rewards'] },
        { key: '/hr/me', label: <Link to="/hr/me">📱 Cổng nhân viên (Mobile)</Link>, permissions: ['hr.view', 'hr.attendance'] },
      ],
    },
    {
      key: 'doi-xe-group',
      icon: <CarOutlined />,
      label: 'Đội xe',
      permissions: ['master.other.view', 'master.other.manage'],
      children: [
        {
          key: 'doi-xe-van-hanh',
          label: 'Vận hành',
          children: [
            { key: '/hr/logistics', label: <Link to="/hr/logistics">Tổng quan đội xe</Link> },
            { key: '/logistics/gps-tracking', label: <Link to="/logistics/gps-tracking">📡 Theo dõi xe GPS</Link> },
            { key: '/logistics/km-thuc-te', label: <Link to="/logistics/km-thuc-te">📊 Km thực tế GPS</Link> },
            { key: '/logistics/nhat-ky-xe', label: <Link to="/logistics/nhat-ky-xe">📋 Nhật ký xe</Link> },
            { key: '/logistics/chi-phi-chuyen', label: <Link to="/logistics/chi-phi-chuyen">💰 Chi phí chuyến</Link> },
            { key: '/logistics/doi-soat-xang', label: <Link to="/logistics/doi-soat-xang">⛽ Đối chiếu xăng dầu</Link> },
            { key: '/logistics/bao-duong-km', label: <Link to="/logistics/bao-duong-km">🔧 Bảo dưỡng theo km</Link> },
            { key: '/logistics/canh-bao-dau', label: <Link to="/logistics/canh-bao-dau">🚨 Cảnh báo hụt dầu</Link> },
          ],
        },
        {
          key: 'doi-xe-danh-muc',
          label: 'Danh mục',
          children: [
            { key: '/master/xe', label: <Link to="/master/xe">Danh mục xe</Link> },
            { key: '/master/tai-xe', label: <Link to="/master/tai-xe">Danh mục tài xế</Link> },
            { key: '/master/lo-xe', label: <Link to="/master/lo-xe">Danh mục lơ xe</Link> },
            { key: '/master/don-gia-van-chuyen', label: <Link to="/master/don-gia-van-chuyen">Đơn giá vận chuyển</Link> },
          ],
        },
      ],
    },
    {
      key: 'reporting-hub-group',
      icon: <BarChartOutlined />,
      label: 'Trung tâm Báo cáo',
      permissions: ['report.view', 'report.export', 'report.cong_no', 'report.phoi_thanh_pham'],
      children: [
        { key: '/reports/hub', label: <Link to="/reports/hub"><Space><ThunderboltOutlined />Tổng quan báo cáo</Space></Link>, permissions: ['report.view', 'report.export'] },
        {
          key: 'rpt-mgmt',
          label: 'Báo cáo Quản trị',
          permissions: ['accounting.view', 'accounting.workshop_mgmt'],
          children: [
            { key: '/accounting/reports/workshop-pnl', label: <Link to="/accounting/reports/workshop-pnl">Lãi lỗ Phân xưởng</Link>, permissions: ['accounting.view', 'accounting.workshop_mgmt'] },
            { key: '/accounting/reports/production-costing', label: <Link to="/accounting/reports/production-costing">Giá thành sản phẩm</Link>, permissions: ['accounting.view'] },
            { key: '/reports/revenue', label: <Link to="/reports/revenue">Doanh thu</Link>, permissions: ['accounting.view', 'report.schedule'] },
            { key: '/reports/production-performance', label: <Link to="/reports/production-performance">Hiệu suất SX</Link>, permissions: ['accounting.view', 'report.schedule'] },
          ]
        },
        {
          key: 'rpt-tax',
          label: 'Báo cáo Thuế',
          permissions: ['accounting.view', 'accounting.journal'],
          children: [
            { key: '/accounting/trial-balance', label: <Link to="/accounting/trial-balance">Cân đối phát sinh</Link>, permissions: ['accounting.view'] },
            { key: '/reports/tax-trial-balance', label: <Link to="/reports/tax-trial-balance">Bảng CĐPS (Thuế)</Link>, permissions: ['accounting.view'] },
            { key: '/reports/vat-summary', label: <Link to="/reports/vat-summary">Tờ khai thuế GTGT</Link>, permissions: ['accounting.view', 'accounting.journal'] },
          ]
        },
        { key: '/reports/debt-summary', label: <Link to="/reports/debt-summary">Tổng hợp công nợ</Link>, permissions: ['report.view', 'report.export', 'report.cong_no'] },
        { key: '/reports/inventory', label: <Link to="/reports/inventory">Nhập-Xuất-Tồn kho</Link>, permissions: ['report.view', 'report.export'] },
        { key: '/reports/phoi-thanh-pham', label: <Link to="/reports/phoi-thanh-pham">Tồn phôi & Thành phẩm</Link>, permissions: ['report.phoi_thanh_pham', 'report.view', 'report.export'] },
      ]
    },
    {
      key: 'danh-muc',
      icon: <TeamOutlined />,
      label: 'Danh mục',
      permissions: ['master.users.view', 'master.products.view', 'master.customers.view', 'master.suppliers.view', 'master.materials.view', 'master.other.view', 'customer.view', 'customer.create'],
      children: [
        { key: '/master/users', label: <Link to="/master/users">Tài khoản hệ thống</Link>, permissions: ['master.users.view', 'master.users.manage', 'user.view'] },
        { key: '/master/customers', label: <Link to="/master/customers">Danh mục khách hàng</Link>, permissions: ['master.customers.view', 'master.customers.manage', 'customer.view', 'customer.create'] },
        { key: '/danhmuc/phap-nhan', label: <Link to="/danhmuc/phap-nhan">Danh mục pháp nhân</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/phan-xuong', label: <Link to="/master/phan-xuong">Nơi sản xuất (Phân xưởng)</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/material-groups', label: <Link to="/master/material-groups">Danh mục nhóm nguyên liệu</Link>, permissions: ['master.materials.view', 'master.materials.manage'] },
        { key: '/master/products', label: <Link to="/master/products">Danh mục hàng hóa</Link>, permissions: ['master.products.view', 'master.products.manage', 'product.view', 'product.create'] },
        { key: '/danhmuc/cau-truc', label: <Link to="/danhmuc/cau-truc">Kết cấu thông dụng</Link>, permissions: ['master.products.view', 'master.products.manage'] },
        { key: '/master/suppliers', label: <Link to="/master/suppliers">Danh mục nhà cung cấp</Link>, permissions: ['master.suppliers.view', 'master.suppliers.manage'] },
        { key: '/master/paper-materials', label: <Link to="/master/paper-materials">Danh mục nguyên liệu giấy</Link>, permissions: ['master.materials.view', 'master.materials.manage'] },
        { key: '/master/vi-tri', label: <Link to="/master/vi-tri">Danh mục vị trí</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/other-materials', label: <Link to="/master/other-materials">Danh mục nguyên liệu khác</Link>, permissions: ['master.materials.view', 'master.materials.manage'] },
        { key: '/master/warehouses', label: <Link to="/master/warehouses">Danh mục kho</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/bank-accounts', label: <Link to="/master/bank-accounts">Tài khoản ngân hàng</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/don-vi-tinh', label: <Link to="/master/don-vi-tinh">Đơn vị tính</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/phuong-xa', label: <Link to="/master/phuong-xa">Danh mục phường xã</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/tinh-thanh', label: <Link to="/master/tinh-thanh">Danh mục tỉnh thành phố</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/indirect-costs', label: <Link to="/master/indirect-costs">Chi phí gián tiếp</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/addon-rates', label: <Link to="/master/addon-rates">Phí gia công / Tỷ lệ lãi</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/tem-paper-prices', label: <Link to="/master/tem-paper-prices">Giá giấy tem offset</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/master/offset-addon-prices', label: <Link to="/master/offset-addon-prices">Giá dịch vụ offset</Link>, permissions: ['master.other.view', 'master.other.manage'] },
        { key: '/reports/import-history', label: <Link to="/reports/import-history">Lịch sử Import</Link>, permissions: ['master.import', 'master.other.manage'] },
        { key: '/master/print-templates', label: <Link to="/master/print-templates">⚙ Cấu hình biểu mẫu in</Link>, permissions: ['master.other.manage'] },
      ],
    },
    {
      key: 'quality',
      icon: <CheckCircleOutlined />,
      label: 'Chất lượng',
      permissions: ['quality.view'],
      children: [
        { key: '/quality/qc-sheets', label: <Link to="/quality/qc-sheets">Phiếu kiểm tra QC</Link>, permissions: ['quality.view'] },
        { key: '/quality/giay-cuon', label: <Link to="/quality/giay-cuon">Giấy cuộn (QC)</Link>, permissions: ['quality.view'] },
      ],
    },
    {
      key: 'maintenance',
      icon: <ToolOutlined />,
      label: 'Bảo trì máy',
      permissions: ['maintenance.view'],
      children: [
        { key: '/maintenance/schedules', label: <Link to="/maintenance/schedules">Lịch bảo trì</Link>, permissions: ['maintenance.view'] },
        { key: '/maintenance/logs', label: <Link to="/maintenance/logs">Nhật ký bảo trì</Link>, permissions: ['maintenance.view'] },
      ],
    },
    {
      key: '/agent',
      icon: <RobotOutlined />,
      label: <Link to="/agent">Trợ lý AI</Link>,
    },
  ]
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, setAuth } = useAuthStore()
  const { token: tk } = theme.useToken()

  const handleSwitchRole = async (u: string, p: string) => {
    try {
      const res = await authApi.login(u, p)
      setAuth(res.data.access_token, res.data.refresh_token, res.data.user)
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Lỗi chuyển role:', (err as ApiError)?.response?.data || err)
      message.error('Không thể chuyển đổi tài khoản test. Bạn hãy kiểm tra lại username/password trong AppLayout.tsx có đúng với DB chưa.')
    }
  }

  const roleTestMenu: MenuProps = {
    items: [
      { key: 'admin_group', type: 'group', label: 'Hệ thống & BGD', children: [
        { key: 'ADMIN', label: 'Administrator', onClick: () => handleSwitchRole('ADMIN', '123456') },
        { key: 'BGD_GIAM_DOC', label: 'Giám đốc - Ban Giám Đốc', onClick: () => handleSwitchRole('BGD_GIAM_DOC', '123456') },
        { key: 'BGD_TO_TRUONG', label: 'Tổ trưởng - Ban Giám Đốc', onClick: () => handleSwitchRole('BGD_TO_TRUONG', '123456') },
        { key: 'BGD_NHAN_VIEN', label: 'Nhân viên - Ban Giám Đốc', onClick: () => handleSwitchRole('BGD_NHAN_VIEN', '123456') },
      ]},
      { key: 'sales_group', type: 'group', label: 'Kinh Doanh & Sale Admin', children: [
        { key: 'KINH_DOANH_TO_TRUONG', label: 'Tổ trưởng - Phòng Kinh Doanh', onClick: () => handleSwitchRole('KINH_DOANH_TO_TRUONG', '123456') },
        { key: 'KINH_DOANH_NHAN_VIEN', label: 'Nhân viên - Phòng Kinh Doanh', onClick: () => handleSwitchRole('KINH_DOANH_NHAN_VIEN', '123456') },
        { key: 'TRUONG_PHONG_SALE_ADMIN', label: 'Trưởng phòng Sale Admin', onClick: () => handleSwitchRole('TRUONG_PHONG_SALE_ADMIN', '123456') },
        { key: 'SALE_ADMIN_TO_TRUONG', label: 'Tổ trưởng - Sale Admin', onClick: () => handleSwitchRole('SALE_ADMIN_TO_TRUONG', '123456') },
        { key: 'SALE_ADMIN_NHAN_VIEN', label: 'Nhân viên - Sale Admin', onClick: () => handleSwitchRole('SALE_ADMIN_NHAN_VIEN', '123456') },
        { key: 'SALE_ADMIN', label: 'Sale Admin', onClick: () => handleSwitchRole('SALE_ADMIN', '123456') },
      ]},
      { key: 'ketoan_group', type: 'group', label: 'Kế Toán', children: [
        { key: 'KE_TOAN_TRUONG', label: 'Kế toán trưởng', onClick: () => handleSwitchRole('KE_TOAN_TRUONG', '123456') },
        { key: 'KETOAN_TO_TRUONG', label: 'Tổ trưởng - Phòng Kế Toán', onClick: () => handleSwitchRole('KETOAN_TO_TRUONG', '123456') },
        { key: 'KE_TOAN_CONG_NO', label: 'Kế toán công nợ', onClick: () => handleSwitchRole('KE_TOAN_CONG_NO', '123456') },
        { key: 'KETOAN_NHAN_VIEN', label: 'Nhân viên - Phòng Kế Toán', onClick: () => handleSwitchRole('KETOAN_NHAN_VIEN', '123456') },
      ]},
      { key: 'sanxuat_group', type: 'group', label: 'Sản Xuất & Kho', children: [
        { key: 'SAN_XUAT_GIAM_SAT', label: 'Giám sát - Khối Sản Xuất', onClick: () => handleSwitchRole('SAN_XUAT_GIAM_SAT', '123456') },
        { key: 'SAN_XUAT_TO_TRUONG', label: 'Tổ trưởng - Khối Sản Xuất', onClick: () => handleSwitchRole('SAN_XUAT_TO_TRUONG', '123456') },
        { key: 'SAN_XUAT_THO', label: 'Thợ - Khối Sản Xuất', onClick: () => handleSwitchRole('SAN_XUAT_THO', '123456') },
        { key: 'KHO_TO_TRUONG', label: 'Tổ trưởng - Kho', onClick: () => handleSwitchRole('KHO_TO_TRUONG', '123456') },
        { key: 'KHO_NHAN_VIEN', label: 'Nhân viên - Kho', onClick: () => handleSwitchRole('KHO_NHAN_VIEN', '123456') },
      ]},
      { key: 'other_group', type: 'group', label: 'Nhân Sự & Thiết Kế', children: [
        { key: 'NHAN_SU_TO_TRUONG', label: 'Tổ trưởng - Phòng Nhân Sự', onClick: () => handleSwitchRole('NHAN_SU_TO_TRUONG', '123456') },
        { key: 'NHAN_SU_NHAN_VIEN', label: 'Nhân viên - Phòng Nhân Sự', onClick: () => handleSwitchRole('NHAN_SU_NHAN_VIEN', '123456') },
        { key: 'THIET_KE_TO_TRUONG', label: 'Tổ trưởng - Phòng Thiết Kế', onClick: () => handleSwitchRole('THIET_KE_TO_TRUONG', '123456') },
        { key: 'THIET_KE_NHAN_VIEN', label: 'Nhân viên - Phòng Thiết Kế', onClick: () => handleSwitchRole('THIET_KE_NHAN_VIEN', '123456') },
      ]}
    ]
  }

  const { data: queueLines = [] } = useQuery({
    queryKey: ['production-queue', 'cho'],
    queryFn: () => productionPlansApi.getQueue('cho').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const queueCount = queueLines.length

  const role = user?.role ?? 'ADMIN'
  const userPermissions = user?.permissions || []
  const menuItems = filterByRole(buildMenuItems(queueCount), role, userPermissions)

  const selectedKeys = [location.pathname + location.search]

  function collectOpenKeys(items: RawMenuItem[], path: string): string[] {
    const keys: string[] = []
    for (const item of items) {
      if (item.children) {
        const childMatch = item.children.some(
          c => c.key === path || (c.children && c.children.some(g => g.key === path))
        )
        if (childMatch) keys.push(item.key)
        keys.push(...collectOpenKeys(item.children, path))
      }
    }
    return keys
  }
  const openKeys = collectOpenKeys(buildMenuItems(0), location.pathname)

  const userMenu = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Thông tin tài khoản',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Đổi mật khẩu',
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
    },
  ]

  const handleUserMenu = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout()
      navigate('/login')
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={248}
        style={{ background: '#1b168e', borderRight: '1px solid #15116f' }}
      >
        <div style={{
          height: collapsed ? 72 : 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
          borderTop: '4px solid #ff8200',
          padding: collapsed ? '10px 8px' : '10px 20px',
        }}>
          <img
            src={namPhuongLogo}
            alt="Nam Phuong"
            className="np-brand-logo"
            style={{
              maxWidth: collapsed ? 42 : 188,
              maxHeight: collapsed ? 42 : 74,
            }}
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems as import('antd/es/menu/interface').ItemType[]}
          theme="dark"
          style={{ border: 'none', marginTop: 8, padding: '0 6px', background: '#1b168e' }}
        />
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 20px',
          background: tk.colorBgContainer,
          borderBottom: `1px solid ${tk.colorBorderSecondary}`,
          boxShadow: '0 2px 10px rgba(27, 22, 142, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Space>
            {collapsed
              ? <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer' }} />
              : <MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ fontSize: 18, cursor: 'pointer' }} />
            }
            <Text strong style={{ fontSize: 18, color: '#1b168e', marginLeft: 8 }}>
              Hệ thống Quản trị ERP Nam Phương
            </Text>
          </Space>

          <Space size={20}>
            <Dropdown menu={roleTestMenu}>
              <Button type="dashed" icon={<ThunderboltOutlined />} danger>
                🧪 Đổi Role Test
              </Button>
            </Dropdown>

            <Dropdown menu={{ items: userMenu, onClick: handleUserMenu }}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ background: '#ff8200' }} icon={<UserOutlined />} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                  <Text strong>{user?.ho_ten}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{user?.role}</Text>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 16, background: tk.colorBgLayout, overflow: 'initial' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
