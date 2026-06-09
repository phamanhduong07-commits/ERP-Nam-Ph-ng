import React from 'react'
import { Link } from 'react-router-dom'
import {
  Badge, Button, Card, Col, List, Row, Space, Tag, Typography,
} from 'antd'
import {
  ArrowRightOutlined, AuditOutlined, BarChartOutlined,
  CheckCircleOutlined, ClockCircleOutlined, DollarOutlined,
  FileTextOutlined, ShoppingCartOutlined, TeamOutlined, ThunderboltOutlined,
  TruckOutlined, UserOutlined,
} from '@ant-design/icons'
import {
  DashboardHeader, DashboardStats, KPICard, QuickLink,
  dashboardPageStyle, hoverCardCss, sharedCardStyle, usePrefetchPages,
} from './_shared'

const { Title, Text } = Typography

interface Props {
  stats: DashboardStats
  userName: string
}

export default function DashboardSalesManager({ stats, userName }: Props) {
  usePrefetchPages(['sales', 'accounting'])
  const sales = stats.sales

  const doanhThuThang = sales?.doanh_thu_thang || 0
  const doanhThuHomNay = sales?.doanh_thu_hom_nay || 0
  const baoGiaMoi = sales?.bao_gia_moi || 0
  const donCanGiao = sales?.don_hang_can_giao || 0
  const donChoduyet = sales?.don_hang_cho_duyet || 0

  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader
        userName={userName}
        subtitle="Tổng quan kinh doanh — Phòng Kinh Doanh"
        actions={
          <Space size={12}>
            <Link to="/sales/orders/new">
              <Button type="primary" icon={<ShoppingCartOutlined />} size="large" style={{ borderRadius: 10, background: '#1b168e', border: 'none' }}>
                Tạo đơn mới
              </Button>
            </Link>
          </Space>
        }
      />

      {/* KPI hàng đầu */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Doanh thu tháng này"
            value={doanhThuThang}
            suffix="VND"
            icon={<DollarOutlined />}
            gradient="linear-gradient(135deg, #1b168e 0%, #3a32cc 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Doanh thu hôm nay"
            value={doanhThuHomNay}
            suffix="VND"
            icon={<BarChartOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Badge count={donChoduyet} offset={[-4, 4]}>
            <KPICard
              title="Đơn hàng chờ duyệt"
              value={donChoduyet}
              suffix="đơn"
              icon={<ClockCircleOutlined />}
              color={donChoduyet > 0 ? '#fa8c16' : '#52c41a'}
            />
          </Badge>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Báo giá đang mở"
            value={baoGiaMoi}
            suffix="báo giá"
            icon={<FileTextOutlined />}
            color="#1890ff"
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={16}>
          {/* Tình trạng đơn hàng */}
          <Card
            title={
              <Space>
                <ShoppingCartOutlined style={{ color: '#1b168e' }} />
                Tình trạng đơn hàng
              </Space>
            }
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
            extra={<Link to="/sales/orders"><Button type="link">Xem tất cả <ArrowRightOutlined /></Button></Link>}
          >
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: '20px 0', background: '#fff7e6', borderRadius: 12 }}>
                  <Title level={2} style={{ margin: 0, color: '#fa8c16' }}>{donChoduyet}</Title>
                  <Text type="secondary">Chờ duyệt</Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: '20px 0', background: '#f0f9ff', borderRadius: 12 }}>
                  <Title level={2} style={{ margin: 0, color: '#1890ff' }}>{sales?.don_hang_da_duyet || 0}</Title>
                  <Text type="secondary">Đã duyệt / Đang SX</Text>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: '20px 0', background: '#f6ffed', borderRadius: 12 }}>
                  <Title level={2} style={{ margin: 0, color: '#52c41a' }}>{donCanGiao}</Title>
                  <Text type="secondary">Cần giao 7 ngày</Text>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Danh sách chờ phê duyệt */}
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#fa8c16' }} />
                Cần phê duyệt
                {donChoduyet > 0 && <Tag color="orange">{donChoduyet}</Tag>}
              </Space>
            }
            variant="borderless"
            style={sharedCardStyle}
            extra={<Link to="/sales/orders?trang_thai=moi"><Button type="link" danger>Duyệt ngay <ArrowRightOutlined /></Button></Link>}
          >
            <List size="small">
              <List.Item extra={<Tag color="orange">{donChoduyet}</Tag>}>
                <Space><ShoppingCartOutlined />Đơn hàng chờ duyệt</Space>
              </List.Item>
              <List.Item extra={<Tag color="blue">{baoGiaMoi}</Tag>}>
                <Space><FileTextOutlined />Báo giá đang mở (chưa chốt)</Space>
              </List.Item>
              <List.Item extra={<Tag color="purple">{donCanGiao}</Tag>}>
                <Space><TruckOutlined />Đơn cần giao trong 7 ngày</Space>
              </List.Item>
            </List>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /> Lối tắt trưởng phòng</Space>}
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
          >
            <Row gutter={[12, 12]}>
              <Col span={8}><QuickLink label="Phê duyệt" path="/sales/orders?trang_thai=moi" icon={<CheckCircleOutlined />} color="#fa8c16" /></Col>
              <Col span={8}><QuickLink label="Báo giá" path="/quotes" icon={<FileTextOutlined />} color="#1890ff" /></Col>
              <Col span={8}><QuickLink label="Đơn hàng" path="/sales/orders" icon={<ShoppingCartOutlined />} color="#1b168e" /></Col>
              <Col span={8}><QuickLink label="Giao hàng" path="/sales/giao-hang" icon={<TruckOutlined />} color="#722ed1" /></Col>
              <Col span={8}><QuickLink label="Báo cáo" path="/reports/hub" icon={<BarChartOutlined />} color="#eb2f96" /></Col>
              <Col span={8}><QuickLink label="Công nợ" path="/reports/debt-summary" icon={<AuditOutlined />} color="#f5222d" /></Col>
            </Row>
          </Card>

          <Card
            title={<Space><TeamOutlined style={{ color: '#1890ff' }} /> Tổng quan khách hàng</Space>}
            variant="borderless"
            style={sharedCardStyle}
            extra={<Link to="/customers">Xem hết</Link>}
          >
            <List size="small">
              <List.Item extra={<Text strong>{stats.tong_khach_hang}</Text>}>
                <Space><UserOutlined />Tổng khách hàng</Space>
              </List.Item>
              <List.Item extra={<Text strong>{stats.don_hang_moi_hom_nay}</Text>}>
                <Space><ShoppingCartOutlined />Đơn hàng hôm nay</Space>
              </List.Item>
            </List>
          </Card>
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
