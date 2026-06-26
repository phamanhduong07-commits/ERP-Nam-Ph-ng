import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Badge, Button, Card, Col, List, Progress, Row, Space, Table, Tag, Typography,
} from 'antd'
import {
  ArrowRightOutlined, AuditOutlined, BarChartOutlined,
  CheckCircleOutlined, ClockCircleOutlined, DollarOutlined,
  FileTextOutlined, RiseOutlined, ShoppingCartOutlined, TeamOutlined, ThunderboltOutlined,
  TruckOutlined, UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  DashboardHeader, DashboardStats, KPICard, QuickLink,
  dashboardPageStyle, hoverCardCss, sharedCardStyle, usePrefetchPages,
} from './_shared'
import { saleReports, type SaleByNvRow } from '../../api/reports'

const { Title, Text } = Typography

interface Props {
  stats: DashboardStats
  userName: string
}

export default function DashboardSalesManager({ stats, userName }: Props) {
  usePrefetchPages(['sales', 'accounting'])
  const sales = stats.sales

  const { data: saleDash } = useQuery({
    queryKey: ['sale-dashboard'],
    queryFn: saleReports.getDashboard,
    staleTime: 60_000,
  })

  const { data: saleByNv = [] } = useQuery({
    queryKey: ['sale-by-nv'],
    queryFn: () => saleReports.getSaleByNv(),
    staleTime: 5 * 60_000,
  })

  const maxRevenue = Math.max(...saleByNv.map(r => r.tong_doanh_thu), 1)

  const nvColumns: ColumnsType<SaleByNvRow> = [
    {
      title: 'Nhân viên',
      dataIndex: 'nv_name',
      ellipsis: true,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Báo giá',
      dataIndex: 'so_bao_gia',
      width: 72,
      align: 'center',
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'so_don_hang',
      width: 80,
      align: 'center',
      render: (v: number) => <Tag color="geekblue">{v}</Tag>,
    },
    {
      title: 'Doanh thu tháng',
      dataIndex: 'tong_doanh_thu',
      width: 200,
      render: (v: number) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Progress
            percent={Math.round((v / maxRevenue) * 100)}
            size="small"
            showInfo={false}
            strokeColor="#1b168e"
          />
          <span style={{ fontSize: 11, color: '#666' }}>
            {v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}tr` : v.toLocaleString('vi')}
          </span>
        </Space>
      ),
    },
    {
      title: 'Chuyển đổi',
      dataIndex: 'ty_le_chuyen_doi',
      width: 90,
      align: 'center',
      render: (v: number) => (
        <Tag color={v >= 50 ? 'success' : v >= 30 ? 'warning' : 'error'}>
          {v.toFixed(0)}%
        </Tag>
      ),
    },
  ]

  const doanhThuThang = saleDash?.total_revenue_month ?? sales?.doanh_thu_thang ?? 0
  const doanhThuHomNay = sales?.doanh_thu_hom_nay || 0
  const baoGiaMoi = sales?.bao_gia_moi || 0
  const donCanGiao = sales?.don_hang_can_giao || 0
  const donChoduyet = sales?.don_hang_cho_duyet || 0
  const pendingQuotes = saleDash?.pending_quotes ?? 0
  const customersAssigned = saleDash?.customers_assigned ?? stats.tong_khach_hang

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
          <Badge count={pendingQuotes} offset={[-4, 4]}>
            <KPICard
              title="Báo giá chờ duyệt"
              value={pendingQuotes}
              suffix="báo giá"
              icon={<ClockCircleOutlined />}
              color={pendingQuotes > 0 ? '#fa8c16' : '#52c41a'}
            />
          </Badge>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Khách hàng phụ trách"
            value={customersAssigned}
            suffix="khách"
            icon={<TeamOutlined />}
            color="#722ed1"
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
                {(pendingQuotes + donChoduyet) > 0 && <Tag color="orange">{pendingQuotes + donChoduyet}</Tag>}
              </Space>
            }
            variant="borderless"
            style={sharedCardStyle}
            extra={<Link to="/quotes?trang_thai=cho_duyet"><Button type="link" danger>Duyệt ngay <ArrowRightOutlined /></Button></Link>}
          >
            <List size="small">
              <List.Item extra={<Tag color="orange">{pendingQuotes}</Tag>}>
                <Link to="/quotes?trang_thai=cho_duyet"><Space><FileTextOutlined />Báo giá chờ duyệt</Space></Link>
              </List.Item>
              <List.Item extra={<Tag color="blue">{donChoduyet}</Tag>}>
                <Space><ShoppingCartOutlined />Đơn hàng chờ duyệt</Space>
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
              <List.Item extra={<Text strong>{customersAssigned}</Text>}>
                <Space><UserOutlined />Khách hàng phụ trách</Space>
              </List.Item>
              <List.Item extra={<Text strong>{saleDash?.approved_quotes_week ?? 0}</Text>}>
                <Space><FileTextOutlined />Báo giá duyệt tuần này</Space>
              </List.Item>
              <List.Item extra={<Text strong>{stats.don_hang_moi_hom_nay}</Text>}>
                <Space><ShoppingCartOutlined />Đơn hàng hôm nay</Space>
              </List.Item>
            </List>
          </Card>
        </Col>
      </Row>

      {/* Hiệu suất nhân viên */}
      {saleByNv.length > 0 && (
        <Card
          title={<Space><RiseOutlined style={{ color: '#1b168e' }} />Hiệu suất nhân viên tháng này</Space>}
          variant="borderless"
          style={{ ...sharedCardStyle, marginTop: 24 }}
          extra={<Link to="/reports/sale-by-nv"><Button type="link">Chi tiết <ArrowRightOutlined /></Button></Link>}
        >
          <Table
            rowKey="nv_id"
            dataSource={saleByNv}
            columns={nvColumns}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      <style>{hoverCardCss}</style>
    </div>
  )
}
