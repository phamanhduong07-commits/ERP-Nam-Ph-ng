import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Col, Row, Space, Spin, Statistic, Typography, Button, Table, Tag, Modal } from 'antd'
import {
  PrinterOutlined, BarChartOutlined, HistoryOutlined,
  BarcodeOutlined, CheckCircleOutlined, ReloadOutlined, MobileOutlined, EyeOutlined
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import { cd2Api, PhieuIn } from '../../api/cd2'

dayjs.extend(relativeTime)
dayjs.locale('vi')
import PhieuInModal from './PhieuInModal'
import CD2WorkshopSelector from '../../components/CD2WorkshopSelector'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'

const { Title, Text } = Typography

const MAIN_STATES = [
  { key: 'cho_in',        label: 'Chờ in',        color: '#d46b08', bg: '#fff7e6', border: '#ffd591' },
  { key: 'ke_hoach',      label: 'Kế hoạch',      color: '#0958d9', bg: '#e6f4ff', border: '#91caff' },
  { key: 'dang_in',       label: 'Đang in',        color: '#d4380d', bg: '#fff2e8', border: '#ffbb96' },
  { key: 'cho_dinh_hinh', label: 'Chờ định hình', color: '#531dab', bg: '#f9f0ff', border: '#d3adf7' },
]

export default function CD2DashboardPage() {
  const qc = useQueryClient()
  const [selectedPhieu, setSelectedPhieu] = useState<PhieuIn | null>(null)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cd2-dashboard', phanXuongId],
    queryFn: () => cd2Api.getDashboard(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: dangInList = [] } = useQuery({
    queryKey: ['cd2-phieu-dang-in', phanXuongId],
    queryFn: () => cd2Api.listPhieuIn({ trang_thai: 'dang_in', ...(phanXuongId ? { phan_xuong_id: phanXuongId } : {}) }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: machineStatus = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['cd2-machine-status', phanXuongId],
    queryFn: () => cd2Api.getMachinesStatus(phanXuongId).then(r => r.data),
    refetchInterval: 10_000, // Tự động cập nhật mỗi 10 giây
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cd2-dashboard'] })
    qc.invalidateQueries({ queryKey: ['cd2-phieu-dang-in'] })
    qc.invalidateQueries({ queryKey: ['cd2-kanban'] })
    qc.invalidateQueries({ queryKey: ['cd2-machine-status'] })
  }

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
            <CD2WorkshopSelector value={phanXuongId} onChange={setPhanXuongId} phanXuongList={phanXuongList} />
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

      {/* 4 trạng thái chính — có icon máy in */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {MAIN_STATES.map(({ key, label, color, bg, border }) => (
          <Col xs={12} sm={6} key={key}>
            <Card
              size="small"
              style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10 }}
              styles={{ body: { padding: '16px 16px 14px' } }}
            >
              <PrinterOutlined style={{ fontSize: 20, color, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 34, fontWeight: 700, color, lineHeight: 1 }}>
                {counts[key] ?? 0}
              </div>
              <div style={{ fontSize: 12, color: '#595959', marginTop: 8 }}>{label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Giám sát máy móc trực tuyến (OEE) */}
      <Card 
        size="small" 
        title={<Space><MobileOutlined style={{color: '#52c41a'}} /> <span style={{color: '#1a337e'}}>Giám sát Máy móc trực tuyến (OEE)</span></Space>}
        style={{ marginBottom: 20, borderRadius: 12, border: '1px solid #d9f7be' }}
        styles={{ header: { background: '#f6ffed' } }}
        extra={
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setShowMobilePreview(true)}>Xem giao diện công nhân</Button>
            <Text type="secondary" style={{fontSize: 12}}>Cập nhật: {dayjs().format('HH:mm:ss')}</Text>
          </Space>
        }
      >
        <Table
          dataSource={machineStatus}
          rowKey="id"
          size="small"
          pagination={false}
          loading={loadingMachines}
          columns={[
            { title: 'Tên máy', dataIndex: 'ten_may', render: (v, r) => (
              <Space>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.status === 'running' ? '#52c41a' : r.status === 'stopped' ? '#f5222d' : '#d9d9d9' }} />
                <Text strong>{v}</Text>
              </Space>
            )},
            { title: 'Trạng thái', dataIndex: 'status', render: v => (
              <Tag color={v === 'RUNNING' ? 'success' : v === 'STOPPED' ? 'warning' : v === 'ERROR' ? 'error' : 'default'}>
                {v === 'RUNNING' ? 'ĐANG CHẠY' : v === 'STOPPED' ? 'TẠM DỪNG' : v === 'ERROR' ? 'MÁY LỖI' : 'ĐANG NGHỈ'}
              </Tag>
            )},
            { title: 'Lệnh sản xuất', dataIndex: 'current_lsx', render: (v, r) => v ? (
              <div>
                <Text code>{v}</Text> <br />
                <Text type="secondary" style={{fontSize: 11}}>{r.current_order_name}</Text>
              </div>
            ) : '—' },
            { title: 'Vận hành', dataIndex: 'worker' },
            { title: 'Lý do / Ghi chú', dataIndex: 'reason', render: v => v ? <Text type="danger">{v}</Text> : '—' },
            { title: 'Cập nhật cuối', dataIndex: 'last_event_time', render: v => v ? dayjs(v).fromNow() : '—' },
          ]}
        />
      </Card>

      {/* Phiếu đang in — quick action */}
      {dangInList.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <PrinterOutlined style={{ color: '#fa8c16' }} />
              <span style={{ color: '#d4380d' }}>Đang in ({dangInList.length})</span>
            </Space>
          }
          style={{ marginBottom: 16, border: '1px solid #ffbb96' }}
          styles={{ header: { background: '#fff2e8' } }}
        >
          <Table<PhieuIn>
            dataSource={dangInList}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Số phiếu', dataIndex: 'so_phieu', width: 150 },
              { title: 'Tên hàng', dataIndex: 'ten_hang', render: v => v || '—' },
              { title: 'Khách hàng', dataIndex: 'ten_khach_hang', render: v => v || '—' },
              { title: 'Máy in', dataIndex: 'ten_may', render: v => v ? <Tag color="orange">{v}</Tag> : '—' },
              { title: 'SL phôi', dataIndex: 'so_luong_phoi', render: v => v?.toLocaleString('vi-VN') ?? '—', align: 'right' },
              {
                title: '',
                width: 110,
                render: (_, rec) => (
                  <Button size="small" type="primary" onClick={() => setSelectedPhieu(rec)}>
                    Xử lý
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* Hoàn thành hôm nay + Sau in + Hoàn thành tổng */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={8}>
          <Card
            size="small"
            style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 10 }}
            styles={{ body: { padding: '16px' } }}
          >
            <Space>
              <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#389e0d', lineHeight: 1 }}>
                  {data?.in_hoan_thanh_hom_nay ?? 0}
                </div>
                <div style={{ fontSize: 12, color: '#595959', marginTop: 6 }}>Phiếu hoàn thành hôm nay</div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: '14px 16px' } }}>
            <Statistic
              title="Sau in"
              value={counts['sau_in'] ?? 0}
              valueStyle={{ color: '#08979c', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: '14px 16px' } }}>
            <Statistic
              title="Hoàn thành"
              value={counts['hoan_thanh'] ?? 0}
              valueStyle={{ color: '#389e0d', fontSize: 28 }}
            />
          </Card>
        </Col>
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
          <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
            {mayStats.map((m: any) => (
              <Col xs={24} sm={12} md={8} key={m.may_scan_id}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <PrinterOutlined style={{ color: '#1677ff' }} />
                      <Text strong style={{ fontSize: 13 }}>{m.ten_may}</Text>
                    </Space>
                  }
                  extra={
                    <Link to="/production/cd2/scan">
                      <Button size="small" type="link" icon={<BarcodeOutlined />} />
                    </Link>
                  }
                >
                  <Row gutter={8}>
                    <Col span={8}>
                      <Statistic title="Lần scan" value={m.so_lan} valueStyle={{ fontSize: 18 }} />
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

      {/* Truy cập nhanh */}
      <Title level={5} style={{ marginTop: 8, marginBottom: 10, color: '#595959' }}>
        Truy cập nhanh
      </Title>
      <Row gutter={[12, 12]}>
        {[
          { to: '/production/cd2',              icon: <PrinterOutlined />,  label: 'Kanban máy in',    color: '#1677ff' },
          { to: '/production/cd2/mobile-tracking', icon: <MobileOutlined />, label: 'Báo cáo máy (Mobile)', color: '#52c41a' },
          { to: '/production/cd2/scan',         icon: <BarcodeOutlined />,  label: 'Scan sản lượng',   color: '#722ed1' },
          { to: '/production/cd2/scan-history', icon: <HistoryOutlined />,  label: 'Lịch sử scan',     color: '#08979c' },
          { to: '/production/cd2/history',      icon: <HistoryOutlined />,  label: 'Lịch sử phiếu in', color: '#d46b08' },
        ].map(item => (
          <Col xs={12} sm={6} key={item.to}>
            <Link to={item.to}>
              <Card
                size="small"
                hoverable
                style={{ textAlign: 'center', borderRadius: 10 }}
                styles={{ body: { padding: '16px 8px' } }}
              >
                <div style={{ fontSize: 24, color: item.color }}>{item.icon}</div>
                <Text style={{ fontSize: 12 }}>{item.label}</Text>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      {selectedPhieu && (
        <PhieuInModal
          phieu={selectedPhieu}
          open
          onClose={() => setSelectedPhieu(null)}
          onSaved={() => { setSelectedPhieu(null); invalidate(); refetch() }}
        />
      )}
      {showMobilePreview && (
        <Modal
          open={showMobilePreview}
          onCancel={() => setShowMobilePreview(false)}
          footer={null}
          width={400}
          centered
          styles={{ content: { padding: 0, overflow: 'hidden', borderRadius: 32, border: '8px solid #333' } }}
          title={null}
          closable={false}
        >
          <div style={{ height: 700, overflow: 'auto', position: 'relative' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#333', color: '#fff', textAlign: 'center', padding: '4px 0', fontSize: 12 }}>
              Màn hình giả lập (Mobile) - <Button type="link" size="small" onClick={() => setShowMobilePreview(false)} style={{color:'#fff'}}>Đóng</Button>
            </div>
            <iframe 
              src={`${window.location.origin}/production/cd2/mobile-tracking`} 
              style={{ width: '100%', height: 'calc(100% - 24px)', border: 'none' }} 
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
