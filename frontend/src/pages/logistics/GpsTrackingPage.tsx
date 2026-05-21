import { useEffect, useRef, useState } from 'react'
import {
  Alert, Badge, Button, Card, Col, Progress, Row, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  CarOutlined, EnvironmentOutlined, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import client from '../../api/client'

const { Text, Title } = Typography

interface GpsVehicle {
  gps_id: string
  plate: string
  lat: number | null
  lng: number | null
  speed: number
  fuel_pct: number
  driver_name: string
  address: string
  vehicle_type: string
  capacity: string
  km_today: number | null
  km_total: number
  time_update: string
  is_stop: boolean
  is_overspeed: boolean
  stop_time: string
  stop_counter: number
  day_driving_time: number
  status: 'moving' | 'stopped' | 'overspeed'
  xe_id: number | null
  loai_xe_erp: string | null
  trong_tai: number | null
  dinh_muc_dau: number | null
}

interface GpsResponse {
  vehicles: GpsVehicle[]
  total: number
  moving: number
  stopped: number
  overspeed: number
  cache_age_seconds: number
}

const STATUS_CONFIG = {
  moving: { color: '#52c41a', text: 'Đang chạy', badgeStatus: 'success' as const },
  stopped: { color: '#faad14', text: 'Đứng', badgeStatus: 'warning' as const },
  overspeed: { color: '#ff4d4f', text: 'Quá tốc', badgeStatus: 'error' as const },
}

const REFRESH_INTERVAL = 30

export default function GpsTrackingPage() {
  const [data, setData] = useState<GpsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await client.get<GpsResponse>('/gps/vehicles')
      const payload = res.data
      if (!payload || !Array.isArray(payload.vehicles)) {
        throw new Error('Dữ liệu GPS không hợp lệ — thử khởi động lại backend')
      }
      setData(payload)
      setError(null)
      setLastFetch(new Date())
      setCountdown(REFRESH_INTERVAL)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Không kết nối được GPS API'
      setError(msg)
      console.error('GPS fetch error', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    timerRef.current = setInterval(fetchData, REFRESH_INTERVAL * 1000)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL : prev - 1))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const handleManualRefresh = async () => {
    try { await client.get('/gps/vehicles/refresh') } catch { /* ignore */ }
    await fetchData()
  }

  const openGpsMap = (vehicle: GpsVehicle) => {
    if (vehicle.lat && vehicle.lng) {
      window.open(
        `https://maps.google.com/maps?q=${vehicle.lat},${vehicle.lng}&z=15`,
        '_blank',
      )
    }
  }

  const columns = [
    {
      title: 'Biển số',
      dataIndex: 'plate',
      key: 'plate',
      width: 120,
      render: (plate: string, record: GpsVehicle) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 15 }}>{plate}</Text>
          {record.loai_xe_erp && (
            <Text type="secondary" style={{ fontSize: 11 }}>{record.loai_xe_erp}</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: GpsVehicle) => {
        const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
        return (
          <Space direction="vertical" size={2}>
            <Badge status={cfg.badgeStatus} text={
              <Text style={{ color: cfg.color, fontWeight: 600 }}>{cfg.text}</Text>
            } />
            {record.is_stop && record.stop_time && record.stop_time !== '00:00:00' && (
              <Text type="secondary" style={{ fontSize: 11 }}>⏱ {record.stop_time}</Text>
            )}
          </Space>
        )
      },
      filters: [
        { text: 'Đang chạy', value: 'moving' },
        { text: 'Đứng', value: 'stopped' },
        { text: 'Quá tốc', value: 'overspeed' },
      ],
      onFilter: (value: unknown, record: GpsVehicle) => record.status === value,
    },
    {
      title: 'Tốc độ',
      dataIndex: 'speed',
      key: 'speed',
      width: 90,
      sorter: (a: GpsVehicle, b: GpsVehicle) => a.speed - b.speed,
      render: (speed: number, record: GpsVehicle) => (
        <Text style={{ color: record.is_overspeed ? '#ff4d4f' : undefined, fontWeight: record.is_overspeed ? 700 : 400 }}>
          {speed} km/h
        </Text>
      ),
    },
    {
      title: 'Nhiên liệu',
      dataIndex: 'fuel_pct',
      key: 'fuel_pct',
      width: 120,
      sorter: (a: GpsVehicle, b: GpsVehicle) => a.fuel_pct - b.fuel_pct,
      render: (fuel: number) => {
        const pct = fuel ?? 0
        const color = pct > 50 ? '#52c41a' : pct > 20 ? '#faad14' : '#ff4d4f'
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Progress
              percent={pct}
              size="small"
              strokeColor={color}
              showInfo={false}
              style={{ marginBottom: 0 }}
            />
            <Text style={{ fontSize: 12, color }}>{pct}%</Text>
          </Space>
        )
      },
    },
    {
      title: 'Lái xe',
      dataIndex: 'driver_name',
      key: 'driver_name',
      width: 150,
      render: (name: string) => name || <Text type="secondary">—</Text>,
    },
    {
      title: 'Địa chỉ hiện tại',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (address: string, record: GpsVehicle) => (
        <Space>
          <Tooltip title={address}>
            <Text ellipsis style={{ maxWidth: 260 }}>{address || '—'}</Text>
          </Tooltip>
          {record.lat && record.lng && (
            <Tooltip title="Xem trên Google Maps">
              <Button
                type="link"
                size="small"
                icon={<EnvironmentOutlined />}
                onClick={() => openGpsMap(record)}
                style={{ padding: 0 }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Km hôm nay',
      dataIndex: 'km_today',
      key: 'km_today',
      width: 110,
      sorter: (a: GpsVehicle, b: GpsVehicle) => (a.km_today ?? 0) - (b.km_today ?? 0),
      render: (km: number | null) => km != null ? `${km.toFixed(1)} km` : '—',
    },
    {
      title: 'Km tổng',
      dataIndex: 'km_total',
      key: 'km_total',
      width: 100,
      sorter: (a: GpsVehicle, b: GpsVehicle) => (a.km_total ?? 0) - (b.km_total ?? 0),
      render: (km: number) => km != null
        ? <Text>{km.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} km</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Lái ngày',
      dataIndex: 'day_driving_time',
      key: 'day_driving_time',
      width: 90,
      sorter: (a: GpsVehicle, b: GpsVehicle) => (a.day_driving_time ?? 0) - (b.day_driving_time ?? 0),
      render: (minutes: number) => {
        if (minutes == null) return <Text type="secondary">—</Text>
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        const color = minutes >= 600 ? '#ff4d4f' : minutes >= 240 ? '#faad14' : undefined
        return <Text style={{ color }}>{h > 0 ? `${h}g${m}p` : `${m}p`}</Text>
      },
    },
    {
      title: 'Số lần dừng',
      dataIndex: 'stop_counter',
      key: 'stop_counter',
      width: 95,
      sorter: (a: GpsVehicle, b: GpsVehicle) => (a.stop_counter ?? 0) - (b.stop_counter ?? 0),
      render: (n: number) => n != null
        ? <Text>{n} lần</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Loại xe',
      dataIndex: 'vehicle_type',
      key: 'vehicle_type',
      width: 90,
      render: (type: string, record: GpsVehicle) => (
        <Space direction="vertical" size={0}>
          <Text>{type}</Text>
          {record.capacity && <Text type="secondary" style={{ fontSize: 11 }}>{record.capacity}</Text>}
        </Space>
      ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'time_update',
      key: 'time_update',
      width: 140,
      render: (t: string) => <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text>,
    },
  ]

  const stats = data ?? { total: 0, moving: 0, stopped: 0, overspeed: 0 }

  return (
    <div style={{ padding: '16px 24px' }}>
      {error && (
        <Alert
          type="error"
          message={`Lỗi GPS: ${error}`}
          showIcon
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={handleManualRefresh}>Thử lại</Button>}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <CarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Theo dõi xe GPS — Thời gian thực
        </Title>
        <Space>
          {lastFetch && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cập nhật lúc {lastFetch.toLocaleTimeString('vi-VN')} · tự làm mới sau {countdown}s
            </Text>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={handleManualRefresh}
            loading={loading}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng số xe"
              value={stats.total}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Đang chạy"
              value={stats.moving}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Đang đứng"
              value={stats.stopped}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Quá tốc độ"
              value={stats.overspeed}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: stats.overspeed > 0 ? '#ff4d4f' : '#888' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <span>Danh sách xe ({data?.vehicles?.length ?? 0})</span>
            {data && data.cache_age_seconds < REFRESH_INTERVAL && (
              <Tag color="green">Live</Tag>
            )}
          </Space>
        }
      >
        <Table<GpsVehicle>
          dataSource={data?.vehicles ?? []}
          columns={columns}
          rowKey="gps_id"
          loading={loading && !data}
          size="small"
          pagination={false}
          scroll={{ x: 1100 }}
          rowClassName={(record) =>
            record.is_overspeed ? 'gps-row-overspeed' : record.is_stop ? 'gps-row-stopped' : 'gps-row-moving'
          }
        />
      </Card>

      <style>{`
        .gps-row-overspeed { background-color: #fff2f0 !important; }
        .gps-row-stopped { background-color: #fffbe6 !important; }
      `}</style>
    </div>
  )
}
