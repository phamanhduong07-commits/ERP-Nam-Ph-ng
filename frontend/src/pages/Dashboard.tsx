import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Empty, List, Progress, Row, Skeleton, Space,
  Statistic, Tag, Typography, Divider
} from 'antd'
import {
  AlertOutlined, ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined,
  DollarOutlined, InboxOutlined, ShoppingCartOutlined, ToolOutlined,
  TruckOutlined, AreaChartOutlined, WalletOutlined, RobotOutlined,
  ThunderboltOutlined, AuditOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import client from '../api/client'

const { Title, Text, Paragraph } = Typography

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
    doanh_thu_hom_nay: number
    doanh_thu_thang: number
    don_hang_cho_duyet: number
    bao_gia_moi: number
    don_hang_can_giao: number
  }
  production?: {
    lenh_sx_moi: number
    dang_san_xuat: number
    lenh_sx_tre: number
    lenh_sx_hoan_thanh_hom_nay: number
  }
  warehouse?: {
    tong_gia_tri_ton: number
    giao_hang_cho_xuat: number
    ton_thap: LowStockRow[]
    phieu_nhap_hom_nay: number
    phieu_xuat_nvl_hom_nay: number
    phieu_giao_hom_nay: number
  }
  accounting?: {
    phieu_thu_cho_duyet: number
    phieu_chi_cho_duyet: number
    ar_tien_qua_han: number
    ap_tien_qua_han: number
    doanh_thu_thang_truoc: number
  }
  purchase?: {
    po_cho_duyet: number
    po_dang_ve: number
  }
}

const KPICard = ({ title, value, suffix, icon, color, gradient }: any) => (
  <Card 
    variant="borderless" 
    style={{ 
      borderRadius: 16, 
      background: gradient || '#fff',
      boxShadow: gradient ? '0 8px 24px rgba(27, 22, 142, 0.15)' : '0 4px 12px rgba(0,0,0,0.03)',
      overflow: 'hidden'
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Text style={{ color: gradient ? 'rgba(255,255,255,0.8)' : '#8c8c8c', fontSize: 13 }}>{title}</Text>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <Title level={3} style={{ margin: 0, color: gradient ? '#fff' : '#1b168e', fontWeight: 800 }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Title>
          {suffix && <Text style={{ color: gradient ? 'rgba(255,255,255,0.8)' : '#8c8c8c', fontSize: 12 }}>{suffix}</Text>}
        </div>
      </div>
      <div style={{ 
        width: 40, 
        height: 40, 
        borderRadius: 10, 
        background: gradient ? 'rgba(255,255,255,0.2)' : `${color}15`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: gradient ? '#fff' : color,
        fontSize: 20
      }}>
        {icon}
      </div>
    </div>
  </Card>
)

const QuickLink = ({ icon, label, path, color }: any) => (
  <Link to={path}>
    <Card 
      hoverable 
      size="small" 
      styles={{ body: { padding: '12px 8px' } }}
    >
      <div style={{ color: color, fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <Text strong style={{ fontSize: 12, display: 'block' }}>{label}</Text>
    </Card>
  </Link>
)

export default function Dashboard() {
  const { user } = useAuthStore()
  const todayStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => client.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return <div style={{ padding: 40 }}><Skeleton active paragraph={{ rows: 10 }} /></div>

  const sales = stats?.sales
  const prod = stats?.production
  const wh = stats?.warehouse
  const acc = stats?.accounting

  return (
    <div style={{ padding: '24px 40px', background: '#f8f9fc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#1b168e' }}>Chào {user?.ho_ten} 👋</Title>
          <Text type="secondary">{todayStr} · Chúc bạn một ngày làm việc hiệu quả!</Text>
        </div>
        <Space size={12}>
          <Button icon={<RobotOutlined />} size="large" style={{ borderRadius: 10 }}>Hỏi AI</Button>
          <Link to="/sales/orders/new">
            <Button type="primary" icon={<ShoppingCartOutlined />} size="large" style={{ borderRadius: 10, background: '#1b168e', border: 'none' }}>Tạo đơn mới</Button>
          </Link>
        </Space>
      </div>

      {/* Main KPIs */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard 
            title="Doanh thu tháng này" 
            value={sales?.doanh_thu_thang || 0} 
            suffix="VND"
            icon={<DollarOutlined />} 
            gradient="linear-gradient(135deg, #1b168e 0%, #3a32cc 100%)" 
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard 
            title="Giá trị kho hàng" 
            value={wh?.tong_gia_tri_ton || 0} 
            suffix="VND"
            icon={<WalletOutlined />} 
            color="#722ed1" 
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard 
            title="Đang sản xuất" 
            value={prod?.dang_san_xuat || 0} 
            suffix="LSX"
            icon={<ToolOutlined />} 
            color="#52c41a" 
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard 
            title="Công nợ quá hạn" 
            value={acc?.ar_tien_qua_han || 0} 
            suffix="VND"
            icon={<AlertOutlined />} 
            color="#f5222d" 
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={16}>
          {/* Production & Sales Status */}
          <Card variant="borderless" style={{ borderRadius: 20, marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Title level={4} style={{ margin: 0 }}>Vận hành Sản xuất</Title>
              <Link to="/production/plans"><Button type="link">Xem kế hoạch <ArrowRightOutlined /></Button></Link>
            </div>
            <Row gutter={32}>
              <Col span={12}>
                <div style={{ padding: '20px', background: '#f0f2f5', borderRadius: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>Lệnh mới cần chạy</Text>
                      <Tag color="blue">{prod?.lenh_sx_moi || 0}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>Lệnh đang chạy</Text>
                      <Tag color="processing">{prod?.dang_san_xuat || 0}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>Lệnh trễ hạn</Text>
                      <Tag color="error">{prod?.lenh_sx_tre || 0}</Tag>
                    </div>
                  </Space>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Progress 
                    type="dashboard" 
                    percent={Math.round(((prod?.lenh_sx_hoan_thanh_hom_nay || 0) / Math.max(1, (prod?.lenh_sx_moi || 0) + (prod?.dang_san_xuat || 0))) * 100)} 
                    strokeColor="#1b168e"
                    size={120}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Text strong style={{ fontSize: 16 }}>{prod?.lenh_sx_hoan_thanh_hom_nay || 0} Lệnh hoàn thành</Text>
                    <br/>
                    <Text type="secondary">Trong ngày hôm nay</Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          <Row gutter={24}>
            <Col span={12}>
              <Card title="Kho & Giao nhận" variant="borderless" style={{ borderRadius: 20, height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <List size="small">
                  <List.Item extra={<Text strong>{wh?.phieu_nhap_hom_nay || 0}</Text>}>Nhập kho nguyên liệu</List.Item>
                  <List.Item extra={<Text strong>{wh?.phieu_xuat_nvl_hom_nay || 0}</Text>}>Xuất NVL sản xuất</List.Item>
                  <List.Item extra={<Text strong>{wh?.phieu_giao_hom_nay || 0}</Text>}>Giao thành phẩm</List.Item>
                  <List.Item extra={<Text strong style={{ color: '#f5222d' }}>{wh?.giao_hang_cho_xuat || 0}</Text>}>Chờ xuất kho giao</List.Item>
                </List>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Phê duyệt & Tài chính" variant="borderless" style={{ borderRadius: 20, height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <List size="small">
                  <List.Item extra={<Tag color="orange">{sales?.don_hang_cho_duyet || 0}</Tag>}>Đơn hàng chờ duyệt</List.Item>
                  <List.Item extra={<Tag color="orange">{stats?.purchase?.po_cho_duyet || 0}</Tag>}>Đơn mua (PO) chờ duyệt</List.Item>
                  <List.Item extra={<Tag color="cyan">{acc?.phieu_thu_cho_duyet || 0}</Tag>}>Phiếu thu chờ duyệt</List.Item>
                  <List.Item extra={<Tag color="magenta">{acc?.phieu_chi_cho_duyet || 0}</Tag>}>Phiếu chi chờ duyệt</List.Item>
                </List>
              </Card>
            </Col>
          </Row>
        </Col>

        <Col span={8}>
          {/* Quick Actions */}
          <Card title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /> Lối tắt nghiệp vụ</Space>} variant="borderless" style={{ borderRadius: 20, marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <Row gutter={[12, 12]}>
              <Col span={8}><QuickLink label="LSX" path="/production/orders" icon={<ToolOutlined />} color="#1890ff" /></Col>
              <Col span={8}><QuickLink label="Tồn kho" path="/warehouse/inventory" icon={<InboxOutlined />} color="#52c41a" /></Col>
              <Col span={8}><QuickLink label="Giao hàng" path="/sales/giao-hang" icon={<TruckOutlined />} color="#722ed1" /></Col>
              <Col span={8}><QuickLink label="Giá thành" path="/reports/hub" icon={<AreaChartOutlined />} color="#eb2f96" /></Col>
              <Col span={8}><QuickLink label="Công nợ" path="/reports/debt-summary" icon={<AuditOutlined />} color="#2f54eb" /></Col>
              <Col span={8}><QuickLink label="Báo giá" path="/quotes" icon={<DollarOutlined />} color="#faad14" /></Col>
            </Row>
          </Card>

          {/* Low Stock Alerts */}
          <Card 
            title={<Space><AlertOutlined style={{ color: '#f5222d' }} /> Cảnh báo tồn kho</Space>} 
            variant="borderless" 
            style={{ borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
            extra={<Link to="/warehouse/inventory">Xem hết</Link>}
          >
            {wh?.ton_thap && wh.ton_thap.length > 0 ? (
              <List
                size="small"
                dataSource={wh.ton_thap.slice(0, 5)}
                renderItem={item => (
                  <List.Item style={{ padding: '12px 0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 13 }}>{item.ten_hang}</Text>
                        <Text type="danger" strong>{item.ton_luong} {item.don_vi}</Text>
                      </div>
                      <Progress percent={Math.round((item.ton_luong / item.ton_toi_thieu) * 100)} size="small" status="exception" showInfo={false} />
                      <Text type="secondary" style={{ fontSize: 11 }}>Tối thiểu: {item.ton_toi_thieu} {item.don_vi}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Mọi thứ đều ổn định" />
            )}
          </Card>
        </Col>
      </Row>

      <style>{`
        .ant-card-title {
          font-weight: 700 !important;
          color: #262626 !important;
        }
        .ant-card {
          transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
        }
        .ant-card-hoverable:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(27, 22, 142, 0.08) !important;
        }
      `}</style>
    </div>
  )
}
