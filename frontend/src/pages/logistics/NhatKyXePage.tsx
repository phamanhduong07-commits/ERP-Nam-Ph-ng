import { useState, useEffect } from 'react'
import {
  Alert, Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, notification,
} from 'antd'
import { ArrowRightOutlined, CalendarOutlined, CarOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import * as XLSX from 'xlsx'
import client from '../../api/client'
import { socket } from '../../utils/socket'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

interface FuelEvent {
  id: number | null
  gio_do: string | null
  so_lit: number          // GPS delta khi phát hiện tự động; FuelLog khi fallback
  so_lit_fuellog: number | null  // Lít nhập tay để đối chiếu (chỉ có khi GPS+FuelLog khớp)
  don_gia: number
  ghi_chu: string | null
  dau_truoc_pct: number | null
  dau_sau_pct: number | null
  congto_luc_do: number | null
}

interface DrainEvent {
  gio_bat_dau: string | null
  gio_ket_thuc: string | null
  fuel_truoc: number
  fuel_sau: number
  so_lit_hut: number
  du_kien_lit: number | null
  delta_km: number
  xe_dung: boolean
  phan_loai: 'rut_khi_dung' | 'tieu_hao_bat_thuong'
  muc_canh_bao: 'cao' | 'trung_binh'
  elapsed_minutes: number
  drain_rate_L_per_h: number
  dia_diem: string | null
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
  dinh_muc_dau: number
  fuel_tieu_hao: number
  fuel_ly_thuyet: number | null
  tieu_hao_per_100: number | null
  fuel_events: FuelEvent[]
  drain_events: DrainEvent[]
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
  const { dau_dau_pct: dauDau, dau_cuoi_pct: dauCuoi, fuel_events: fills, drain_events: drains } = row

  type TEvent =
    | { kind: 'fill'; gio: string | null; ev: FuelEvent }
    | { kind: 'drain'; gio: string | null; ev: DrainEvent }

  const allEvents: TEvent[] = [
    ...fills.map(e => ({ kind: 'fill' as const, gio: e.gio_do, ev: e })),
    ...drains.map(e => ({ kind: 'drain' as const, gio: e.gio_ket_thuc, ev: e })),
  ].sort((a, b) => {
    if (!a.gio && !b.gio) return 0
    if (!a.gio) return 1
    if (!b.gio) return -1
    return a.gio.localeCompare(b.gio)
  })

  if (allEvents.length === 0) {
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

  const parts: React.ReactNode[] = []
  parts.push(<FuelTag key="start" val={dauDau} label="Đầu ngày" />)

  allEvents.forEach((item, idx) => {
    parts.push(<ArrowRightOutlined key={`a-${idx}`} style={{ color: '#aaa', fontSize: 10 }} />)

    if (item.kind === 'fill') {
      const ev = item.ev
      const k = ev.id ?? `fi${idx}`
      if (ev.dau_truoc_pct != null) {
        parts.push(<FuelTag key={`bf-${k}`} val={ev.dau_truoc_pct} label="Trước đổ" />)
        parts.push(<ArrowRightOutlined key={`a2-${k}`} style={{ color: '#aaa', fontSize: 10 }} />)
      }
      parts.push(
        <Tooltip key={`fill-${k}`} title={`Đổ dầu${ev.gio_do ? ' lúc ' + ev.gio_do : ''}: ${fmt1(ev.so_lit)}L (GPS)`}>
          <Tag color="blue" style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>+{fmt1(ev.so_lit)}L</Tag>
        </Tooltip>
      )
      if (ev.dau_sau_pct != null) {
        parts.push(<ArrowRightOutlined key={`a3-${k}`} style={{ color: '#aaa', fontSize: 10 }} />)
        parts.push(<FuelTag key={`af-${k}`} val={ev.dau_sau_pct} label="Sau đổ" />)
      }
    } else {
      const ev = item.ev
      const label = ev.phan_loai === 'rut_khi_dung' ? 'Hụt khi dừng xe' : 'Hụt bất thường'
      const ac = ev.muc_canh_bao === 'cao' ? '#ff4d4f' : '#fa8c16'
      parts.push(
        <Tooltip key={`drain-${idx}`}
          title={`⚠ ${label}${ev.gio_ket_thuc ? ' lúc ' + ev.gio_ket_thuc : ''}: -${fmt1(ev.so_lit_hut)}L`}
        >
          <Tag style={{ margin: 0, fontWeight: 700, fontSize: 12, background: ac + '22', borderColor: ac, color: ac }}>
            ⬇ -{fmt1(ev.so_lit_hut)}L
          </Tag>
        </Tooltip>
      )
    }
  })

  parts.push(<ArrowRightOutlined key="arrow-end" style={{ color: '#aaa', fontSize: 10 }} />)
  parts.push(<FuelTag key="end" val={dauCuoi} label="Cuối ngày" />)

  return <Space size={4} wrap>{parts}</Space>
}

export default function NhatKyXePage() {
  const today = dayjs()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([today.subtract(6, 'day'), today])
  const [selectedPlate, setSelectedPlate] = useState<string | undefined>(undefined)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

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
  const totalDrainEvents = data.reduce((s, r) => s + r.drain_events.length, 0)
  const highDrains = data.reduce((s, r) => s + r.drain_events.filter(e => e.muc_canh_bao === 'cao').length, 0)
  const affectedVehicles = new Set(data.filter(r => r.drain_events.length > 0).map(r => r.bien_so)).size

  // Fleet tiêu hao: chỉ tính hàng có cả thực tế lẫn lý thuyết để tỷ lệ có nghĩa
  const rowsWithTheory = data.filter(r => r.fuel_ly_thuyet != null && r.fuel_ly_thuyet > 0)
  const fleetTieuHaoThuc = rowsWithTheory.reduce((s, r) => s + r.fuel_tieu_hao, 0)
  const fleetTieuHaoLyThuyet = rowsWithTheory.reduce((s, r) => s + (r.fuel_ly_thuyet ?? 0), 0)
  const fleetRatio = fleetTieuHaoLyThuyet > 0 ? fleetTieuHaoThuc / fleetTieuHaoLyThuyet : null

  // Auto-expand hàng có cảnh báo drain mức CAO khi data thay đổi (giới hạn 20 hàng)
  useEffect(() => {
    const keys = data
      .filter(r => r.drain_events.some(e => e.muc_canh_bao === 'cao'))
      .slice(0, 20)
      .map(r => `${r.bien_so}-${r.ngay}`)
    setExpandedKeys(keys)
  }, [data])

  // Socket: nhận cảnh báo rút dầu real-time từ poller backend
  useEffect(() => {
    const handler = (payload: {
      bien_so: string
      so_lit: number
      drain_rate_L_per_h: number
      dia_diem: string | null
      gio: string
    }) => {
      notification.warning({
        message: `⚠ Cảnh báo rút dầu — ${payload.bien_so}`,
        description: `Hụt ${payload.so_lit}L (${payload.drain_rate_L_per_h} L/h)${payload.dia_diem ? ' tại ' + payload.dia_diem.slice(0, 60) : ''}`,
        duration: 12,
        placement: 'topRight',
      })
    }
    socket.on('drain_alert', handler)
    return () => { socket.off('drain_alert', handler) }
  }, [])

  const exportToExcel = () => {
    const rows = data.map(r => ({
      'Biển số': r.bien_so,
      'Ngày': dayjs(r.ngay).format('DD/MM/YYYY'),
      'Giờ đầu': r.gio_dau ?? '',
      'Giờ cuối': r.gio_cuoi ?? '',
      'Km chạy': r.km_chay,
      'Dầu đầu (L)': r.dau_dau_pct,
      'Dầu cuối (L)': r.dau_cuoi_pct,
      'Số snapshot': r.so_snapshot,
      'Số lần đổ': r.fuel_events.length,
      'Tiêu hao thực (L)': r.fuel_tieu_hao,
      'Tiêu hao LT (L)': r.fuel_ly_thuyet ?? '',
      'TH thực tế (L/100km)': r.tieu_hao_per_100 ?? '',
      'Định mức (L/100km)': r.dinh_muc_dau > 0 ? r.dinh_muc_dau : '',
      'Số cảnh báo hụt': r.drain_events.length,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nhật ký xe')
    XLSX.writeFile(wb, `NhatKyXe_${fromDate}_${toDate}.xlsx`)
  }

  const columns = [
    {
      title: '',
      key: 'alert',
      width: 28,
      fixed: 'left' as const,
      render: (_: unknown, r: DailyRow) => {
        if (!r.drain_events.length) return null
        const isHigh = r.drain_events.some(e => e.muc_canh_bao === 'cao')
        return (
          <Tooltip title={`${r.drain_events.length} cảnh báo hụt dầu${isHigh ? ' (mức CAO)' : ''}`}>
            <span style={{ color: isHigh ? '#ff4d4f' : '#fa8c16', fontSize: 15 }}>⚠</span>
          </Tooltip>
        )
      },
    },
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
      title: 'Tiêu hao ngày',
      key: 'tieu_hao',
      width: 120,
      align: 'right' as const,
      sorter: (a: DailyRow, b: DailyRow) => a.fuel_tieu_hao - b.fuel_tieu_hao,
      render: (_: unknown, r: DailyRow) => {
        const actual = r.fuel_tieu_hao
        const theory = r.fuel_ly_thuyet
        if (actual <= 0 && !theory) return <Text type="secondary">—</Text>
        const ratio = theory && theory > 0 ? actual / theory : null
        const color = ratio == null ? undefined
          : ratio > 1.15 ? '#ff4d4f'
          : ratio > 1.05 ? '#fa8c16'
          : '#52c41a'
        return (
          <Tooltip title={theory ? `Định mức: ${fmt1(theory)} L / ${fmtKm(r.km_chay)} km` : 'Chưa có định mức'}>
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ color }}>{fmt1(actual)} L</Text>
              {theory != null && (
                <div>
                  <Text type="secondary" style={{ fontSize: 10 }}>/ {fmt1(theory)} L ĐM</Text>
                </div>
              )}
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: 'L/100km thực tế',
      key: 'tieu_hao_per_100',
      width: 120,
      align: 'right' as const,
      sorter: (a: DailyRow, b: DailyRow) => (a.tieu_hao_per_100 ?? 0) - (b.tieu_hao_per_100 ?? 0),
      render: (_: unknown, r: DailyRow) => {
        const actual = r.tieu_hao_per_100
        const dm = r.dinh_muc_dau
        if (actual == null) return <Text type="secondary">—</Text>
        const color = dm > 0
          ? actual > dm * 1.15 ? '#ff4d4f'
          : actual > dm * 1.05 ? '#fa8c16'
          : '#52c41a'
          : undefined
        return (
          <Tooltip title={dm > 0 ? `Định mức: ${fmt1(dm)} L/100km` : 'Chưa cài định mức'}>
            <div style={{ lineHeight: 1.4 }}>
              <Text strong style={{ color }}>{fmt1(actual)}</Text>
              <Text type="secondary" style={{ fontSize: 10 }}> L/100km</Text>
              {dm > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: 10 }}>ĐM: {fmt1(dm)}</Text>
                </div>
              )}
            </div>
          </Tooltip>
        )
      },
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
      width: 95,
      align: 'center' as const,
      render: (v: number) => {
        const color = v >= 240 ? 'success' : v >= 100 ? 'warning' : 'error'
        const label = v >= 240 ? 'Tốt' : v >= 100 ? 'Đủ' : 'Kém'
        return (
          <Tooltip title={`${v} snapshot · ${label} (≥240 Tốt · ≥100 Đủ · <100 Kém)`}>
            <Tag color={color} style={{ fontSize: 11, margin: 0 }}>
              {v} <span style={{ fontWeight: 400 }}>({label})</span>
            </Tag>
          </Tooltip>
        )
      },
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('logistics-nhat-ky-xe', columns)

  const expandedRowRender = (r: DailyRow) => {
    const hasFuel = r.fuel_events.length > 0
    const hasDrain = r.drain_events.length > 0

    if (!hasFuel && !hasDrain) {
      return <Text type="secondary" style={{ fontSize: 12 }}>Không có sự kiện dầu nào trong ngày này.</Text>
    }

    return (
      <div>
        {hasFuel && (
          <>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>🔵 Đổ dầu ({r.fuel_events.length} lần)</Text>
            <Table
                            locale={{ emptyText: <EmptyState size="small" /> }}
                            dataSource={r.fuel_events}
              rowKey={(_ev, idx) => String(idx)}
              size="small"
              pagination={false}
              columns={[
                { title: 'Nguồn', key: 'nguon', width: 90, render: (_: unknown, ev: FuelEvent) => ev.id == null ? <Tag color="blue" style={{ fontSize: 11 }}>GPS tự động</Tag> : <Tag color="default" style={{ fontSize: 11 }}>FuelLog</Tag> },
                { title: 'Giờ đổ', dataIndex: 'gio_do', width: 80, render: (v: string | null) => v || '—' },
                { title: 'GPS (L)', dataIndex: 'so_lit', width: 90, align: 'right' as const, render: (v: number, ev: FuelEvent) => <Tooltip title={ev.id == null ? 'Tự động phát hiện từ cảm biến GPS' : 'GPS delta'}><Text strong style={{ color: '#1677ff' }}>{fmt1(v)} L</Text></Tooltip> },
                { title: 'Nhập tay (L)', dataIndex: 'so_lit_fuellog', width: 110, align: 'right' as const, render: (v: number | null) => v != null ? <Text type="secondary">{fmt1(v)} L</Text> : <Text type="secondary">—</Text> },
                { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right' as const, render: (v: number) => v > 0 ? `${(v / 1000).toFixed(0)}k đ/L` : '—' },
                { title: 'Dầu trước', dataIndex: 'dau_truoc_pct', width: 110, align: 'center' as const, render: (v: number | null) => <FuelTag val={v} label="Dầu trước đổ" /> },
                { title: 'Dầu sau', dataIndex: 'dau_sau_pct', width: 110, align: 'center' as const, render: (v: number | null) => <FuelTag val={v} label="Dầu sau đổ" /> },
                { title: 'Công tơ lúc đổ', dataIndex: 'congto_luc_do', width: 130, align: 'right' as const, render: (v: number | null) => v != null ? `${fmtKm(v)} km` : '—' },
                { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '' },
              ]}
            />
          </>
        )}

        {hasDrain && (
          <div style={{ marginTop: hasFuel ? 12 : 0 }}>
            <Text strong style={{ fontSize: 12, color: '#ff4d4f', display: 'block', marginBottom: 4 }}>
              ⚠ Cảnh báo hụt dầu ({r.drain_events.length} sự kiện)
            </Text>
            <Table
                            locale={{ emptyText: <EmptyState size="small" /> }}
                            dataSource={r.drain_events}
              rowKey={(_, idx) => `drain-${idx}`}
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Thời gian',
                  key: 'gio',
                  width: 130,
                  render: (_: unknown, e: DrainEvent) => `${e.gio_bat_dau || '?'} → ${e.gio_ket_thuc || '?'}`,
                },
                {
                  title: 'Hụt (L)',
                  dataIndex: 'so_lit_hut',
                  width: 85,
                  align: 'right' as const,
                  render: (v: number) => <Text strong style={{ color: '#ff4d4f' }}>-{fmt1(v)} L</Text>,
                },
                {
                  title: 'Dầu trước',
                  dataIndex: 'fuel_truoc',
                  width: 100,
                  align: 'center' as const,
                  render: (v: number) => <FuelTag val={v} label="Dầu trước" />,
                },
                {
                  title: 'Dầu sau',
                  dataIndex: 'fuel_sau',
                  width: 100,
                  align: 'center' as const,
                  render: (v: number) => <FuelTag val={v} label="Dầu sau" />,
                },
                {
                  title: 'Km di chuyển',
                  dataIndex: 'delta_km',
                  width: 110,
                  align: 'right' as const,
                  render: (v: number) => `${fmt1(v)} km`,
                },
                {
                  title: 'Dự kiến (L)',
                  dataIndex: 'du_kien_lit',
                  width: 100,
                  align: 'right' as const,
                  render: (v: number | null) => v != null
                    ? <Text type="secondary">{fmt1(v)} L</Text>
                    : <Text type="secondary">—</Text>,
                },
                {
                  title: 'Phân loại',
                  dataIndex: 'phan_loai',
                  width: 170,
                  render: (v: string, e: DrainEvent) => {
                    const isHigh = e.muc_canh_bao === 'cao'
                    const label = v === 'rut_khi_dung' ? 'Hụt khi xe dừng' : 'Tiêu hao bất thường'
                    return <Tag color={isHigh ? 'error' : 'warning'}>{label}</Tag>
                  },
                },
                {
                  title: 'Xe dừng?',
                  dataIndex: 'xe_dung',
                  width: 80,
                  align: 'center' as const,
                  render: (v: boolean) => v ? <Tag color="red">Có</Tag> : <Tag color="orange">Không</Tag>,
                },
                {
                  title: 'Tốc độ hụt',
                  dataIndex: 'drain_rate_L_per_h',
                  width: 105,
                  align: 'right' as const,
                  render: (v: number) => (
                    <Text type="secondary" style={{ fontSize: 11 }}>{fmt1(v)} L/h</Text>
                  ),
                },
                {
                  title: 'Địa điểm',
                  dataIndex: 'dia_diem',
                  render: (v: string | null) => v
                    ? (
                      <Tooltip title={v}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {v.length > 45 ? v.slice(0, 45) + '…' : v}
                        </Text>
                      </Tooltip>
                    )
                    : <Text type="secondary">—</Text>,
                },
              ]}
            />
          </div>
        )}
      </div>
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
          <Button.Group>
            <Button
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => setRange([today.subtract(1, 'day'), today.subtract(1, 'day')])}
            >
              Hôm qua
            </Button>
            <Button
              size="small"
              onClick={() => setRange([today.subtract(6, 'day'), today])}
            >
              7 ngày
            </Button>
            <Button
              size="small"
              onClick={() => setRange([today.startOf('month'), today])}
            >
              Tháng này
            </Button>
          </Button.Group>
          <RangePicker
            value={range}
            onChange={v => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Tải lại
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportToExcel} disabled={data.length === 0}>
            Xuất Excel
          </Button>
          {settingsButton}
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

      {rowsWithTheory.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title={`Tiêu hao đội xe (${rowsWithTheory.length} xe-ngày có định mức)`}
                value={fleetTieuHaoThuc}
                formatter={v => fmt1(Number(v))}
                suffix={`L / ${fmt1(fleetTieuHaoLyThuyet)} L định mức`}
                valueStyle={{
                  color: fleetRatio == null ? undefined
                    : fleetRatio > 1.1 ? '#ff4d4f'
                    : fleetRatio > 1.05 ? '#fa8c16'
                    : '#52c41a',
                  fontSize: 20,
                }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="Hiệu suất nhiên liệu đội xe"
                value={fleetRatio != null ? Math.round(fleetRatio * 100) : 0}
                suffix="%"
                valueStyle={{
                  color: fleetRatio == null ? '#8c8c8c'
                    : fleetRatio > 1.1 ? '#ff4d4f'
                    : fleetRatio > 1.05 ? '#fa8c16'
                    : '#52c41a',
                  fontSize: 20,
                }}
              />
              {fleetRatio != null && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {fleetRatio > 1.1 ? '⚠ Tiêu hao vượt 10% định mức' : fleetRatio > 1.05 ? 'Chú ý: vượt 5% định mức' : '✓ Trong ngưỡng định mức'}
                </Text>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {totalDrainEvents > 0 && (
        <Alert
          type={highDrains > 0 ? 'error' : 'warning'}
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <Text strong>
              {highDrains > 0
                ? `⚠ Phát hiện ${highDrains} cảnh báo mức CAO trên ${affectedVehicles} xe — nghi ngờ rút dầu gian lận`
                : `${totalDrainEvents} cảnh báo hụt dầu bất thường trên ${affectedVehicles} xe`}
            </Text>
          }
          description={
            <span>
              {highDrains > 0 && `${highDrains} mức CAO`}
              {highDrains > 0 && (totalDrainEvents - highDrains) > 0 && ' · '}
              {(totalDrainEvents - highDrains) > 0 && `${totalDrainEvents - highDrains} mức trung bình`}
              {' — Các hàng mức CAO đã được tự động mở rộng bên dưới.'}
            </span>
          }
        />
      )}

      <Card
        size="small"
        title={`Dữ liệu theo ngày (${data.length} xe-ngày)`}
      >
        <Table<DailyRow>
          dataSource={data}
          columns={displayColumns}
          rowKey={r => `${r.bien_so}-${r.ngay}`}
          loading={isFetching}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} dòng` }}
          scroll={{ x: 900 }}
          expandable={{
            expandedRowRender,
            rowExpandable: r => r.fuel_events.length > 0 || r.drain_events.length > 0,
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: keys => setExpandedKeys(keys as string[]),
          }}
        />
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 <strong>Đổ dầu GPS</strong>: Phát hiện tự động khi dầu tăng ≥8L giữa 2 snapshot liên tiếp — thời điểm và số lít chính xác từ cảm biến (ví dụ 9,5L). Cột <strong>Nhập tay</strong> từ FuelLog để đối chiếu.
          <br />
          <strong>Cảnh báo hụt dầu ⚠</strong>: Hụt ≥8L khi xe dừng = nghi rút dầu (mức CAO). Tiêu hao &gt;2,5× định mức khi di chuyển = bất thường.
          <br />
          Màu dầu: Xanh &gt;100L · Vàng 50–100L · Đỏ &lt;50L. Snapshot tự động 5 phút.
        </Text>
      </Card>
    </div>
  )
}
