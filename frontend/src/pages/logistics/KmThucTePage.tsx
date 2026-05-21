import { useState } from 'react'
import {
  Button, Card, Col, DatePicker, Row, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import { CarOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import client from '../../api/client'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

interface KmSummaryRow {
  bien_so: string
  xe_id: number | null
  km_tong: number
  fuel_avg: number
  so_ngay: number
  ngay_cuoi_gps: string | null
}

interface KmDailyRow {
  bien_so: string
  xe_id: number | null
  ngay: string
  km_ngay: number
  fuel_avg: number
  km_total_max: number
  so_snapshot: number
}

const fmt = (v: number, d = 1) => v.toLocaleString('vi-VN', { maximumFractionDigits: d })

// GPS Bình Minh Fuel = lít (không phải %); bình ~200L
const fuelColor = (lit: number) =>
  lit > 100 ? '#52c41a' : lit > 50 ? '#faad14' : '#ff4d4f'

export default function KmThucTePage() {
  const today = dayjs()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([today.startOf('month'), today])
  const [selectedXe, setSelectedXe] = useState<string | null>(null)

  const fromDate = range[0].format('YYYY-MM-DD')
  const toDate = range[1].format('YYYY-MM-DD')

  const { data: summary = [], isFetching: loadingSummary, refetch } = useQuery<KmSummaryRow[]>({
    queryKey: ['gps-km-summary', fromDate, toDate],
    queryFn: async () => {
      const res = await client.get('/gps/km-summary', { params: { from_date: fromDate, to_date: toDate } })
      return res.data
    },
  })

  const { data: daily = [], isFetching: loadingDaily } = useQuery<KmDailyRow[]>({
    queryKey: ['gps-km-report', fromDate, toDate],
    queryFn: async () => {
      const res = await client.get('/gps/km-report', { params: { from_date: fromDate, to_date: toDate } })
      return res.data
    },
  })

  const filteredDaily = selectedXe
    ? daily.filter(r => r.bien_so === selectedXe)
    : daily

  const totalKm = summary.reduce((s, r) => s + r.km_tong, 0)
  const avgFuel = summary.length
    ? summary.reduce((s, r) => s + r.fuel_avg, 0) / summary.length
    : 0

  const summaryColumns = [
    {
      title: 'Biển số',
      dataIndex: 'bien_so',
      key: 'bien_so',
      width: 120,
      render: (v: string) => (
        <Button
          type={selectedXe === v ? 'primary' : 'link'}
          size="small"
          onClick={() => setSelectedXe(selectedXe === v ? null : v)}
        >
          {v}
        </Button>
      ),
    },
    {
      title: 'Tổng Km',
      dataIndex: 'km_tong',
      key: 'km_tong',
      width: 110,
      sorter: (a: KmSummaryRow, b: KmSummaryRow) => a.km_tong - b.km_tong,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => <Text strong>{fmt(v)} km</Text>,
    },
    {
      title: 'Dầu TB (L)',
      dataIndex: 'fuel_avg',
      key: 'fuel_avg',
      width: 110,
      render: (v: number) => (
        <Text style={{ color: fuelColor(v) }}>{fmt(v)} L</Text>
      ),
    },
    {
      title: 'Số ngày có dữ liệu',
      dataIndex: 'so_ngay',
      key: 'so_ngay',
      width: 130,
      render: (v: number) => `${v} ngày`,
    },
    {
      title: 'GPS cuối',
      dataIndex: 'ngay_cuoi_gps',
      key: 'ngay_cuoi_gps',
      width: 110,
      render: (v: string | null) => {
        if (!v) return <Text type="secondary">—</Text>
        const days = dayjs().diff(dayjs(v), 'day')
        return (
          <Tooltip title={dayjs(v).format('DD/MM/YYYY')}>
            {days > 2
              ? <Tag color="error">Offline {days}d</Tag>
              : <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('DD/MM')}</Text>}
          </Tooltip>
        )
      },
    },
  ]

  const dailyColumns = [
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      key: 'ngay',
      width: 110,
      render: (v: string) => <Text type="secondary">{dayjs(v).format('DD/MM/YYYY')}</Text>,
    },
    {
      title: 'Biển số',
      dataIndex: 'bien_so',
      key: 'bien_so',
      width: 110,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Km hôm đó',
      dataIndex: 'km_ngay',
      key: 'km_ngay',
      width: 110,
      sorter: (a: KmDailyRow, b: KmDailyRow) => a.km_ngay - b.km_ngay,
      render: (v: number) => {
        const color = v > 300 ? '#52c41a' : v > 100 ? undefined : '#faad14'
        return <Text style={{ color }}>{fmt(v)} km</Text>
      },
    },
    {
      title: 'Dầu TB (L)',
      dataIndex: 'fuel_avg',
      key: 'fuel_avg',
      width: 110,
      render: (v: number) => (
        <Text style={{ color: fuelColor(v) }}>{fmt(v)} L</Text>
      ),
    },
    {
      title: 'Km tổng đồng hồ',
      dataIndex: 'km_total_max',
      key: 'km_total_max',
      width: 140,
      render: (v: number) => (
        <Text type="secondary">{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} km</Text>
      ),
    },
    {
      title: 'Snapshots',
      dataIndex: 'so_snapshot',
      key: 'so_snapshot',
      width: 100,
      render: (v: number) => {
        // 288 snapshots/ngày = lý tưởng (mỗi 5 phút × 24h)
        const color = v >= 240 ? 'success' : v >= 100 ? 'warning' : 'error'
        const label = v >= 240 ? 'Tốt' : v >= 100 ? 'Đủ' : 'Kém'
        return (
          <Tooltip title={`${v} snapshot trong ngày · Chất lượng dữ liệu: ${label} (Tốt ≥240 · Đủ ≥100 · Kém <100)`}>
            <Tag color={color} style={{ fontSize: 11 }}>
              {v} <span style={{ fontWeight: 400 }}>({label})</span>
            </Tag>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <CarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Km thực tế đội xe — GPS Bình Minh
        </Title>
        <Space>
          <RangePicker
            value={range}
            onChange={v => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loadingSummary}>
            Tải lại
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng Km đội xe"
              value={totalKm}
              formatter={v => fmt(Number(v))}
              suffix="km"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Số xe có dữ liệu"
              value={summary.length}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Dầu TB trong bình (L)"
              value={avgFuel}
              formatter={v => fmt(Number(v))}
              suffix="L"
              valueStyle={{ color: fuelColor(avgFuel) }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Km TB / xe"
              value={summary.length ? totalKm / summary.length : 0}
              formatter={v => fmt(Number(v))}
              suffix="km"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={10}>
          <Card
            size="small"
            title="Tổng hợp theo xe"
            extra={selectedXe && (
              <Button size="small" onClick={() => setSelectedXe(null)}>Bỏ lọc</Button>
            )}
          >
            <Table<KmSummaryRow>
              dataSource={summary}
              columns={summaryColumns}
              rowKey="bien_so"
              loading={loadingSummary}
              size="small"
              pagination={false}
              rowClassName={r => r.bien_so === selectedXe ? 'ant-table-row-selected' : ''}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ fontWeight: 600 }}>
                    <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>{fmt(totalKm)} km</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>

        <Col span={14}>
          <Card
            size="small"
            title={
              selectedXe
                ? `Chi tiết theo ngày — xe ${selectedXe}`
                : `Chi tiết tất cả xe theo ngày (${filteredDaily.length} dòng)`
            }
          >
            <Table<KmDailyRow>
              dataSource={filteredDaily}
              columns={dailyColumns}
              rowKey={r => `${r.bien_so}-${r.ngay}`}
              loading={loadingDaily}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ y: 400 }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 <strong>Dầu TB (L)</strong> = trung bình mức dầu trong bình theo lít (GPS Bình Minh báo lít, không phải %).
          Xanh &gt;100L · Vàng 50–100L · Đỏ &lt;50L (bình ~200L).
          Dữ liệu tự động lưu mỗi 5 phút. Cột "Km hôm đó" = max(km_today) trong ngày.
          Nhấn biển số để lọc chi tiết ngày.
        </Text>
      </Card>
    </div>
  )
}
