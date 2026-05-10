import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Typography, Space, theme, Badge,
} from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined, ShoppingOutlined, DatabaseOutlined,
  TeamOutlined, UserOutlined, LogoutOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ToolOutlined, ClockCircleOutlined,
  AccountBookOutlined, RobotOutlined, BarChartOutlined, ShopOutlined, BankOutlined,
  ThunderboltOutlined, FileTextOutlined, MobileOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { productionPlansApi } from '../api/productionPlans'
import namPhuongLogo from '../assets/nam-phuong-logo-cropped.png'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// ─── Phân quyền menu ──────────────────────────────────────────────────────────
type RawMenuItem = {
  key: string
  icon?: React.ReactNode
  label: React.ReactNode
  roles?: string[]
  children?: RawMenuItem[]
}

function filterByRole(items: RawMenuItem[], role: string): object[] {
  return items
    .filter(item => !item.roles || item.roles.includes(role))
    .map(({ roles: _roles, children, ...rest }) => ({
      ...rest,
      ...(children
        ? { children: filterByRole(children, role) }
        : {}),
    }))
    .filter(item => {
      const c = (item as any).children
      return c === undefined || c.length > 0
    })
}

const ADMIN_GD = ['ADMIN', 'GIAM_DOC']
const BAN_HANG = ['ADMIN', 'GIAM_DOC', 'KINH_DOANH', 'KE_TOAN']
const SAN_XUAT_FULL = ['ADMIN', 'GIAM_DOC', 'SAN_XUAT', 'KINH_DOANH']
const SAN_XUAT_ALL = ['ADMIN', 'GIAM_DOC', 'SAN_XUAT', 'KINH_DOANH', 'CONG_NHAN']
const KHO_ROLES = ['ADMIN', 'GIAM_DOC', 'KHO', 'SAN_XUAT', 'KE_TOAN', 'MUA_HANG']
const MUA_HANG = ['ADMIN', 'GIAM_DOC', 'MUA_HANG', 'KE_TOAN']

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
      roles: BAN_HANG,
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
      roles: SAN_XUAT_ALL,
      children: [
        { key: '/production/orders', label: <Link to="/production/orders">Lệnh sản xuất</Link>, roles: SAN_XUAT_FULL },
        { key: '/production/plans', label: <Link to="/production/plans">Kế hoạch sản xuất</Link>, roles: SAN_XUAT_FULL },
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
        {
          key: 'cd2-group',
          label: '🖨 Công đoạn 2 (CD2)',
          children: [
            { key: '/production/cd2/dashboard', label: <Link to="/production/cd2/dashboard">📈 Dashboard</Link>, roles: SAN_XUAT_FULL },
            { key: '/production/cd2', label: <Link to="/production/cd2">🗂 Kanban máy in</Link> },
            { key: '/production/cd2/may-in', label: <Link to="/production/cd2/may-in">🖨 Queue máy in</Link> },
            { key: '/production/cd2/scan', label: <Link to="/production/cd2/scan">📊 Scan sản lượng</Link> },
            { key: '/production/cd2/mobile-tracking', label: <Link to="/production/cd2/mobile-tracking">📱 Báo cáo máy (Mobile)</Link> },
            { key: '/cd2/machine-login', label: <Link to="/cd2/machine-login">🔑 Đăng nhập máy (Công nhân)</Link> },
            { key: '/production/cd2/scan-history', label: <Link to="/production/cd2/scan-history">📋 Lịch sử scan</Link> },
            { key: '/production/cd2/history', label: <Link to="/production/cd2/history">📑 Lịch sử phiếu in</Link> },
            { key: '/production/cd2/dhcho2', label: <Link to="/production/cd2/dhcho2">🔧 Chờ định hình</Link> },
            { key: '/production/cd2/sauin-kanban', label: <Link to="/production/cd2/sauin-kanban">🏭 Kanban sau in</Link> },
            { key: '/production/cd2/shift', label: <Link to="/production/cd2/shift">⏰ Quản lý ca</Link>, roles: SAN_XUAT_FULL },
            { key: '/production/cd2/config', label: <Link to="/production/cd2/config">⚙ Cấu hình CD2</Link>, roles: ADMIN_GD },
          ],
        },
      ],
    },
    {
      key: 'kho',
      icon: <FileTextOutlined />,
      label: 'Kho',
      roles: KHO_ROLES,
      children: [
        { key: '/warehouse/theo-xuong', label: <Link to="/warehouse/theo-xuong">Kho theo xưởng</Link> },
        { key: '/production/kho-phoi', label: <Link to="/production/kho-phoi">Kho phôi sóng</Link>, roles: SAN_XUAT_FULL },
        { key: '/production/kho-thanh-pham', label: <Link to="/production/kho-thanh-pham">Kho thành phẩm</Link>, roles: SAN_XUAT_FULL },
        { key: '/production/phieu-nhap-phoi', label: <Link to="/production/phieu-nhap-phoi">DS nhập phôi sóng</Link>, roles: SAN_XUAT_FULL },
        { key: '/warehouse/inventory', label: <Link to="/warehouse/inventory">Tồn kho</Link> },
        { key: '/warehouse/nhap-nhanh', label: <Link to="/warehouse/nhap-nhanh">📷 Ghi nhận xe nhập giấy</Link> },
        { key: '/production/cd2/mobile-tracking-kho', label: <Link to="/production/cd2/mobile-tracking">📷 Báo cáo máy (Mobile)</Link> },
        { key: '/warehouse/nhap-nhanh-nvl', label: <Link to="/warehouse/nhap-nhanh?loai=nvl">📷 Ghi nhận xe nhập NVL</Link> },
        { key: '/warehouse/nhap-nhanh-phoi', label: <Link to="/warehouse/nhap-nhanh?loai=phoi">📷 Ghi nhận xe nhập phôi</Link> },
        { key: '/warehouse/nhap-giay', label: <Link to="/warehouse/nhap-giay">Nhập giấy cuộn</Link> },
        { key: '/warehouse/nhap-phoi-ngoai', label: <Link to="/warehouse/nhap-phoi-ngoai">Nhập phôi sóng (mua ngoài)</Link> },
        { key: '/warehouse/receipts', label: <Link to="/warehouse/receipts">Nhập NVL khác</Link> },
        { key: '/warehouse/issues', label: <Link to="/warehouse/issues">Xuất NVL sản xuất</Link> },
        { key: '/warehouse/production-output', label: <Link to="/warehouse/production-output">Nhập TP từ SX</Link> },
        { key: '/warehouse/transfers', label: <Link to="/warehouse/transfers">Chuyển kho</Link> },
        { key: '/warehouse/stock-adjustments', label: <Link to="/warehouse/stock-adjustments">Kiểm kê / điều chỉnh</Link> },
        { key: '/warehouse/the-kho', label: <Link to="/warehouse/the-kho">Sổ chi tiết / Thẻ kho</Link> },
      ],
    },
    {
      key: 'mua-hang',
      icon: <ShopOutlined />,
      label: 'Mua hàng',
      roles: MUA_HANG,
      children: [
        { key: '/purchasing/giay-cuon', label: <Link to="/purchasing/giay-cuon">Mua giấy</Link> },
        { key: '/purchasing/nvl-khac', label: <Link to="/purchasing/nvl-khac">Mua NVL khác</Link> },
        { key: '/purchasing/orders', label: <Link to="/purchasing/orders">Đơn mua hàng (PO)</Link> },
        { key: '/accounting/purchase-invoices', label: <Link to="/accounting/purchase-invoices">Hóa đơn mua hàng</Link> },
        { key: '/purchasing/returns', label: <Link to="/purchasing/returns">Trả hàng NCC</Link> },
      ],
    },
    {
      key: 'ke-toan-tai-chinh',
      icon: <AccountBookOutlined />,
      label: 'Kế toán - Tài chính',
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
            { key: '/accounting/customer-refunds', label: <Link to="/accounting/customer-refunds">Hoàn tiền trả hàng</Link> },
          ]
        },
        { key: '/accounting/journal-entries', label: <Link to="/accounting/journal-entries">Bút toán tổng hợp</Link> },
        { key: '/accounting/workshop-management', label: <Link to="/accounting/workshop-management">Quản trị xưởng (Lương)</Link> },
        { key: '/accounting/ccdc', label: <Link to="/accounting/ccdc">Tài sản & CCDC</Link> },
        { key: '/accounting/general-ledger', label: <Link to="/accounting/general-ledger">Sổ cái tài khoản</Link> },
      ],
    },
    {
      key: 'reporting-hub-group',
      icon: <BarChartOutlined />,
      label: 'Trung tâm Báo cáo',
      children: [
        { key: '/reports/hub', label: <Link to="/reports/hub"><Space><ThunderboltOutlined />Tổng quan báo cáo</Space></Link> },
        {
          key: 'rpt-mgmt',
          label: 'Báo cáo Quản trị',
          children: [
            { key: '/accounting/reports/workshop-pnl', label: <Link to="/accounting/reports/workshop-pnl">Lãi lỗ Phân xưởng</Link> },
            { key: '/accounting/reports/production-costing', label: <Link to="/accounting/reports/production-costing">Giá thành sản phẩm</Link> },
            { key: '/reports/revenue', label: <Link to="/reports/revenue">Doanh thu</Link> },
            { key: '/reports/production-performance', label: <Link to="/reports/production-performance">Hiệu suất SX</Link> },
          ]
        },
        {
          key: 'rpt-tax',
          label: 'Báo cáo Thuế',
          children: [
            { key: '/accounting/trial-balance', label: <Link to="/accounting/trial-balance">Cân đối phát sinh</Link> },
            { key: '/reports/tax-trial-balance', label: <Link to="/reports/tax-trial-balance">Bảng CĐPS (Thuế)</Link> },
            { key: '/reports/vat-summary', label: <Link to="/reports/vat-summary">Tờ khai thuế GTGT</Link> },
          ]
        },
        { key: '/reports/debt-summary', label: <Link to="/reports/debt-summary">Tổng hợp công nợ</Link> },
        { key: '/reports/inventory', label: <Link to="/reports/inventory">Nhập-Xuất-Tồn kho</Link> },
      ]
    },
    {
      key: 'danh-muc',
      icon: <TeamOutlined />,
      label: 'Danh mục',
      roles: ADMIN_GD,
      children: [
        { key: '/master/users', label: <Link to="/master/users">Danh mục nhân viên</Link> },
        { key: '/master/customers', label: <Link to="/master/customers">Danh mục khách hàng</Link> },
        { key: '/danhmuc/phap-nhan', label: <Link to="/danhmuc/phap-nhan">Danh mục pháp nhân</Link> },
        { key: '/master/phan-xuong', label: <Link to="/master/phan-xuong">Nơi sản xuất (Phân xưởng)</Link> },
        { key: '/master/material-groups', label: <Link to="/master/material-groups">Danh mục nhóm nguyên liệu</Link> },
        { key: '/master/products', label: <Link to="/master/products">Danh mục hàng hóa</Link> },
        { key: '/danhmuc/cau-truc', label: <Link to="/danhmuc/cau-truc">Kết cấu thông dụng</Link> },
        { key: '/master/suppliers', label: <Link to="/master/suppliers">Danh mục nhà cung cấp</Link> },
        { key: '/master/paper-materials', label: <Link to="/master/paper-materials">Danh mục nguyên liệu giấy</Link> },
        { key: '/master/vi-tri', label: <Link to="/master/vi-tri">Danh mục vị trí</Link> },
        { key: '/master/other-materials', label: <Link to="/master/other-materials">Danh mục nguyên liệu khác</Link> },
        { key: '/master/xe', label: <Link to="/master/xe">Danh mục xe</Link> },
        { key: '/master/tai-xe', label: <Link to="/master/tai-xe">Danh mục tài xế</Link> },
        { key: '/master/warehouses', label: <Link to="/master/warehouses">Danh mục kho</Link> },
        { key: '/master/bank-accounts', label: <Link to="/master/bank-accounts">Tài khoản ngân hàng</Link> },
        { key: '/master/don-gia-van-chuyen', label: <Link to="/master/don-gia-van-chuyen">Đơn giá vận chuyển</Link> },
        { key: '/master/don-vi-tinh', label: <Link to="/master/don-vi-tinh">Đơn vị tính</Link> },
        { key: '/master/phuong-xa', label: <Link to="/master/phuong-xa">Danh mục phường xã</Link> },
        { key: '/master/tinh-thanh', label: <Link to="/master/tinh-thanh">Danh mục tỉnh thành phố</Link> },
        { key: '/master/indirect-costs', label: <Link to="/master/indirect-costs">Chi phí gián tiếp</Link> },
        { key: '/master/addon-rates', label: <Link to="/master/addon-rates">Phí gia công / Tỷ lệ lãi</Link> },
        { key: '/reports/import-history', label: <Link to="/reports/import-history">Lịch sử Import</Link> },
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
  const { user, logout } = useAuthStore()
  const { token: tk } = theme.useToken()

  const { data: queueLines = [] } = useQuery({
    queryKey: ['production-queue', 'cho'],
    queryFn: () => productionPlansApi.getQueue('cho').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const queueCount = queueLines.length

  const role = user?.role ?? 'ADMIN'
  const menuItems = filterByRole(buildMenuItems(queueCount), role)

  const selectedKeys = [location.pathname]

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
          items={menuItems as any}
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

          <Dropdown menu={{ items: userMenu, onClick: handleUserMenu }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ background: '#ff8200' }} icon={<UserOutlined />} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                <Text strong>{user?.ho_ten}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{user?.role}</Text>
              </div>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 16, background: tk.colorBgLayout, overflow: 'initial' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
