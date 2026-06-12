import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Badge, Button, Input, Select, Space, Tooltip, Typography } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import client from '../../api/client'
import GpsLiveMap, { type GpsMapVehicle } from '../../components/GpsLiveMap'

const { Text } = Typography

interface GpsVehicle extends GpsMapVehicle {
  xe_id: number | null
  loai_xe_erp: string | null
  dinh_muc_dau: number | null
  stop_counter: number | null
  day_driving_time: number | null
}

interface GpsResponse {
  vehicles: GpsVehicle[]
  total: number
  moving: number
  stopped: number
  overspeed: number
  cache_age_seconds: number
}

type StatusFilter = 'all' | 'moving' | 'stopped' | 'overspeed' | 'offline'

const REFRESH_INTERVAL = 30
const STATUS_DOT_COLOR: Record<string, string> = {
  moving: '#52c41a',
  stopped: '#8c8c8c',
  overspeed: '#ff4d4f',
  offline: '#d9d9d9',
}

function isOffline(v: GpsVehicle): boolean {
  if (!v.time_update) return true
  // BM time format "yyyy/MM/dd HH:mm:ss" — naive parse, treat older than 30 min as offline
  try {
    const t = Date.parse(v.time_update.replace(/\//g, '-'))
    if (Number.isNaN(t)) return false
    return (Date.now() - t) / 60000 > 30
  } catch {
    return false
  }
}

function getDisplayStatus(v: GpsVehicle): 'moving' | 'stopped' | 'overspeed' | 'offline' {
  if (isOffline(v)) return 'offline'
  return v.status
}

function timeShort(t?: string | null): string {
  if (!t) return '—'
  // BM format "2026/05/28 22:07:25" → "22:07:25"
  const parts = t.split(' ')
  return parts.length > 1 ? parts[1] : t
}

export default function GpsTrackingPage() {
  const [data, setData] = useState<GpsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focusedGpsId, setFocusedGpsId] = useState<string | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const focusVehicle = (gpsId: string) => {
    setFocusedGpsId(gpsId)
    setFocusTick(t => t + 1)
  }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await client.get<GpsResponse>('/gps/vehicles')
      const payload = res.data
      if (!payload || !Array.isArray(payload.vehicles)) {
        throw new Error('Dữ liệu GPS không hợp lệ')
      }
      setData(payload)
      setError(null)
      setLastFetch(new Date())
      setCountdown(REFRESH_INTERVAL)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Không kết nối được GPS API'
      setError(msg)
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

  // Vehicle types for the filter dropdown
  const vehicleTypes = useMemo(() => {
    const set = new Set<string>()
    data?.vehicles.forEach(v => v.vehicle_type && set.add(v.vehicle_type))
    return Array.from(set).sort()
  }, [data])

  const filtered = useMemo(() => {
    let list = data?.vehicles ?? []
    if (statusFilter !== 'all') {
      list = list.filter(v => getDisplayStatus(v) === statusFilter)
    }
    if (typeFilter !== 'all') {
      list = list.filter(v => v.vehicle_type === typeFilter)
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase()
      list = list.filter(v =>
        v.plate.toLowerCase().includes(term) ||
        (v.driver_name || '').toLowerCase().includes(term) ||
        (v.address || '').toLowerCase().includes(term),
      )
    }
    // Sort: moving > overspeed > stopped > offline; then by plate
    const order: Record<string, number> = { moving: 0, overspeed: 1, stopped: 2, offline: 3 }
    return [...list].sort((a, b) => {
      const ta = order[getDisplayStatus(a)] ?? 9
      const tb = order[getDisplayStatus(b)] ?? 9
      if (ta !== tb) return ta - tb
      return a.plate.localeCompare(b.plate)
    })
  }, [data, statusFilter, typeFilter, search])

  // Status counts from full data (not filtered)
  const counts = useMemo(() => {
    const c = { all: 0, moving: 0, stopped: 0, overspeed: 0, offline: 0 }
    data?.vehicles.forEach(v => {
      c.all += 1
      c[getDisplayStatus(v)] += 1
    })
    return c
  }, [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#f0f2f5' }}>
      {/* Thin top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#fff', borderBottom: '1px solid #e8e8e8',
        height: 44, flexShrink: 0,
      }}>
        <Space>
          <Text strong style={{ fontSize: 14 }}>📡 Theo dõi xe GPS — Thời gian thực</Text>
          {data && data.cache_age_seconds < REFRESH_INTERVAL && (
            <Badge status="processing" color="green" text={<Text style={{ fontSize: 11 }}>Live</Text>} />
          )}
        </Space>
        <Space size="small">
          {lastFetch && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {lastFetch.toLocaleTimeString('vi-VN')} · auto {countdown}s
            </Text>
          )}
          <Button icon={<ReloadOutlined />} size="small" onClick={handleManualRefresh} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          message={`Lỗi GPS: ${error}`}
          showIcon
          banner
          action={<Button size="small" onClick={handleManualRefresh}>Thử lại</Button>}
        />
      )}

      {/* Main split */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ─── Sidebar (left) ─── */}
        <div style={{
          width: 320, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: '#fff', borderRight: '1px solid #e8e8e8',
        }}>
          <div style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Tìm biển số, tài xế, địa chỉ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              size="small"
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Select
                size="small"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ flex: 1 }}
                options={[
                  { value: 'all', label: `Tất cả (${counts.all})` },
                  { value: 'moving', label: `Đang chạy (${counts.moving})` },
                  { value: 'stopped', label: `Đứng (${counts.stopped})` },
                  { value: 'overspeed', label: `Quá tốc (${counts.overspeed})` },
                  { value: 'offline', label: `Offline (${counts.offline})` },
                ]}
              />
              <Select
                size="small"
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ flex: 1 }}
                options={[
                  { value: 'all', label: 'Tất cả loại' },
                  ...vehicleTypes.map(t => ({ value: t, label: t })),
                ]}
              />
            </div>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '14px 1fr 60px 70px',
            gap: 8, padding: '6px 10px', borderBottom: '1px solid #f0f0f0',
            fontSize: 11, fontWeight: 600, color: '#8c8c8c',
            background: '#fafafa',
          }}>
            <span />
            <span>Biển số</span>
            <span style={{ textAlign: 'right' }}>Tốc độ</span>
            <span style={{ textAlign: 'right' }}>Thời gian</span>
          </div>

          {/* Vehicle list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 12 }}>
                {loading ? 'Đang tải...' : 'Không có xe phù hợp'}
              </div>
            ) : (
              filtered.map(v => {
                const st = getDisplayStatus(v)
                const selected = focusedGpsId === v.gps_id
                return (
                  <div
                    key={v.gps_id}
                    onClick={() => focusVehicle(v.gps_id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '14px 1fr 60px 70px',
                      gap: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f5f5f5',
                      background: selected ? '#e6f4ff' : 'transparent',
                      borderLeft: selected ? '3px solid #1677ff' : '3px solid transparent',
                      alignItems: 'center',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#fafafa' }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: STATUS_DOT_COLOR[st],
                      boxShadow: st === 'moving' ? '0 0 0 2px rgba(82,196,26,0.2)' : 'none',
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600, color: '#262626' }}>
                        {v.plate}
                      </div>
                      {v.driver_name && (
                        <Tooltip title={v.driver_name}>
                          <div style={{
                            fontSize: 10, color: '#8c8c8c',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {v.driver_name}
                          </div>
                        </Tooltip>
                      )}
                    </div>
                    <span style={{
                      textAlign: 'right',
                      fontFamily: 'ui-monospace, monospace', fontSize: 12,
                      color: v.is_overspeed ? '#ff4d4f' : '#262626',
                      fontWeight: v.is_overspeed ? 700 : 400,
                    }}>
                      {(v.speed ?? 0).toFixed(0)}
                    </span>
                    <span style={{
                      textAlign: 'right',
                      fontFamily: 'ui-monospace, monospace', fontSize: 11,
                      color: '#595959',
                    }}>
                      {timeShort(v.time_update)}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Bottom legend pills */}
          <div style={{
            display: 'flex', gap: 4, padding: '8px 10px',
            borderTop: '1px solid #f0f0f0', background: '#fafafa',
            justifyContent: 'space-between',
          }}>
            <LegendPill color="#1677ff" count={counts.all} label="Tất cả" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <LegendPill color="#52c41a" count={counts.moving} label="Chạy" active={statusFilter === 'moving'} onClick={() => setStatusFilter('moving')} />
            <LegendPill color="#ff4d4f" count={counts.overspeed} label="Quá tốc" active={statusFilter === 'overspeed'} onClick={() => setStatusFilter('overspeed')} />
            <LegendPill color="#8c8c8c" count={counts.stopped} label="Đứng" active={statusFilter === 'stopped'} onClick={() => setStatusFilter('stopped')} />
            <LegendPill color="#d9d9d9" count={counts.offline} label="Offline" active={statusFilter === 'offline'} onClick={() => setStatusFilter('offline')} />
          </div>
        </div>

        {/* ─── Map (right, fills rest) ─── */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <GpsLiveMap
            vehicles={filtered}
            focusedGpsId={focusedGpsId}
            focusTick={focusTick}
            onMarkerClick={focusVehicle}
            height="100%"
          />
        </div>
      </div>
    </div>
  )
}

interface LegendPillProps {
  color: string
  count: number
  label: string
  active?: boolean
  onClick?: () => void
}

function LegendPill({ color, count, label, active, onClick }: LegendPillProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '4px 8px', borderRadius: 6,
        background: active ? color : '#fff',
        color: active ? '#fff' : '#262626',
        border: `1px solid ${active ? color : '#e8e8e8'}`,
        cursor: 'pointer',
        minWidth: 48,
        transition: 'all 0.15s',
      }}
    >
      <span style={{
        fontSize: 14, fontWeight: 700, lineHeight: 1,
        fontFamily: 'ui-monospace, monospace',
      }}>{count}</span>
      <span style={{ fontSize: 9.5, marginTop: 2, lineHeight: 1 }}>{label}</span>
    </div>
  )
}
