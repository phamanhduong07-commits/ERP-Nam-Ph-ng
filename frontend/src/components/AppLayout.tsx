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

function buildMenuItems(queueCount: number) {
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
      children: [
        { key: '/quotes', label: <Link to="/quotes">Báo giá</Link> },
        { key: '/sales/orders', label: <Link to="/sales/orders">Đơn hàng</Link> },
        { key: '/sales/delivery', label: <Link to="/sales/delivery">Giao hàng</Link> },
      ],
    },
    {
      key: 'san-xuat',
      icon: <ShopOutlined />,
      label: 'Sản xuất',
      children: [
        { key: '/production/orders', label: <Link to="/production/orders">Lệnh sản xuất</Link> },
        { key: '/production/plans', label: <Link to="/production/plans">Kế hoạch sản xuất</Link> },
        {
          key: '/production/queue',
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
        { key: '/production/bom', label: <Link to="/production/bom">Định mức (BOM)</Link> },
        { key: '/master/indirect-costs', label: <Link to="/master/indirect-costs">Chi phí gián tiếp</Link> },
        { key: '/master/addon-rates', label: <Link to="/master/addon-rates">Phí gia công</Link> },
      ],
    },
    {
      key: 'kho',
      icon: <FileTextOutlined />,
      label: 'Kho',
      children: [
        { key: '/warehouse/inventory', label: <Link to="/warehouse/inventory">Tồn kho</Link> },
        { key: '/warehouse/receipts', label: <Link to="/warehouse/receipts">Nhập kho</Link> },
        { key: '/warehouse/issues', label: <Link to="/warehouse/issues">Xuất kho</Link> },
      ],
    },
    {
      key: 'mua-hang',
      icon: <ShopOutlined />,
      label: 'Mua hàng',
      children: [
        { key: '/purchasing/orders', label: <Link to="/purchasing/orders">Đơn mua</Link> },
      ],
    },
    {
      key: 'danh-muc',
      icon: <TeamOutlined />,
      label: 'Danh mục',
      children: [
        { key: '/master/users', label: <Link to="/master/users">Danh mục nhân viên</Link> },
        { key: '/master/customers', label: <Link to="/master/customers">Danh mục khách hàng</Link> },
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
  const menuItems = buildMenuItems(queueCount)

  const selectedKeys = [location.pathname]
  const openKeys = menuItems
    .filter((m) => m.children?.some((c) => c.key === location.pathname))
    .map((m) => m.key)

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
          items={menuItems}
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
