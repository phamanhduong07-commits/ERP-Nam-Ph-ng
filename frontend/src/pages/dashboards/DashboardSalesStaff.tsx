import React from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Col, Row, Space, Typography } from 'antd'
import {
  DollarOutlined, FileAddOutlined, FileTextOutlined,
  PhoneOutlined, PlusOutlined, ShoppingCartOutlined,
  ThunderboltOutlined, TruckOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import {
  DashboardHeader, DashboardStats, KPICard, QuickLink,
  dashboardPageStyle, hoverCardCss, sharedCardStyle, usePrefetchPages,
} from './_shared'

const { Text } = Typography

interface Props {
  stats: DashboardStats
  userName: string
}

export default function DashboardSalesStaff({ stats, userName }: Props) {
  usePrefetchPages(['sales'])
  const sales = stats.sales

  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader
        userName={userName}
        subtitle="Nhiệm vụ hôm nay"
        actions={
          <Space size={12}>
            <Link to="/quotes/new">
              <Button icon={<FileAddOutlined />} size="large" style={{ borderRadius: 10 }}>Tạo báo giá</Button>
            </Link>
            <Link to="/sales/orders/new">
              <Button type="primary" icon={<PlusOutlined />} size="large" style={{ borderRadius: 10, background: '#1b168e', border: 'none' }}>
                Tạo đơn hàng
              </Button>
            </Link>
          </Space>
        }
      />

      {/* KPI tác vụ hằng ngày */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={8}>
          <KPICard
            title="Báo giá đang mở"
            value={sales?.bao_gia_moi || 0}
            suffix="báo giá"
            icon={<FileTextOutlined />}
            gradient="linear-gradient(135deg, #1b168e 0%, #3a32cc 100%)"
          />
        </Col>
        <Col xs={24} sm={8}>
          <KPICard
            title="Đơn hàng mới hôm nay"
            value={stats.don_hang_moi_hom_nay}
            suffix="đơn"
            icon={<ShoppingCartOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={8}>
          <KPICard
            title="Cần giao trong 7 ngày"
            value={sales?.don_hang_can_giao || 0}
            suffix="đơn"
            icon={<TruckOutlined />}
            color={sales?.don_hang_can_giao ? '#fa8c16' : '#52c41a'}
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={24}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /> Thao tác nhanh</Space>}
            variant="borderless"
            style={sharedCardStyle}
          >
            <Row gutter={[16, 16]}>
              <Col xs={8} sm={4}>
                <QuickLink label="Tạo báo giá" path="/quotes/new" icon={<FileAddOutlined />} color="#1890ff" />
              </Col>
              <Col xs={8} sm={4}>
                <QuickLink label="Tạo đơn hàng" path="/sales/orders/new" icon={<PlusOutlined />} color="#1b168e" />
              </Col>
              <Col xs={8} sm={4}>
                <QuickLink label="Danh sách báo giá" path="/quotes" icon={<FileTextOutlined />} color="#722ed1" />
              </Col>
              <Col xs={8} sm={4}>
                <QuickLink label="Danh sách đơn" path="/sales/orders" icon={<UnorderedListOutlined />} color="#52c41a" />
              </Col>
              <Col xs={8} sm={4}>
                <QuickLink label="Giao hàng" path="/sales/giao-hang" icon={<TruckOutlined />} color="#fa8c16" />
              </Col>
              <Col xs={8} sm={4}>
                <QuickLink label="Khách hàng" path="/customers" icon={<PhoneOutlined />} color="#eb2f96" />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card
            title="Tóm tắt hôm nay"
            variant="borderless"
            style={sharedCardStyle}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f0f9ff', borderRadius: 10 }}>
                <Space><ShoppingCartOutlined style={{ color: '#1890ff' }} /><Text>Đơn hàng mới</Text></Space>
                <Text strong style={{ color: '#1890ff', fontSize: 18 }}>{stats.don_hang_moi_hom_nay}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f6ffed', borderRadius: 10 }}>
                <Space><FileTextOutlined style={{ color: '#52c41a' }} /><Text>Báo giá mở</Text></Space>
                <Text strong style={{ color: '#52c41a', fontSize: 18 }}>{sales?.bao_gia_moi || 0}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: sales?.don_hang_can_giao ? '#fff7e6' : '#f6ffed', borderRadius: 10 }}>
                <Space><TruckOutlined style={{ color: sales?.don_hang_can_giao ? '#fa8c16' : '#52c41a' }} /><Text>Cần giao 7 ngày</Text></Space>
                <Text strong style={{ color: sales?.don_hang_can_giao ? '#fa8c16' : '#52c41a', fontSize: 18 }}>{sales?.don_hang_can_giao || 0}</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="Doanh thu tháng này"
            variant="borderless"
            style={sharedCardStyle}
          >
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <DollarOutlined style={{ fontSize: 40, color: '#1b168e', marginBottom: 12 }} />
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1b168e' }}>
                {((sales?.doanh_thu_thang || 0) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                <span style={{ fontSize: 16, color: '#8c8c8c', fontWeight: 400 }}> triệu VND</span>
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Hôm nay: {((sales?.doanh_thu_hom_nay || 0) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} triệu
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
