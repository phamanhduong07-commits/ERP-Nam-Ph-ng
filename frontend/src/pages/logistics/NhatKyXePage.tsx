import { useState } from 'react'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import { ArrowRightOutlined, CarOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import client from '../../api/client'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

interface FuelEvent {
  id: number
  gio_do: string | null
  so_lit: number
  don_gia: number
  ghi_chu: string | null
  dau_truoc_pct: number | null
  dau_sau_pct: number | null
  congto_luc_do: number | null
}

interface DailyRow {
  bien_so: string
  ngay: string
  gio_dau: string | null
  gio_cuoi: string | null
  congto_dau: number
  congto_cuoi: number
  km_chay: number
  dau_dau_pct: number
  dau_cuoi_pct: number
  so_snapshot: number
  fuel_events: FuelEvent[]
}

const fmt1 = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
const fmtKm = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

/** Màu theo mức dầu (đơn vị lít GPS, tank ~200L) */
const fuelColor = (v: number) =>
  v > 100 ? '#52c41a' : v > 50 ? '#faad14' : '#ff4d4f'

function FuelTag({ val, label }: { val: number | null; label: string }) {
  if (val == null) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
  return (
    <Tooltip title={label}>
      <span style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 4,
        background: fuelColor(val) + '22',
        border: `1px solid ${fuelColor(val)}55`,
        color: fuelColor(val),
        fontSize: 12,
        fontWeight: 600,
      }}>
        {fmt1(val)}L
      </span>
    </Tooltip>
  )
}

function FuelTimeline({ row }: { row: DailyRow }) {
  const { dau_dau_pct: dauDau, dau_cuoi_pct: dauCuoi, fuel_events: events } = row

  if (events.length === 0) {
    // Không có đổ dầu
    const diff = dauCuoi - dauDau
    return (
      <Space size={4} wrap>
        <FuelTag val={dauDau} label="Đầu ngày" />
        <ArrowRightOutlined style={{ color: '#aaa', fontSize: 10 }} />
        <FuelTag val={dauCuoi} label="Cuối ngày" />
        {Math.abs(diff) >= 1 && (
          <Text style={{ fontSize: 11, color: diff < 0 ? '#ff4d4f' : '#52c41a' }}>
            ({diff > 0 ? '+' : ''}{fmt1(diff)}L)
          </Text>
        )}
      </Space>
    )
  }

  // Có đổ dầu — hiển thị timeline đầy đủ
  const parts: React.ReactNode[] = []
  parts.push(<FuelTag key="start" val={dauDau} label="Đầu ngày" />)

  for (const ev of events) {
    parts.push(
      <ArrowRightOutlined key={`arrow-${ev.id}`} style={{ color: '#aaa', fontSize: 10 }} />
    )
    if (ev.dau_truoc_pct != null) {
      parts.push(<FuelTag key={`before-${ev.id}`} val={ev.dau_truoc_pct} label="Trước đổ" />)
      parts.push(<ArrowRightOutlined key={`arrow2-${ev.id}`} style={{ color: '#aaa', fontSize: 10 }} />)
    }
    parts.push(
      <Tooltip key={`fill-${ev.id}`} title={`Đổ dầu${ev.gio_do ? ' lúc ' + ev.gio_do : ''}: ${fmt1(ev.so_lit)}L`}>
        <Tag color="blue" style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>
          +{fmt1(ev.so_lit)}L
        </Tag>
      </Tooltip>
    )
    if (ev.dau_sau_pct != null) {
      parts.push(<ArrowRightOutlined key={`arrow3-${ev.id}`} style={{ color: '#aaa', fontSize: 10 }} />)
      parts.push(<FuelTag key={`after-${ev.id}`} val={ev.dau_sau_pct} label="Sau đổ" />)
    }
  }

  parts.push(<ArrowRightOutlined key="arrow-end" style={{ color: '#aaa', fontSize: 10 }} />)
  parts.push(<FuelTag key="end" val={dauCuoi} label="Cuối ngày" />)

  return <Space size={4} wrap>{parts}</Space>
}

export default function NhatKyXePage() {
  const today = dayjs()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([today.subtract(6, 'day'), today])
  const [selectedPlate, setSelectedPlate] = useState<string | undefined>(undefined)

  const fromDate = range[0].format('YYYY-MM-DD')
  const toDate = range[1].format('YYYY-MM-DD')

  const { data = [], isFetching, refetch } = useQuery<DailyRow[]>({
    queryKey: ['gps-daily-detail', fromDate, toDate, selectedPlate],
    queryFn: async () => {
      const params: Record<string, string> = { from_date: fromDate, to_date: toDate }
      if (selectedPlate) params.bien_so = selectedPlate
      const res = await client.get('/gps/daily-detail', { params })
      return res.data
    },
  })

  // Distinct plates for filter dropdown
  const plates = [...new Set(data.map(r => r.bien_so))].sort()

  // Summary stats
  const totalKm = data.reduce((s, r) => s + r.km_chay, 0)
  const totalFuelEvents = data.reduce((s, r) => s + r.fuel_events.length, 0)
  const totalFuelLit = data.reduce((s, r) => s + r.fuel_events.reduce((ss, e) => ss + e.so_lit, 0), 0)
  const daysWithData = new Set(data.map(r => r.ngay)).size

  const columns = [
    {
      title: 'Biển số',
      dataIndex: 'bien_so',
      key: 'bien_so',
      width: 110,
      fixed: 'left' as const,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      key: 'ngay',
      width: 100,
      render: (v: string) => {
        const d = dayjs(v)
        return (
          <div>
            <Text strong>{d.format('DD/MM')}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{d.format('ddd')}</Text>
          </div>
        )
      },
    },
    {
      title: 'Đầu ngày',
      key: 'dau_ngay',
      width: 150,
      render: (_: unknown, r: DailyRow) => (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.gio_dau || '—'}
          </Text>
          <br />
          <Text strong style={{ fontSize: 13 }}>{fmtKm(r.congto_dau)} km</Text>
          <br />
          <FuelTag val={r.dau_dau_pct} label="Dầu đầu ngày (L GPS)" />
        </div>
      ),
    },
    {
      title: 'Cuối ngày',
      key: 'cuoi_ngay',
      width: 150,
      render: (_: unknown, r: DailyRow) => (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.gio_cuoi || '—'}
          </Text>
          <br />
          <Text strong style={{ fontSize: 13 }}>{fmtKm(r.congto_cuoi)} km</Text>
          <br />
          <FuelTag val={r.dau_cuoi_pct} label="Dầu cuối ngày (L GPS)" />
        </div>
      ),
    },
    {
      title: 'Km chạy',
      dataIndex: 'km_chay',
      key: 'km_chay',
      width: 90,
      align: 'right' as const,
      sorter: (a: DailyRow, b: DailyRow) => a.km_chay - b.km_chay,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#1677ff' : '#bbb' }}>
          {v > 0 ? `+${fmtKm(v)}` : '0'} km
        </Text>
      ),
    },
    {
      title: 'Dầu GPS — Timeline (L)',
      key: 'fuel_timeline',
      render: (_: unknown, r: DailyRow) => <FuelTimeline row={r} />,
    },
    {
      title: 'Snapshot',
      dataIndex: 'so_snapshot',
      key: 'so_snapshot',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Text type="secondary">{v}</Text>,
    },
  ]

  const expandedRowRender = (r: DailyRow) => {
    if (!r.fuel_events.length) {
      return <Text type="secondary" style={{ fontSize: 12 }}>Không có lần đổ dầu nào trong ngày này.</Text>
    }
    return (
      <Table
        dataSource={r.fuel_events}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: 'Giờ đổ', dataIndex: 'gio_do', width: 80, render: (v: string | null) => v || '—' },
          { title: 'Số lít', dataIndex: 'so_lit', width: 90, align: 'right', render: (v: number) => <Text strong>{fmt1(v)} L</Text> },
          { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right', render: (v: number) => v > 0 ? `${(v/1000).toFixed(0)}k đ/L` : '—' },
          { title: 'Dầu trước đổ (GPS)', dataIndex: 'dau_truoc_pct', width: 140, align: 'center', render: (v: number | null) => <FuelTag val={v} label="Dầu trước đổ" /> },
          { title: 'Dầu sau đổ (GPS)', dataIndex: 'dau_sau_pct', width: 140, align: 'center', render: (v: number | null) => <FuelTag val={v} label="Dầu sau đổ" /> },
          { title: 'Công tơ lúc đổ', dataIndex: 'congto_luc_do', width: 130, align: 'right', render: (v: number | null) => v != null ? `${fmtKm(v)} km` : '—' },
          { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '' },
        ]}
      />
    )
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <CarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Nhật ký xe theo ngày — Công tơ &amp; Dầu GPS
        </Title>
        <Space wrap>
          <Select
            allowClear
            placeholder="Tất cả xe"
            style={{ width: 140 }}
            value={selectedPlate}
            onChange={setSelectedPlate}
            options={plates.map(p => ({ value: p, label: p }))}
          />
          <RangePicker
            value={range}
            onChange={v => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Tải lại
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng km chạy"
              value={totalKm}
              formatter={v => fmtKm(Number(v))}
              suffix="km"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Ngày có dữ liệu"
              value={daysWithData}
              suffix="ngày"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Số lần đổ dầu"
              value={totalFuelEvents}
              suffix="lần"
              valueStyle={{ color: totalFuelEvents > 0 ? '#1677ff' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng dầu đổ"
              value={totalFuelLit}
              formatter={v => fmt1(Number(v))}
              suffix="L"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={`Dữ liệu theo ngày (${data.length} xe-ngày)`}
      >
        <Table<DailyRow>
          dataSource={data}
          columns={columns}
          rowKey={r => `${r.bien_so}-${r.ngay}`}
          loading={isFetching}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} dòng` }}
          scroll={{ x: 900 }}
          expandable={{
            expandedRowRender,
            rowExpandable: r => r.fuel_events.length > 0,
          }}
        />
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 <strong>Dầu GPS (L)</strong>: Cảm biến nhiên liệu GPS Bình Minh — đơn vị lít (không phải %).
          Xanh &gt;100L · Vàng 50–100L · Đỏ &lt;50L.
          Snapshot được lưu mỗi 30 phút khi trang Giám sát GPS được mở — cần mở trang thường xuyên để có dữ liệu đầy đủ.
          Dầu trước/sau đổ lấy từ snapshot GPS gần nhất với thời điểm nhập log.
        </Text>
      </Card>
    </div>
  )
}
