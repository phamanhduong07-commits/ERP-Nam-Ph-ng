import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Col, Row, Typography } from 'antd'
import {
  AuditOutlined, DatabaseOutlined, DollarOutlined,
  InboxOutlined, TeamOutlined, ToolOutlined,
} from '@ant-design/icons'
import { DashboardHeader, dashboardPageStyle, hoverCardCss } from './_shared'

const { Text } = Typography

const NavCard = ({ icon, title, desc, path, color }: {
  icon: React.ReactNode
  title: string
  desc: string
  path: string
  color: string
}) => (
  <Link to={path}>
    <Card
      hoverable
      variant="borderless"
      style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', height: '100%' }}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${color}15`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color, fontSize: 24, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{title}</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>{desc}</Text>
        </div>
      </div>
    </Card>
  </Link>
)

interface Props {
  userName: string
}

export default function DashboardDefault({ userName }: Props) {
  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader userName={userName} subtitle="Chào mừng đến ERP Nam Phương" />

      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={8}>
          <NavCard
            icon={<DollarOutlined />}
            title="Kinh Doanh"
            desc="Đơn hàng, báo giá, khách hàng"
            path="/sales/orders"
            color="#1b168e"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <NavCard
            icon={<ToolOutlined />}
            title="Sản Xuất"
            desc="Lệnh sản xuất, kế hoạch"
            path="/production/orders"
            color="#1890ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <NavCard
            icon={<InboxOutlined />}
            title="Kho Hàng"
            desc="Tồn kho, nhập/xuất, giao hàng"
            path="/warehouse/inventory"
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <NavCard
            icon={<AuditOutlined />}
            title="Kế Toán"
            desc="Phiếu thu, phiếu chi, công nợ"
            path="/accounting/receipts"
            color="#fa8c16"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <NavCard
            icon={<TeamOutlined />}
            title="Nhân Sự"
            desc="Nhân viên, lương, chấm công"
            path="/hr/employees"
            color="#722ed1"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <NavCard
            icon={<DatabaseOutlined />}
            title="Danh Mục"
            desc="Sản phẩm, khách hàng, nhà cung cấp"
            path="/categories/products"
            color="#eb2f96"
          />
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
