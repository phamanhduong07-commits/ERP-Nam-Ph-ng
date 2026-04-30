import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Layout, Menu, Avatar, Dropdown, Typography, Space, theme, Badge,
} from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined, ShopOutlined,
  TeamOutlined, UserOutlined, LogoutOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, FileTextOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { productionPlansApi } from '../api/productionPlans'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// ─── Phân quyền menu ──────────────────────────────────────────────────────────
// roles: undefined = tất cả đều thấy; có mảng = chỉ role trong mảng mới thấy

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

const ADMIN_GD      = ['ADMIN', 'GIAM_DOC']
const BAN_HANG      = ['ADMIN', 'GIAM_DOC', 'KINH_DOANH', 'KE_TOAN']
const SAN_XUAT_FULL = ['ADMIN', 'GIAM_DOC', 'SAN_XUAT', 'KINH_DOANH']
const SAN_XUAT_ALL  = ['ADMIN', 'GIAM_DOC', 'SAN_XUAT', 'KINH_DOANH', 'CONG_NHAN']
const KHO_ROLES     = ['ADMIN', 'GIAM_DOC', 'KHO', 'SAN_XUAT', 'KE_TOAN', 'MUA_HANG']
const MUA_HANG      = ['ADMIN', 'GIAM_DOC', 'MUA_HANG', 'KE_TOAN']

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
        { key: '/warehouse/delivery', label: <Link to="/warehouse/delivery">Giao hàng</Link> },
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
                <ClockCircleOutlined />
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
        { key: '/master/indirect-costs', label: <Link to="/master/indirect-costs">Chi phí gián tiếp</Link>, roles: ADMIN_GD },
        { key: '/master/addon-rates', label: <Link to="/master/addon-rates">Phí gia công</Link>, roles: ADMIN_GD },
        {
          key: 'cd2-group',
          label: '🖨 Công đoạn 2 (CD2)',
          children: [
            { key: '/production/cd2/dashboard', label: <Link to="/production/cd2/dashboard">📈 Dashboard</Link>, roles: SAN_XUAT_FULL },
            { key: '/production/cd2', label: <Link to="/production/cd2">🗂 Kanban máy in</Link> },
            { key: '/production/cd2/may-in', label: <Link to="/production/cd2/may-in">🖨 Queue máy in</Link> },
            { key: '/production/cd2/scan', label: <Link to="/production/cd2/scan">📊 Scan sản lượng</Link> },
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
        { key: '/warehouse/inventory', label: <Link to="/warehouse/inventory">Tồn kho</Link> },
        { key: '/warehouse/receipts', label: <Link to="/warehouse/receipts">Nhập kho (NVL)</Link> },
        { key: '/warehouse/issues', label: <Link to="/warehouse/issues">Xuất NVL sản xuất</Link> },
        { key: '/warehouse/production-output', label: <Link to="/warehouse/production-output">Nhập TP từ SX</Link> },
        { key: '/warehouse/delivery', label: <Link to="/warehouse/delivery">Giao hàng (TP)</Link> },
        { key: '/warehouse/transfers', label: <Link to="/warehouse/transfers">Chuyển kho</Link> },
      ],
    },
    {
      key: 'mua-hang',
      icon: <ShopOutlined />,
      label: 'Mua hàng',
      roles: MUA_HANG,
      children: [
        { key: '/purchasing/orders', label: <Link to="/purchasing/orders">Đơn mua hàng (PO)</Link> },
      ],
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
        { key: '/master/don-gia-van-chuyen', label: <Link to="/master/don-gia-van-chuyen">Đơn giá vận chuyển</Link> },
        { key: '/master/don-vi-tinh', label: <Link to="/master/don-vi-tinh">Đơn vị tính</Link> },
        { key: '/master/phuong-xa', label: <Link to="/master/phuong-xa">Danh mục phường xã</Link> },
        { key: '/master/tinh-thanh', label: <Link to="/master/tinh-thanh">Danh mục tỉnh thành phố</Link> },
      ],
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
        width={240}
        style={{ background: tk.colorBgContainer, borderRight: `1px solid ${tk.colorBorderSecondary}` }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${tk.colorBorderSecondary}`,
          padding: '0 16px',
        }}>
          {!collapsed && (
            <Text strong style={{ fontSize: 16, color: tk.colorPrimary }}>
              🏭 ERP Nam Phương
            </Text>
          )}
          {collapsed && <Text strong style={{ color: tk.colorPrimary }}>NP</Text>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems as any}
          style={{ border: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 24px',
          background: tk.colorBgContainer,
          borderBottom: `1px solid ${tk.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Space>
            {collapsed
              ? <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer' }} />
              : <MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ fontSize: 18, cursor: 'pointer' }} />
            }
          </Space>

          <Dropdown menu={{ items: userMenu, onClick: handleUserMenu }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ background: tk.colorPrimary }} icon={<UserOutlined />} />
              <Text>{user?.ho_ten}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>({user?.role})</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24, background: tk.colorBgLayout }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
