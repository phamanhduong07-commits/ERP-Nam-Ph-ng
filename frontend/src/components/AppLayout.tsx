import { useEffect, useState } from 'react'
import type { ApiError } from '../api/types'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Layout, Avatar, Dropdown, Typography, Space, theme, Badge, Button, message,
  Modal, Form, Input,
} from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined,
  TeamOutlined, UserOutlined, LogoutOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ToolOutlined,
  AccountBookOutlined, RobotOutlined, BarChartOutlined, ShopOutlined,
  ThunderboltOutlined, FileTextOutlined, CarOutlined,
  CheckCircleOutlined, FileProtectOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { authApi } from '../api/auth'
import { productionPlansApi } from '../api/productionPlans'
import CustomSidebarNav, { type NavItem, type FlyoutSection, type SubItem } from './CustomSidebarNav'
import GlobalSearchModal from './GlobalSearchModal'
const namPhuongLogo = '/logo_namphuong.png'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// ─── Phân quyền menu ──────────────────────────────────────────────────────────
function canSee(permissions: string[] | undefined, role: string, userPerms: string[]): boolean {
  if (role === 'ADMIN' || role === 'admin') return true
  if (!permissions || permissions.length === 0) return true
  return permissions.some(p => userPerms.includes(p))
}

function buildNavItems(queueCount: number): NavItem[] {
  return [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Tổng quan',
      to: '/dashboard',
    },
    {
      key: 'ban-hang',
      icon: <ShoppingCartOutlined />,
      label: 'Bán hàng',
      permissions: ['sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve'],
      flyoutSections: [
        {
          items: [
            { key: '/quotes', to: '/quotes', label: <Link to="/quotes">Báo giá</Link>, permissions: ['sales_order.approve'] },
            { key: '/sales/orders', to: '/sales/orders', label: <Link to="/sales/orders">Đơn hàng</Link> },
            { key: '/sales/returns', to: '/sales/returns', label: <Link to="/sales/returns">Trả hàng bán</Link> },
            { key: '/sales/theo-don-hang', to: '/sales/theo-don-hang', label: <Link to="/sales/theo-don-hang">Theo dõi đơn hàng</Link> },
            { key: '/sales/giao-hang', to: '/sales/giao-hang', label: <Link to="/sales/giao-hang">🚚 Giao hàng</Link> },
            { key: '/billing/invoices', to: '/billing/invoices', label: <Link to="/billing/invoices">Hóa đơn VAT</Link> },
          ],
        },
      ],
    },
    {
      key: 'san-xuat',
      icon: <ShopOutlined />,
      label: 'Sản xuất',
      hubTo: '/production/hub',
      permissions: ['production_order.view', 'production_order.create', 'production_order.edit', 'cd2.view'],
      flyoutSections: [
        {
          items: [
            { key: '/production/orders', to: '/production/orders', label: <Link to="/production/orders">Lệnh sản xuất</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/theo-doi', to: '/production/theo-doi', label: <Link to="/production/theo-doi">Theo dõi LSX</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/plans', to: '/production/plans', label: <Link to="/production/plans">Kế hoạch sản xuất</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/tan-dung', to: '/production/tan-dung', label: <Link to="/production/tan-dung">Kế hoạch tận dụng</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            {
              key: '/production/queue',
              to: '/production/queue',
              permissions: ['production_order.view', 'production_order.create', 'production_order.edit'],
              label: (
                <Link to="/production/queue">
                  <Space>
                    <span>KH SX chờ</span>
                    {queueCount > 0 && <Badge count={queueCount} size="small" style={{ marginLeft: 4 }} />}
                  </Space>
                </Link>
              ),
            },
            { key: '/production/bom', to: '/production/bom', label: <Link to="/production/bom">Định mức (BOM)</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cost-analysis', to: '/production/cost-analysis', label: <Link to="/production/cost-analysis">Phân tích chi phí</Link>, permissions: ['production.cost_analysis'] },
            { key: '/production/may-song', to: '/production/may-song', label: <Link to="/production/may-song">🌊 Máy Sóng</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
          ],
        },
        {
          sectionLabel: 'Công đoạn 2 (CD2)',
          items: [
            { key: '/production/cd2/dashboard', to: '/production/cd2/dashboard', label: <Link to="/production/cd2/dashboard">📈 Dashboard</Link>, permissions: ['cd2.view', 'production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2', to: '/production/cd2', label: <Link to="/production/cd2">🗂 Kanban máy in</Link>, permissions: ['cd2.view', 'production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/sauin-kanban', to: '/production/cd2/sauin-kanban', label: <Link to="/production/cd2/sauin-kanban">🏭 Kanban TP</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/may-in', to: '/production/cd2/may-in', label: <Link to="/production/cd2/may-in">📋 Queue máy in</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/history', to: '/production/cd2/history', label: <Link to="/production/cd2/history">📊 Thống kê sản lượng</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/worker', to: '/production/cd2/worker', label: <Link to="/production/cd2/worker">👷 Máy in của tôi</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/cd2/machine-login', to: '/cd2/machine-login', label: <Link to="/cd2/machine-login">🔑 Đăng nhập máy</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/scan', to: '/production/cd2/scan', label: <Link to="/production/cd2/scan">📊 Scan sản lượng</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/mobile-tracking', to: '/production/cd2/mobile-tracking', label: <Link to="/production/cd2/mobile-tracking">📱 Mobile (kiosk)</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/shift', to: '/production/cd2/shift', label: <Link to="/production/cd2/shift">⏰ Quản lý ca</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
            { key: '/production/cd2/config', to: '/production/cd2/config', label: <Link to="/production/cd2/config">⚙ Cấu hình CD2</Link>, permissions: ['production_order.view', 'production_order.create', 'production_order.edit'] },
          ],
        },
      ],
    },
    {
      key: 'kho',
      icon: <FileTextOutlined />,
      label: 'Kho',
      hubTo: '/warehouse/hub',
      permissions: ['inventory.view', 'inventory.import', 'inventory.export', 'inventory.transfer', 'inventory.adjust', 'inventory.phoi_tp'],
      flyoutSections: [
        {
          items: [
            { key: '/warehouse/theo-xuong', to: '/warehouse/theo-xuong', label: <Link to="/warehouse/theo-xuong">Kho theo xưởng</Link>, permissions: ['inventory.view', 'inventory.import'] },
            { key: '/production/kho-phoi', to: '/production/kho-phoi', label: <Link to="/production/kho-phoi">Kho phôi sóng</Link>, permissions: ['inventory.view', 'inventory.phoi_tp'] },
            { key: '/production/kho-thanh-pham', to: '/production/kho-thanh-pham', label: <Link to="/production/kho-thanh-pham">Kho thành phẩm</Link>, permissions: ['inventory.view', 'inventory.phoi_tp'] },
            { key: '/production/kho-loi', to: '/production/kho-loi', label: <Link to="/production/kho-loi">⚠️ Kho hàng lỗi/trả về</Link>, permissions: ['inventory.view', 'inventory.phoi_tp'] },
            { key: '/production/phieu-nhap-phoi', to: '/production/phieu-nhap-phoi', label: <Link to="/production/phieu-nhap-phoi">DS nhập phôi sóng</Link>, permissions: ['inventory.view', 'inventory.import'] },
            { key: '/warehouse/inventory', to: '/warehouse/inventory', label: <Link to="/warehouse/inventory">Tồn kho</Link>, permissions: ['inventory.view', 'inventory.import'] },
            { key: '/warehouse/nhap-nhanh', to: '/warehouse/nhap-nhanh', label: <Link to="/warehouse/nhap-nhanh">📷 Ghi nhận xe nhập giấy</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/nhap-nhanh?loai=nvl', to: '/warehouse/nhap-nhanh?loai=nvl', label: <Link to="/warehouse/nhap-nhanh?loai=nvl">📷 Ghi nhận xe nhập NVL</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/nhap-nhanh?loai=phoi', to: '/warehouse/nhap-nhanh?loai=phoi', label: <Link to="/warehouse/nhap-nhanh?loai=phoi">📷 Ghi nhận xe nhập phôi</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/nhap-giay', to: '/warehouse/nhap-giay', label: <Link to="/warehouse/nhap-giay">Nhập giấy cuộn</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/can-cuon-giay', to: '/warehouse/can-cuon-giay', label: <Link to="/warehouse/can-cuon-giay">Cân giấy cuộn</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/nhap-phoi-ngoai', to: '/warehouse/nhap-phoi-ngoai', label: <Link to="/warehouse/nhap-phoi-ngoai">Nhập phôi sóng (mua ngoài)</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/receipts', to: '/warehouse/receipts', label: <Link to="/warehouse/receipts">Nhập NVL khác</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/issues', to: '/warehouse/issues', label: <Link to="/warehouse/issues">Xuất NVL sản xuất</Link>, permissions: ['inventory.export'] },
            { key: '/warehouse/production-output', to: '/warehouse/production-output', label: <Link to="/warehouse/production-output">Nhập TP từ SX</Link>, permissions: ['inventory.import'] },
            { key: '/warehouse/transfers', to: '/warehouse/transfers', label: <Link to="/warehouse/transfers">Chuyển kho</Link>, permissions: ['inventory.transfer'] },
            { key: '/warehouse/stock-adjustments', to: '/warehouse/stock-adjustments', label: <Link to="/warehouse/stock-adjustments">Kiểm kê / điều chỉnh</Link>, permissions: ['inventory.adjust'] },
            { key: '/warehouse/the-kho', to: '/warehouse/the-kho', label: <Link to="/warehouse/the-kho">Sổ chi tiết / Thẻ kho</Link>, permissions: ['inventory.view', 'inventory.import'] },
          ],
        },
      ],
    },
    {
      key: 'mua-hang',
      icon: <ShopOutlined />,
      label: 'Mua hàng',
      hubTo: '/purchasing/hub',
      permissions: ['purchase.view', 'purchase.orders', 'purchase.goods_receipts', 'purchase.import', 'inventory.import'],
      flyoutSections: [
        {
          items: [
            { key: '/purchasing/du-bao-nhu-cau', to: '/purchasing/du-bao-nhu-cau', label: <Link to="/purchasing/du-bao-nhu-cau">Dự báo nhu cầu</Link> },
            { key: '/purchasing/ymh', to: '/purchasing/ymh', label: <Link to="/purchasing/ymh">Yêu cầu mua hàng (YMH)</Link> },
            { key: '/purchasing/giay-cuon', to: '/purchasing/giay-cuon', label: <Link to="/purchasing/giay-cuon">Mua giấy</Link> },
            { key: '/purchasing/nvl-khac', to: '/purchasing/nvl-khac', label: <Link to="/purchasing/nvl-khac">Mua NVL khác</Link> },
            { key: '/purchasing/orders', to: '/purchasing/orders', label: <Link to="/purchasing/orders">Đơn mua hàng (PO)</Link> },
            { key: '/purchasing/goods-receipts', to: '/purchasing/goods-receipts', label: <Link to="/purchasing/goods-receipts">Phiếu nhập kho (GR)</Link> },
            { key: '/purchasing/dashboard', to: '/purchasing/dashboard', label: <Link to="/purchasing/dashboard">Dashboard mua hàng</Link> },
            { key: '/purchasing/doi-soat-kho', to: '/purchasing/doi-soat-kho', label: <Link to="/purchasing/doi-soat-kho">Đối soát kho (PO vs GR)</Link> },
            { key: '/accounting/purchase-invoices', to: '/accounting/purchase-invoices', label: <Link to="/accounting/purchase-invoices">Hóa đơn mua hàng</Link> },
            { key: '/purchasing/returns', to: '/purchasing/returns', label: <Link to="/purchasing/returns">Trả hàng NCC</Link> },
            { key: '/purchasing/reports', to: '/purchasing/reports', label: <Link to="/purchasing/reports">Báo cáo mua hàng</Link> },
          ],
        },
      ],
    },
    {
      key: 'ke-toan-tai-chinh',
      icon: <AccountBookOutlined />,
      label: 'Kế toán - Tài chính',
      hubTo: '/accounting/hub',
      permissions: ['accounting.import', 'accounting.view', 'accounting.payments', 'accounting.receipts', 'accounting.ap_ledger', 'accounting.ar_ledger'],
      flyoutSections: [
        {
          sectionLabel: 'Quỹ & Ngân hàng',
          items: [
            { key: '/accounting/receipts', to: '/accounting/receipts', label: <Link to="/accounting/receipts">Phiếu thu</Link>, permissions: ['accounting.receipts'] },
            { key: '/accounting/payments', to: '/accounting/payments', label: <Link to="/accounting/payments">Phiếu chi</Link>, permissions: ['accounting.payments'] },
            { key: '/accounting/cash-book', to: '/accounting/cash-book', label: <Link to="/accounting/cash-book">Sổ quỹ tiền mặt</Link>, permissions: ['accounting.cash_book'] },
            { key: '/accounting/bank-ledger', to: '/accounting/bank-ledger', label: <Link to="/accounting/bank-ledger">Sổ tiền gửi NH</Link>, permissions: ['accounting.bank_ledger'] },
            { key: '/accounting/bank-reconciliation', to: '/accounting/bank-reconciliation', label: <Link to="/accounting/bank-reconciliation">Đối soát ngân hàng</Link>, permissions: ['accounting.bank_ledger'] },
          ],
        },
        {
          sectionLabel: 'Công nợ',
          items: [
            { key: '/accounting/ar-ledger', to: '/accounting/ar-ledger', label: <Link to="/accounting/ar-ledger">Sổ công nợ phải thu</Link>, permissions: ['accounting.ar_ledger'] },
            { key: '/accounting/ap-ledger', to: '/accounting/ap-ledger', label: <Link to="/accounting/ap-ledger">Sổ công nợ phải trả</Link>, permissions: ['accounting.ap_ledger'] },
            { key: '/accounting/ar-reconciliation', to: '/accounting/ar-reconciliation', label: <Link to="/accounting/ar-reconciliation">Đối soát công nợ</Link>, permissions: ['accounting.ar_ledger'] },
            { key: '/accounting/ap-reconciliation', to: '/accounting/ap-reconciliation', label: <Link to="/accounting/ap-reconciliation">Đối chiếu công nợ NCC</Link>, permissions: ['accounting.ap_ledger'] },
            { key: '/accounting/customer-refunds', to: '/accounting/customer-refunds', label: <Link to="/accounting/customer-refunds">Hoàn tiền trả hàng</Link>, permissions: ['accounting.manage'] },
            { key: '/billing/adjustments', to: '/billing/adjustments', label: <Link to="/billing/adjustments">Duyệt điều chỉnh HĐ</Link>, permissions: ['accounting.manage'] },
          ],
        },
        {
          sectionLabel: 'Sổ sách & Kế toán',
          items: [
            { key: '/accounting/journal-entries', to: '/accounting/journal-entries', label: <Link to="/accounting/journal-entries">Bút toán tổng hợp</Link>, permissions: ['accounting.journal'] },
            { key: '/accounting/general-ledger', to: '/accounting/general-ledger', label: <Link to="/accounting/general-ledger">Sổ cái tài khoản</Link>, permissions: ['accounting.general_ledger'] },
            { key: '/accounting/audit-logs', to: '/accounting/audit-logs', label: <Link to="/accounting/audit-logs">Nhật ký audit kế toán</Link>, permissions: ['accounting.import', 'accounting.manage'] },
            { key: '/accounting/hoa-don-dien-tu', to: '/accounting/hoa-don-dien-tu', label: <Link to="/accounting/hoa-don-dien-tu">Hóa đơn điện tử</Link>, permissions: ['accounting.hoa_don_dien_tu', 'accounting.manage'] },
            { key: '/accounting/purchase-invoices', to: '/accounting/purchase-invoices', label: <Link to="/accounting/purchase-invoices">Hóa đơn mua hàng</Link>, permissions: ['accounting.manage'] },
            { key: '/accounting/workshop-management', to: '/accounting/workshop-management', label: <Link to="/accounting/workshop-management">Quản trị xưởng (Lương)</Link>, permissions: ['accounting.workshop_mgmt'] },
            { key: '/accounting/ccdc', to: '/accounting/ccdc', label: <Link to="/accounting/ccdc">Tài sản & CCDC</Link>, permissions: ['accounting.ccdc'] },
            { key: '/fixed-assets', to: '/fixed-assets', label: <Link to="/fixed-assets">Tài sản cố định</Link>, permissions: ['accounting.ccdc', 'accounting.manage'] },
            { key: '/accounting/reports/production-costing', to: '/accounting/reports/production-costing', label: <Link to="/accounting/reports/production-costing">Giá thành sản phẩm</Link>, permissions: ['accounting.manage', 'report.phoi_thanh_pham'] },
          ],
        },
        {
          sectionLabel: 'Báo cáo tài chính',
          items: [
            { key: '/accounting/profit-loss', to: '/accounting/profit-loss', label: <Link to="/accounting/profit-loss">Báo cáo lãi/lỗ</Link>, permissions: ['accounting.view'] },
            { key: '/accounting/balance-sheet', to: '/accounting/balance-sheet', label: <Link to="/accounting/balance-sheet">Bảng cân đối kế toán</Link>, permissions: ['accounting.view'] },
          ],
        },
        {
          sectionLabel: 'Quản lý kỳ kế toán',
          items: [
            { key: '/accounting/period-closing', to: '/accounting/period-closing', label: <Link to="/accounting/period-closing">Khóa sổ kỳ kế toán</Link>, permissions: ['accounting.manage'] },
            { key: '/accounting/opening-balances', to: '/accounting/opening-balances', label: <Link to="/accounting/opening-balances">Số dư đầu kỳ</Link>, permissions: ['accounting.import'] },
          ],
        },
      ],
    },
    {
      key: 'hrm-group',
      icon: <TeamOutlined />,
      label: 'Nhân sự (HRM)',
      hubTo: '/hr/dashboard',
      permissions: ['hr.view', 'hr.manage', 'hr.employees', 'hr.attendance', 'hr.payroll', 'hr.payroll_config', 'hr.approvals', 'hr.departments', 'hr.rewards', 'user.view', 'user.create', 'user.edit', 'permission.view', 'permission.manage', 'team.manage_permissions'],
      flyoutSections: [
        {
          items: [
            { key: '/hr/dashboard', to: '/hr/dashboard', label: <Link to="/hr/dashboard">📊 Dashboard HR</Link> },
            { key: '/hr/employees', to: '/hr/employees', label: <Link to="/hr/employees">Hồ sơ nhân viên</Link>, permissions: ['hr.view', 'hr.employees'] },
            { key: '/hr/departments', to: '/hr/departments', label: <Link to="/hr/departments">Cơ cấu tổ chức</Link>, permissions: ['hr.departments'] },
            { key: '/hr/permission-matrix', to: '/hr/permission-matrix', label: <Link to="/hr/permission-matrix">Ma trận phân quyền</Link>, permissions: ['permission.view', 'permission.manage'] },
            { key: '/hr/team-permissions', to: '/hr/team-permissions', label: <Link to="/hr/team-permissions">🔑 Quyền cá nhân (Team)</Link>, permissions: ['team.manage_permissions'] },
            { key: '/hr/attendance', to: '/hr/attendance', label: <Link to="/hr/attendance">Chấm công & Đơn từ</Link>, permissions: ['hr.attendance'] },
            { key: '/hr/checkin-locations', to: '/hr/checkin-locations', label: <Link to="/hr/checkin-locations">📍 Địa điểm chấm công</Link>, permissions: ['hr.attendance'] },
            { key: '/hr/approvals', to: '/hr/approvals', label: <Link to="/hr/approvals">📝 Phê duyệt đơn từ</Link>, permissions: ['hr.approvals'] },
            { key: '/hr/production-output', to: '/hr/production-output', label: <Link to="/hr/production-output">📦 Sản lượng tháng</Link>, permissions: ['hr.payroll'] },
            { key: '/hr/payroll-adjustments', to: '/hr/payroll-adjustments', label: <Link to="/hr/payroll-adjustments">💰 Phụ cấp & Khấu trừ</Link>, permissions: ['hr.payroll'] },
            { key: '/hr/payroll-runs', to: '/hr/payroll-runs', label: <Link to="/hr/payroll-runs">💵 Bảng lương tháng</Link>, permissions: ['hr.payroll'] },
            { key: '/hr/payroll-complaints', to: '/hr/payroll-complaints', label: <Link to="/hr/payroll-complaints">⚠️ Khiếu nại lương</Link>, permissions: ['hr.payroll'] },
            { key: '/hr/payroll-config', to: '/hr/payroll-config', label: <Link to="/hr/payroll-config">⚙️ Cấu hình lương</Link>, permissions: ['hr.payroll_config'] },
            { key: '/hr/rewards', to: '/hr/rewards', label: <Link to="/hr/rewards">🏆 Khen thưởng & Kỷ luật</Link>, permissions: ['hr.rewards'] },
            { key: '/hr/benefits', to: '/hr/benefits', label: <Link to="/hr/benefits">🎁 Phúc lợi nhân viên</Link>, permissions: ['hr.view'] },
            { key: '/hr/health-checks', to: '/hr/health-checks', label: <Link to="/hr/health-checks">🏥 Khám sức khỏe</Link>, permissions: ['hr.view'] },
            { key: '/hr/safety', to: '/hr/safety', label: <Link to="/hr/safety">🛡️ An toàn lao động</Link>, permissions: ['hr.view'] },
            { key: '/hr/kpi', to: '/hr/kpi', label: <Link to="/hr/kpi">🎯 KPI / Đánh giá</Link>, permissions: ['hr.view'] },
            { key: '/hr/reports', to: '/hr/reports', label: <Link to="/hr/reports">📑 Báo cáo HR</Link>, permissions: ['hr.view'] },
            { key: '/hr/me', to: '/hr/me', label: <Link to="/hr/me">📱 Cổng nhân viên (Mobile)</Link>, permissions: ['hr.view', 'hr.attendance'] },
          ],
        },
      ],
    },
    {
      key: 'doi-xe-group',
      icon: <CarOutlined />,
      label: 'Đội xe',
      permissions: ['master.other.view', 'master.other.manage'],
      flyoutSections: [
        {
          sectionLabel: 'Vận hành',
          items: [
            { key: '/hr/logistics', to: '/hr/logistics', label: <Link to="/hr/logistics">Tổng quan đội xe</Link> },
            { key: '/logistics/gps-tracking', to: '/logistics/gps-tracking', label: <Link to="/logistics/gps-tracking">📡 Theo dõi xe GPS</Link> },
            { key: '/logistics/km-thuc-te', to: '/logistics/km-thuc-te', label: <Link to="/logistics/km-thuc-te">📊 Km thực tế GPS</Link> },
            { key: '/logistics/nhat-ky-xe', to: '/logistics/nhat-ky-xe', label: <Link to="/logistics/nhat-ky-xe">📋 Nhật ký xe</Link> },
            { key: '/logistics/chi-phi-chuyen', to: '/logistics/chi-phi-chuyen', label: <Link to="/logistics/chi-phi-chuyen">💰 Chi phí chuyến</Link> },
            { key: '/logistics/doi-soat-xang', to: '/logistics/doi-soat-xang', label: <Link to="/logistics/doi-soat-xang">⛽ Đối chiếu xăng dầu</Link> },
            { key: '/logistics/bao-duong-km', to: '/logistics/bao-duong-km', label: <Link to="/logistics/bao-duong-km">🔧 Bảo dưỡng theo km</Link> },
            { key: '/logistics/canh-bao-dau', to: '/logistics/canh-bao-dau', label: <Link to="/logistics/canh-bao-dau">🚨 Cảnh báo hụt dầu</Link> },
          ],
        },
        {
          sectionLabel: 'Danh mục',
          items: [
            { key: '/master/xe', to: '/master/xe', label: <Link to="/master/xe">Danh mục xe</Link> },
            { key: '/master/tai-xe', to: '/master/tai-xe', label: <Link to="/master/tai-xe">Danh mục tài xế</Link> },
            { key: '/master/lo-xe', to: '/master/lo-xe', label: <Link to="/master/lo-xe">Danh mục lơ xe</Link> },
            { key: '/master/don-gia-van-chuyen', to: '/master/don-gia-van-chuyen', label: <Link to="/master/don-gia-van-chuyen">Đơn giá vận chuyển</Link> },
          ],
        },
      ],
    },
    {
      key: 'reporting-hub-group',
      icon: <BarChartOutlined />,
      label: 'Trung tâm Báo cáo',
      hubTo: '/reports/hub',
      permissions: ['report.view', 'report.export', 'report.cong_no', 'report.phoi_thanh_pham'],
      flyoutSections: [
        {
          sectionLabel: 'Tổng hợp Group',
          items: [
            { key: '/reports/cashflow-daily', to: '/reports/cashflow-daily', label: <Link to="/reports/cashflow-daily">Dòng tiền Group (Ngày)</Link>, permissions: ['report.export'] },
            { key: '/reports/group-pnl', to: '/reports/group-pnl', label: <Link to="/reports/group-pnl">P&L Group (3 PN)</Link>, permissions: ['report.export'] },
            { key: '/reports/sales-group', to: '/reports/sales-group', label: <Link to="/reports/sales-group">Doanh số Group (Xưởng)</Link>, permissions: ['report.export'] },
            { key: '/reports/group-debt', to: '/reports/group-debt', label: <Link to="/reports/group-debt">Công nợ Group</Link>, permissions: ['report.cong_no'] },
            { key: '/reports/sales-nvkd', to: '/reports/sales-nvkd', label: <Link to="/reports/sales-nvkd">Doanh số NV KD</Link>, permissions: ['report.export'] },
          ],
        },
        {
          sectionLabel: 'Báo cáo Quản trị',
          items: [
            { key: '/accounting/reports/workshop-pnl', to: '/accounting/reports/workshop-pnl', label: <Link to="/accounting/reports/workshop-pnl">Lãi lỗ Phân xưởng</Link>, permissions: ['report.export'] },
            { key: '/accounting/reports/production-costing', to: '/accounting/reports/production-costing', label: <Link to="/accounting/reports/production-costing">Giá thành sản phẩm</Link>, permissions: ['report.export'] },
            { key: '/reports/revenue', to: '/reports/revenue', label: <Link to="/reports/revenue">Doanh thu</Link>, permissions: ['report.export'] },
            { key: '/reports/production-performance', to: '/reports/production-performance', label: <Link to="/reports/production-performance">Hiệu suất SX</Link>, permissions: ['report.view'] },
          ],
        },
        {
          sectionLabel: 'Báo cáo Thuế',
          items: [
            { key: '/accounting/trial-balance', to: '/accounting/trial-balance', label: <Link to="/accounting/trial-balance">Cân đối phát sinh</Link>, permissions: ['accounting.view'] },
            { key: '/reports/tax-trial-balance', to: '/reports/tax-trial-balance', label: <Link to="/reports/tax-trial-balance">Bảng CĐPS (Thuế)</Link>, permissions: ['accounting.view'] },
            { key: '/reports/vat-summary', to: '/reports/vat-summary', label: <Link to="/reports/vat-summary">Tờ khai thuế GTGT</Link>, permissions: ['accounting.view'] },
          ],
        },
        {
          sectionLabel: 'Kho & Công nợ',
          items: [
            { key: '/reports/inventory', to: '/reports/inventory', label: <Link to="/reports/inventory">Nhập-Xuất-Tồn kho</Link>, permissions: ['report.inventory'] },
            { key: '/reports/phoi-thanh-pham', to: '/reports/phoi-thanh-pham', label: <Link to="/reports/phoi-thanh-pham">Tồn phôi & Thành phẩm</Link>, permissions: ['report.phoi_thanh_pham'] },
            { key: '/reports/debt-summary', to: '/reports/debt-summary', label: <Link to="/reports/debt-summary">Tổng hợp công nợ</Link>, permissions: ['report.cong_no'] },
          ],
        },
      ],
    },
    {
      key: '/danhmuc',
      icon: <TeamOutlined />,
      label: 'Danh mục',
      to: '/danhmuc',
      permissions: ['master.users.view', 'master.products.view', 'master.customers.view', 'master.suppliers.view', 'master.materials.view', 'master.other.view', 'customer.view', 'customer.create'],
    },
    {
      key: 'quality',
      icon: <CheckCircleOutlined />,
      label: 'Chất lượng',
      permissions: ['quality.view'],
      flyoutSections: [
        {
          items: [
            { key: '/quality/qc-sheets', to: '/quality/qc-sheets', label: <Link to="/quality/qc-sheets">Phiếu kiểm tra QC</Link>, permissions: ['quality.view'] },
            { key: '/quality/giay-cuon', to: '/quality/giay-cuon', label: <Link to="/quality/giay-cuon">Giấy cuộn (QC)</Link>, permissions: ['quality.view'] },
          ],
        },
      ],
    },
    {
      key: 'maintenance',
      icon: <ToolOutlined />,
      label: 'Bảo trì máy',
      permissions: ['maintenance.view'],
      flyoutSections: [
        {
          items: [
            { key: '/maintenance/schedules', to: '/maintenance/schedules', label: <Link to="/maintenance/schedules">Lịch bảo trì</Link>, permissions: ['maintenance.view'] },
            { key: '/maintenance/logs', to: '/maintenance/logs', label: <Link to="/maintenance/logs">Nhật ký bảo trì</Link>, permissions: ['maintenance.view'] },
          ],
        },
      ],
    },
    {
      key: '/agent',
      icon: <RobotOutlined />,
      label: 'Trợ lý AI',
      to: '/agent',
    },
  ]
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [changePwdLoading, setChangePwdLoading] = useState(false)
  const [changePwdForm] = Form.useForm()
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

  const roleTestMenu = {
    items: [
      { key: 'admin_group', type: 'group' as const, label: 'Hệ thống & BGD', children: [
        { key: 'ADMIN', label: 'Administrator', onClick: () => handleSwitchRole('ADMIN', '123456') },
        { key: 'BGD_GIAM_DOC', label: 'Giám đốc - Ban Giám Đốc', onClick: () => handleSwitchRole('BGD_GIAM_DOC', '123456') },
        { key: 'BGD_TO_TRUONG', label: 'Tổ trưởng - Ban Giám Đốc', onClick: () => handleSwitchRole('BGD_TO_TRUONG', '123456') },
        { key: 'BGD_NHAN_VIEN', label: 'Nhân viên - Ban Giám Đốc', onClick: () => handleSwitchRole('BGD_NHAN_VIEN', '123456') },
      ]},
      { key: 'sales_group', type: 'group' as const, label: 'Kinh Doanh & Sale Admin', children: [
        { key: 'KINH_DOANH_TO_TRUONG', label: 'Tổ trưởng - Phòng Kinh Doanh', onClick: () => handleSwitchRole('KINH_DOANH_TO_TRUONG', '123456') },
        { key: 'KINH_DOANH_NHAN_VIEN', label: 'Nhân viên - Phòng Kinh Doanh', onClick: () => handleSwitchRole('KINH_DOANH_NHAN_VIEN', '123456') },
        { key: 'TRUONG_PHONG_SALE_ADMIN', label: 'Trưởng phòng Sale Admin', onClick: () => handleSwitchRole('TRUONG_PHONG_SALE_ADMIN', '123456') },
        { key: 'SALE_ADMIN_TO_TRUONG', label: 'Tổ trưởng - Sale Admin', onClick: () => handleSwitchRole('SALE_ADMIN_TO_TRUONG', '123456') },
        { key: 'SALE_ADMIN_NHAN_VIEN', label: 'Nhân viên - Sale Admin', onClick: () => handleSwitchRole('SALE_ADMIN_NHAN_VIEN', '123456') },
        { key: 'SALE_ADMIN', label: 'Sale Admin', onClick: () => handleSwitchRole('SALE_ADMIN', '123456') },
      ]},
      { key: 'ketoan_group', type: 'group' as const, label: 'Kế Toán', children: [
        { key: 'KE_TOAN_TRUONG', label: 'Kế toán trưởng', onClick: () => handleSwitchRole('KE_TOAN_TRUONG', '123456') },
        { key: 'KETOAN_TO_TRUONG', label: 'Tổ trưởng - Phòng Kế Toán', onClick: () => handleSwitchRole('KETOAN_TO_TRUONG', '123456') },
        { key: 'KE_TOAN_CONG_NO', label: 'Kế toán công nợ', onClick: () => handleSwitchRole('KE_TOAN_CONG_NO', '123456') },
        { key: 'KETOAN_NHAN_VIEN', label: 'Nhân viên - Phòng Kế Toán', onClick: () => handleSwitchRole('KETOAN_NHAN_VIEN', '123456') },
      ]},
      { key: 'sanxuat_group', type: 'group' as const, label: 'Sản Xuất & Kho', children: [
        { key: 'SAN_XUAT_GIAM_SAT', label: 'Giám sát - Khối Sản Xuất', onClick: () => handleSwitchRole('SAN_XUAT_GIAM_SAT', '123456') },
        { key: 'SAN_XUAT_TO_TRUONG', label: 'Tổ trưởng - Khối Sản Xuất', onClick: () => handleSwitchRole('SAN_XUAT_TO_TRUONG', '123456') },
        { key: 'SAN_XUAT_THO', label: 'Thợ - Khối Sản Xuất', onClick: () => handleSwitchRole('SAN_XUAT_THO', '123456') },
        { key: 'KHO_TO_TRUONG', label: 'Tổ trưởng - Kho', onClick: () => handleSwitchRole('KHO_TO_TRUONG', '123456') },
        { key: 'KHO_NHAN_VIEN', label: 'Nhân viên - Kho', onClick: () => handleSwitchRole('KHO_NHAN_VIEN', '123456') },
      ]},
      { key: 'other_group', type: 'group' as const, label: 'Nhân Sự & Thiết Kế', children: [
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
  const hasSxPerm = canSee(['production_order.view', 'production_order.create', 'production_order.edit'], role, userPermissions)
  const navItems = buildNavItems(queueCount)
    .filter(item => canSee(item.permissions, role, userPermissions))
    .map(item => (item.key === 'san-xuat' && !hasSxPerm) ? { ...item, hubTo: undefined } : item)

  const [searchOpen, setSearchOpen] = useState(false)

  // Ctrl+K → open global search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const selectedKeys = [location.pathname + location.search]

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
    if (key === 'settings') {
      changePwdForm.resetFields()
      setChangePwdOpen(true)
    }
  }

  const handleChangePwd = async () => {
    const values = await changePwdForm.validateFields()
    setChangePwdLoading(true)
    try {
      await authApi.changePassword(values.old_password, values.new_password)
      message.success('Đổi mật khẩu thành công')
      setChangePwdOpen(false)
    } catch (err) {
      const detail = (err as ApiError)?.response?.data?.detail
      message.error(detail || 'Đổi mật khẩu thất bại')
    } finally {
      setChangePwdLoading(false)
    }
  }

  return (
    <>
    <a href="#main-content" className="skip-nav">Bỏ qua điều hướng</a>
    <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={248}
        style={{
          background: '#1b168e',
          borderRight: '1px solid #15116f',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
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
        <CustomSidebarNav
          items={navItems}
          collapsed={collapsed}
          selectedPath={selectedKeys[0]}
          userRole={role}
          userPermissions={userPermissions}
          siderWidth={collapsed ? 80 : 248}
          onNavigate={navigate}
        />
      </Sider>

      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        <Header style={{
          padding: '0 20px',
          background: tk.colorBgContainer,
          borderBottom: `1px solid ${tk.colorBorderSecondary}`,
          boxShadow: '0 2px 10px rgba(27, 22, 142, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
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

          {/* Global search button */}
          <div
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #e7e9f2', background: '#f5f7ff',
              color: '#60647a', fontSize: 13, userSelect: 'none',
              minWidth: 200,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span style={{ flex: 1 }}>Tìm kiếm...</span>
            <span style={{
              fontSize: 11, padding: '1px 6px', borderRadius: 4,
              background: '#e7e9f2', color: '#8c8fa3', fontFamily: 'monospace',
            }}>Ctrl K</span>
          </div>

          <Space size={20}>
            {role === 'ADMIN' && (
              <Dropdown menu={roleTestMenu}>
                <Button type="dashed" icon={<ThunderboltOutlined />} danger>
                  🧪 Đổi Role Test
                </Button>
              </Dropdown>
            )}

            <Dropdown menu={{ items: userMenu, onClick: handleUserMenu }}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ background: '#ff8200' }} icon={<UserOutlined />} />
                <Text strong>{user?.ho_ten}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Modal
          title="Đổi mật khẩu"
          open={changePwdOpen}
          onOk={handleChangePwd}
          onCancel={() => setChangePwdOpen(false)}
          confirmLoading={changePwdLoading}
          okText="Xác nhận"
          cancelText="Hủy"
          destroyOnClose
        >
          <Form form={changePwdForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item
              name="old_password"
              label="Mật khẩu hiện tại"
              rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}
            >
              <Input.Password placeholder="Mật khẩu hiện tại" />
            </Form.Item>
            <Form.Item
              name="new_password"
              label="Mật khẩu mới"
              rules={[
                { required: true, message: 'Nhập mật khẩu mới' },
                { min: 6, message: 'Tối thiểu 6 ký tự' },
              ]}
            >
              <Input.Password placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="Xác nhận mật khẩu mới"
              dependencies={['new_password']}
              rules={[
                { required: true, message: 'Xác nhận mật khẩu mới' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) return Promise.resolve()
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Nhập lại mật khẩu mới" />
            </Form.Item>
          </Form>
        </Modal>

        <Content id="main-content" style={{ margin: 16, background: tk.colorBgLayout, overflow: 'initial' }}>
          <div key={location.pathname} className="np-page-enter">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
    </>
  )
}
