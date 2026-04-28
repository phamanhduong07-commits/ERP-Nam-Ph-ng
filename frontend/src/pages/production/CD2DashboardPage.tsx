import { useQuery } from '@tanstack/react-query'
import { Card, Col, Row, Space, Spin, Statistic, Tag, Typography, Button } from 'antd'
import {
  PrinterOutlined, BarChartOutlined, HistoryOutlined,
  BarcodeOutlined, CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { cd2Api, TRANG_THAI_LABELS } from '../../api/cd2'

const { Title, Text } = Typography

const STATE_CONFIG: { key: string; color: string; bg: string }[] = [
  { key: 'cho_in',        color: '#d46b08', bg: '#fff7e6' },
  { key: 'ke_hoach',      color: '#0958d9', bg: '#e6f4ff' },
  { key: 'dang_in',       color: '#d4380d', bg: '#fff2e8' },
  { key: 'cho_dinh_hinh', color: '#531dab', bg: '#f9f0ff' },
  { key: 'sau_in',        color: '#08979c', bg: '#e6fffb' },
  { key: 'hoan_thanh',    color: '#389e0d', bg: '#f6ffed' },
]

export default function CD2DashboardPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cd2-dashboard'],
    queryFn: () => cd2Api.getDashboard().then(r => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading) return <Spin style={{ margin: 40 }} />

  const counts = data?.phieu_in_counts ?? {}
  const scan = data?.scan_24h ?? { so_lan: 0, so_luong_tp: 0, dien_tich: 0, tien_luong: 0 }
  const mayStats = data?.may_scan_stats ?? []

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space>
            <BarChartOutlined style={{ fontSize: 22, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Tổng quan Công Đoạn 2</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
            <Link to="/production/cd2">
              <Button type="primary" icon={<PrinterOutlined />}>Kanban máy in</Button>
            </Link>
          </Space>
        </Col>
      </Row>

      {/* Trạng thái phiếu in */}
      <Title level={5} style={{ marginBottom: 10, color: '#595959' }}>
        Phiếu in — theo trạng thái
      </Title>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {STATE_CONFIG.map(({ key, color, bg }) => (
          <Col xs={12} sm={8} md={4} key={key}>
            <Card
              size="small"
              style={{ background: bg, border: `1px solid ${color}33`, textAlign: 'center' }}
              styles={{ body: { padding: '14px 8px' } }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>
                {counts[key] ?? 0}
              </div>
              <div style={{ fontSize: 12, color: '#595959', marginTop: 6 }}>
                {TRANG_THAI_LABELS[key]}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Scan 24 giờ qua */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 10 }}>
        <Title level={5} style={{ margin: 0, color: '#595959' }}>
          Scan sản lượng — 24 giờ qua
        </Title>
        <Link to="/production/cd2/scan">
          <Button size="small" icon={<BarcodeOutlined />}>Vào trang scan</Button>
        </Link>
      </Row>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Số lần scan"
              value={scan.so_lan}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="SL thành phẩm"
              value={scan.so_luong_tp}
              formatter={v => Number(v).toLocaleString('vi-VN')}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Tổng diện tích"
              value={scan.dien_tich}
              suffix="m²"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Tổng tiền lương"
              value={scan.tien_luong}
              valueStyle={{ color: '#52c41a' }}
              formatter={v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'}
            />
          </Card>
        </Col>
      </Row>

      {/* Phiếu in hoàn thành hôm nay */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}
          >
            <Space>
              <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#389e0d', lineHeight: 1 }}>
                  {data?.in_hoan_thanh_hom_nay ?? 0}
                </div>
                <div style={{ fontSize: 12, color: '#595959' }}>Phiếu hoàn thành hôm nay</div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Thống kê theo máy scan */}
      {mayStats.length > 0 && (
        <>
          <Row justify="space-between" align="middle" style={{ marginBottom: 10 }}>
            <Title level={5} style={{ margin: 0, color: '#595959' }}>
              Sản lượng theo máy scan — 24 giờ qua
            </Title>
            <Link to="/production/cd2/scan-history">
              <Button size="small" icon={<HistoryOutlined />}>Xem lịch sử</Button>
            </Link>
          </Row>
          <Row gutter={[12, 12]}>
            {mayStats.map(m => (
              <Col xs={24} sm={12} md={8} key={m.may_scan_id}>
                <Card
                  size="small"
                  title={<Tag color="blue" style={{ margin: 0 }}>{m.ten_may}</Tag>}
                  extra={
                    <Link to="/production/cd2/scan">
                      <Button size="small" type="link" icon={<BarcodeOutlined />} />
                    </Link>
                  }
                >
                  <Row gutter={8}>
                    <Col span={8}>
                      <Statistic
                        title="Lần scan"
                        value={m.so_lan}
                        valueStyle={{ fontSize: 18 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="SL TP"
                        value={m.sl_tp}
                        valueStyle={{ fontSize: 18 }}
                        formatter={v => Number(v).toLocaleString('vi-VN')}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="Lương"
                        value={m.tien_luong}
                        valueStyle={{ fontSize: 18, color: '#52c41a' }}
                        formatter={v =>
                          Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'
                        }
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      {/* Quick links */}
      <Title level={5} style={{ marginTop: 24, marginBottom: 10, color: '#595959' }}>
        Truy cập nhanh
      </Title>
      <Row gutter={[12, 12]}>
        {[
          { to: '/production/cd2', icon: <PrinterOutlined />, label: 'Kanban máy in', color: '#1677ff' },
          { to: '/production/cd2/scan', icon: <BarcodeOutlined />, label: 'Scan sản lượng', color: '#722ed1' },
          { to: '/production/cd2/scan-history', icon: <HistoryOutlined />, label: 'Lịch sử scan', color: '#08979c' },
          { to: '/production/cd2/history', icon: <HistoryOutlined />, label: 'Lịch sử phiếu in', color: '#d46b08' },
        ].map(item => (
          <Col xs={12} sm={6} key={item.to}>
            <Link to={item.to}>
              <Card
                size="small"
                hoverable
                style={{ textAlign: 'center' }}
                styles={{ body: { padding: '16px 8px' } }}
              >
                <div style={{ fontSize: 24, color: item.color }}>{item.icon}</div>
                <Text style={{ fontSize: 12 }}>{item.label}</Text>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  )
}
