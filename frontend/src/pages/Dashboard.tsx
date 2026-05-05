import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Empty, List, Progress, Row, Skeleton, Space,
  Statistic, Tag, Typography,
} from 'antd'
import {
  AlertOutlined, ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined,
  DollarOutlined, InboxOutlined, ShoppingCartOutlined, ToolOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import client from '../api/client'

const { Title, Text } = Typography

interface LowStockRow {
  ten_hang: string
  ten_kho: string
  ton_luong: number
  ton_toi_thieu: number
  don_vi: string
}

interface DashboardStats {
  don_hang_moi_hom_nay: number
  cho_duyet: number
  dang_san_xuat: number
  tong_khach_hang: number
  sales?: {
    bao_gia_moi: number
    don_hang_cho_duyet: number
    don_hang_da_duyet: number
    don_hang_can_giao: number
    doanh_thu_hom_nay: number
    doanh_thu_thang: number
  }
  production?: {
    lenh_sx_moi: number
    dang_san_xuat: number
    lenh_sx_tre: number
    lenh_sx_hoan_thanh_hom_nay: number
  }
  warehouse?: {
    phieu_nhap_hom_nay: number
    phieu_xuat_nvl_hom_nay: number
    phieu_giao_hom_nay: number
    giao_hang_cho_xuat: number
    tong_gia_tri_ton: number
    ton_thap: LowStockRow[]
  }
  purchase?: {
    po_cho_duyet: number
    po_dang_ve: number
  }
}

function fmtMoney(v?: number) {
  return `${Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ`
}

function fmtNum(v?: number, digits = 0) {
  return Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: digits })
}

function WorkItem({
  title, value, href, tone = 'blue',
}: { title: string; value: number; href: string; tone?: 'blue' | 'orange' | 'red' | 'green' }) {
  const colors = {
    blue: '#1b168e',
    orange: '#ff8200',
    red: '#cf1322',
    green: '#389e0d',
  }
  return (
    <Link to={href}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        border: '1px solid #e7e9f2',
        borderRadius: 6,
        background: '#fff',
      }}>
        <Space>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: colors[tone],
          }} />
          <Text>{title}</Text>
        </Space>
        <Space size={6}>
          <Text strong style={{ color: colors[tone] }}>{value}</Text>
          <ArrowRightOutlined style={{ fontSize: 12, color: '#8a8ea3' }} />
        </Space>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => client.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const sales = stats?.sales
  const production = stats?.production
  const warehouse = stats?.warehouse
  const purchase = stats?.purchase
  const productionTotal = (production?.lenh_sx_moi || 0) + (production?.dang_san_xuat || 0) + (production?.lenh_sx_hoan_thanh_hom_nay || 0)
  const productionDonePct = productionTotal
    ? Math.round(((production?.lenh_sx_hoan_thanh_hom_nay || 0) / productionTotal) * 100)
    : 0

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 14 }}>
        <Col>
          <Space direction="vertical" size={2}>
            <Title level={3} style={{ margin: 0 }}>Tổng quan vận hành</Title>
            <Text type="secondary">{today} · {user?.ho_ten} ({user?.role})</Text>
          </Space>
        </Col>
        <Col>
          <Space>
            <Link to="/sales/orders/new"><Button type="primary" icon={<ShoppingCartOutlined />}>Tạo đơn hàng</Button></Link>
            <Link to="/production/queue"><Button icon={<ClockCircleOutlined />}>KH SX chờ</Button></Link>
          </Space>
        </Col>
      </Row>

      {isLoading && <Skeleton active paragraph={{ rows: 8 }} />}

      {!isLoading && (
        <>
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Đơn mới hôm nay"
                  value={stats?.don_hang_moi_hom_nay ?? 0}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: '#1b168e' }}
                />
                <Text type="secondary">Doanh thu: {fmtMoney(sales?.doanh_thu_hom_nay)}</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Việc chờ xử lý"
                  value={stats?.cho_duyet ?? 0}
                  prefix={<AlertOutlined />}
                  valueStyle={{ color: '#ff8200' }}
                />
                <Text type="secondary">Báo giá + đơn hàng cần duyệt</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Đang sản xuất"
                  value={stats?.dang_san_xuat ?? 0}
                  prefix={<ToolOutlined />}
                  valueStyle={{ color: '#389e0d' }}
                />
                <Text type="secondary">{production?.lenh_sx_tre || 0} lệnh trễ kế hoạch</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Giá trị tồn kho"
                  value={warehouse?.tong_gia_tri_ton || 0}
                  prefix={<InboxOutlined />}
                  formatter={v => fmtMoney(Number(v))}
                  valueStyle={{ color: '#1b168e' }}
                />
                <Text type="secondary">{warehouse?.ton_thap?.length || 0} mặt hàng dưới tồn tối thiểu</Text>
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            <Col xs={24} xl={8}>
              <Card size="small" title="Việc cần xử lý">
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <WorkItem title="Báo giá mới cần theo dõi" value={sales?.bao_gia_moi || 0} href="/quotes" tone="orange" />
                  <WorkItem title="Đơn hàng chờ duyệt" value={sales?.don_hang_cho_duyet || 0} href="/sales/orders" tone="orange" />
                  <WorkItem title="Lệnh sản xuất mới" value={production?.lenh_sx_moi || 0} href="/production/orders" />
                  <WorkItem title="Phiếu giao hàng chờ xuất" value={warehouse?.giao_hang_cho_xuat || 0} href="/warehouse/delivery" tone="green" />
                  <WorkItem title="Đơn mua hàng chờ duyệt" value={purchase?.po_cho_duyet || 0} href="/purchasing/orders" />
                </Space>
              </Card>
            </Col>

            <Col xs={24} xl={8}>
              <Card size="small" title="Sản xuất hôm nay">
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <Statistic title="Lệnh mới" value={production?.lenh_sx_moi || 0} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="Hoàn thành" value={production?.lenh_sx_hoan_thanh_hom_nay || 0} valueStyle={{ color: '#389e0d' }} />
                  </Col>
                </Row>
                <div style={{ marginTop: 12 }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text type="secondary">Tỷ lệ hoàn tất trong ngày</Text>
                    <Text strong>{productionDonePct}%</Text>
                  </Space>
                  <Progress percent={productionDonePct} strokeColor="#ff8200" showInfo={false} />
                </div>
                {(production?.lenh_sx_tre || 0) > 0 && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="warning"
                    showIcon
                    message={`${production?.lenh_sx_tre} lệnh sản xuất đang trễ kế hoạch`}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} xl={8}>
              <Card size="small" title="Kho và giao hàng">
                <Row gutter={[12, 12]}>
                  <Col span={8}>
                    <Statistic title="Nhập kho" value={warehouse?.phieu_nhap_hom_nay || 0} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Xuất NVL" value={warehouse?.phieu_xuat_nvl_hom_nay || 0} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Giao TP" value={warehouse?.phieu_giao_hom_nay || 0} />
                  </Col>
                </Row>
                <Space wrap style={{ marginTop: 12 }}>
                  <Tag color="blue"><TruckOutlined /> Cần giao 7 ngày: {sales?.don_hang_can_giao || 0}</Tag>
                  <Tag color="orange"><InboxOutlined /> PO đang về: {purchase?.po_dang_ve || 0}</Tag>
                </Space>
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            <Col xs={24} lg={14}>
              <Card
                size="small"
                title="Cảnh báo tồn kho"
                extra={<Link to="/warehouse/inventory">Xem tồn kho</Link>}
              >
                {warehouse?.ton_thap?.length ? (
                  <List
                    size="small"
                    dataSource={warehouse.ton_thap}
                    renderItem={item => {
                      const pct = Math.min(100, Math.round((item.ton_luong / Math.max(item.ton_toi_thieu, 1)) * 100))
                      return (
                        <List.Item>
                          <div style={{ width: '100%' }}>
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Text strong>{item.ten_hang}</Text>
                              <Text type="secondary">{item.ten_kho}</Text>
                            </Space>
                            <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 4 }}>
                              <Progress percent={pct} size="small" showInfo={false} strokeColor="#cf1322" style={{ flex: 1, marginRight: 12 }} />
                              <Text style={{ whiteSpace: 'nowrap' }}>
                                {fmtNum(item.ton_luong, 2)} / {fmtNum(item.ton_toi_thieu, 2)} {item.don_vi}
                              </Text>
                            </Space>
                          </div>
                        </List.Item>
                      )
                    }}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có cảnh báo tồn tối thiểu" />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={10}>
              <Card size="small" title="Lối tắt nghiệp vụ">
                <Row gutter={[8, 8]}>
                  {[
                    { label: 'Báo giá', path: '/quotes', icon: <DollarOutlined /> },
                    { label: 'Đơn hàng', path: '/sales/orders', icon: <ShoppingCartOutlined /> },
                    { label: 'Lệnh SX', path: '/production/orders', icon: <ToolOutlined /> },
                    { label: 'Tồn kho', path: '/warehouse/inventory', icon: <InboxOutlined /> },
                    { label: 'Giao hàng', path: '/warehouse/delivery', icon: <TruckOutlined /> },
                    { label: 'Kiểm kê', path: '/warehouse/stock-adjustments', icon: <CheckCircleOutlined /> },
                  ].map(item => (
                    <Col span={12} key={item.path}>
                      <Link to={item.path}>
                        <Button block icon={item.icon} style={{ textAlign: 'left' }}>
                          {item.label}
                        </Button>
                      </Link>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
