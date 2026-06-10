import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Modal, Space, Spin, Statistic, Tag, Typography, message } from 'antd'
import {
  CameraOutlined, EnvironmentOutlined, LoginOutlined, LogoutOutlined,
  ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { hrApi, type CheckInLocation } from '../../api/hr'

const { Text, Title } = Typography

interface GpsState {
  lat: number
  lng: number
  accuracy: number
}

export default function MobileCheckIn() {
  const [gps, setGps] = useState<GpsState | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [selfie, setSelfie] = useState<string | null>(null)  // base64 thumbnail
  const [submitting, setSubmitting] = useState(false)
  const [confirmType, setConfirmType] = useState<'in' | 'out' | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { data: locations = [] } = useQuery({
    queryKey: ['my-checkin-locations'],
    queryFn: () => hrApi.myActiveCheckinLocations().then(r => r.data),
  })

  const { data: today, refetch: refetchToday } = useQuery({
    queryKey: ['my-checkin-today'],
    queryFn: () => hrApi.myCheckinToday().then(r => r.data),
  })

  // Lấy GPS
  const fetchGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt không hỗ trợ GPS')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setGpsLoading(false)
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Bạn chưa cấp quyền truy cập vị trí. Vào Cài đặt trình duyệt → Site permissions → Location → Allow.'
            : `Không lấy được vị trí: ${err.message}`,
        )
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  useEffect(() => { fetchGps() }, [])

  // Tính khoảng cách đến địa điểm gần nhất (client-side preview)
  const nearestInfo = (() => {
    if (!gps || locations.length === 0) return null
    let best: { loc: CheckInLocation; dist: number } | null = null
    for (const loc of locations) {
      const d = haversine(gps.lat, gps.lng, loc.lat, loc.lng)
      if (!best || d < best.dist) best = { loc, dist: d }
    }
    if (!best) return null
    return { ...best, withinRadius: best.dist <= best.loc.ban_kinh_m }
  })()

  // Chụp selfie → resize xuống thumbnail nhỏ để fit 500-char URL limit
  const onSelfiePicked = async (file: File) => {
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 48, 0.5)
      setSelfie(dataUrl)
    } catch {
      message.error('Không xử lý được ảnh')
    }
  }

  const handleSubmit = async (type: 'in' | 'out') => {
    if (!gps) {
      message.warning('Đang lấy GPS — vui lòng đợi')
      return
    }
    setSubmitting(true)
    try {
      const res = await hrApi.submitCheckin({
        lat: gps.lat,
        lng: gps.lng,
        selfie_url: selfie || undefined,
        type,
      })
      message.success(res.data.message, 4)
      setSelfie(null)
      await refetchToday()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string'
        ? detail
        : detail?.message || 'Chấm công thất bại'
      message.error(msg, 5)
    } finally {
      setSubmitting(false)
      setConfirmType(null)
    }
  }

  const hasCheckedIn = Boolean(today?.has_log && today?.gio_vao)
  const hasCheckedOut = Boolean(today?.has_log && today?.gio_ra)

  return (
    <div style={{ padding: 12 }}>
      <Title level={4} style={{ marginBottom: 12, textAlign: 'center' }}>
        <ClockCircleOutlined /> Chấm công hôm nay
      </Title>

      {/* Trạng thái hôm nay */}
      <Card size="small" style={{ marginBottom: 12, background: '#f5f9ff' }}>
        <Space style={{ width: '100%', justifyContent: 'space-around' }} align="center">
          <Statistic
            title="Vào"
            value={hasCheckedIn ? dayjs(today!.gio_vao).format('HH:mm') : '—'}
            valueStyle={{ color: hasCheckedIn ? '#52c41a' : '#bfbfbf', fontSize: 22 }}
            prefix={hasCheckedIn ? <CheckCircleOutlined /> : null}
          />
          <Statistic
            title="Ra"
            value={hasCheckedOut ? dayjs(today!.gio_ra).format('HH:mm') : '—'}
            valueStyle={{ color: hasCheckedOut ? '#52c41a' : '#bfbfbf', fontSize: 22 }}
            prefix={hasCheckedOut ? <CheckCircleOutlined /> : null}
          />
        </Space>
      </Card>

      {/* GPS status */}
      <Card size="small" style={{ marginBottom: 12 }}>
        {gpsLoading && (
          <Space><Spin size="small" /><Text>Đang lấy vị trí GPS...</Text></Space>
        )}
        {gpsError && (
          <Alert
            type="warning"
            showIcon
            message={gpsError}
            action={<Button size="small" icon={<ReloadOutlined />} onClick={fetchGps}>Thử lại</Button>}
          />
        )}
        {gps && !gpsLoading && (
          <>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size={4}>
                <EnvironmentOutlined style={{ color: '#1677ff' }} />
                <Text strong style={{ fontSize: 12 }}>Vị trí hiện tại</Text>
              </Space>
              <Button size="small" icon={<ReloadOutlined />} type="link" onClick={fetchGps}>
                Cập nhật
              </Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace', display: 'block' }}>
              {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} · độ chính xác ±{Math.round(gps.accuracy)} m
            </Text>
            {nearestInfo && (
              <div style={{ marginTop: 8 }}>
                {nearestInfo.withinRadius ? (
                  <Tag color="success" style={{ fontSize: 12 }}>
                    ✓ Trong khu vực {nearestInfo.loc.ten} — cách {Math.round(nearestInfo.dist)} m
                  </Tag>
                ) : (
                  <Tag color="warning" style={{ fontSize: 12 }}>
                    ⚠ Cách {nearestInfo.loc.ten} {Math.round(nearestInfo.dist)} m
                    (vượt {nearestInfo.loc.ban_kinh_m} m) — Server sẽ từ chối
                  </Tag>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Selfie */}
      <Card
        size="small"
        style={{ marginBottom: 12 }}
        title={<Space><CameraOutlined /><Text style={{ fontSize: 13 }}>Selfie (tùy chọn)</Text></Space>}
        extra={selfie && <Button size="small" type="link" onClick={() => setSelfie(null)}>Xóa</Button>}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onSelfiePicked(f)
            e.target.value = ''
          }}
        />
        {selfie ? (
          <img src={selfie} alt="Selfie" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 4 }} />
        ) : (
          <Button block icon={<CameraOutlined />} onClick={() => fileInputRef.current?.click()}>
            Chụp ảnh xác minh
          </Button>
        )}
      </Card>

      {/* Action buttons */}
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Button
          block
          type="primary"
          size="large"
          icon={<LoginOutlined />}
          disabled={!gps || hasCheckedIn}
          loading={submitting && confirmType === 'in'}
          onClick={() => setConfirmType('in')}
          style={{ height: 56, fontSize: 16 }}
        >
          {hasCheckedIn ? 'Đã chấm công vào' : 'Chấm công VÀO'}
        </Button>
        <Button
          block
          danger
          size="large"
          icon={<LogoutOutlined />}
          disabled={!gps || !hasCheckedIn || hasCheckedOut}
          loading={submitting && confirmType === 'out'}
          onClick={() => setConfirmType('out')}
          style={{ height: 56, fontSize: 16 }}
        >
          {hasCheckedOut ? 'Đã chấm công ra' : 'Chấm công RA'}
        </Button>
      </Space>

      <Modal
        open={confirmType !== null}
        title={confirmType === 'in' ? 'Xác nhận chấm công VÀO?' : 'Xác nhận chấm công RA?'}
        onCancel={() => setConfirmType(null)}
        onOk={() => confirmType && handleSubmit(confirmType)}
        okText="Xác nhận"
        cancelText="Hủy"
        confirmLoading={submitting}
      >
        {gps && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text>
              <EnvironmentOutlined /> Vị trí: <Text code>{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</Text>
            </Text>
            {nearestInfo && (
              <Text>
                📍 Cách <Text strong>{nearestInfo.loc.ten}</Text>:{' '}
                <Text strong style={{ color: nearestInfo.withinRadius ? '#52c41a' : '#ff4d4f' }}>
                  {Math.round(nearestInfo.dist)} m
                </Text>{' '}
                (cho phép {nearestInfo.loc.ban_kinh_m} m)
              </Text>
            )}
            {selfie && <Text type="secondary">📷 Đã chụp selfie</Text>}
          </Space>
        )}
      </Modal>
    </div>
  )
}

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Compress image to small JPEG data URL (target tiny thumbnail to fit DB 500-char limit)
async function fileToCompressedDataUrl(file: File, size: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const scale = Math.min(size / img.width, size / img.height, 1)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas ctx'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      // Try compressing until data URL ≤ ~480 chars (under 500 DB limit)
      let q = quality
      let dataUrl = canvas.toDataURL('image/jpeg', q)
      while (dataUrl.length > 480 && q > 0.1) {
        q -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', q)
      }
      resolve(dataUrl)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
