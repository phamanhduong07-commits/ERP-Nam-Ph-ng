import { useState, useRef, useEffect, useMemo } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Button, Card, Col, Drawer, Form, Input, InputNumber, message,
  Popconfirm, Row, Space, Spin, Tag, Typography, Empty, Badge, Divider,
} from 'antd'
import type { InputRef } from 'antd'
import type { InputNumberRef } from 'rc-input-number'
import {
  BarcodeOutlined, CameraOutlined, CheckCircleFilled, DeleteOutlined,
  LogoutOutlined, ArrowLeftOutlined, SettingOutlined, HistoryOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, MayScan, PhieuIn, ScanLog, ScanLookupResult, WorkerSession, TRANG_THAI_COLORS, TRANG_THAI_LABELS } from '../../api/cd2'
import MayScanSettingsModal from './MayScanSettingsModal'
import QrScannerModal from '../../components/QrScannerModal'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import { socket } from '../../utils/socket'

const { Title, Text } = Typography
const SCAN_COLOR = '#0891b2'

interface LookupState {
  loading: boolean
  result: ScanLookupResult | null
  error: string | null
}

export default function ScanMayPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const machineIdFromUrl = useMemo(() => {
    const v = searchParams.get('machine_id')
    return v ? parseInt(v) : null
  }, [searchParams])

  // Worker session (kiosk login)
  const workerSession = useMemo<WorkerSession | null>(() => {
    try {
      const raw = localStorage.getItem('cd2_worker_session')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [])

  const [selectedMachine, setSelectedMachine] = useState<number | null>(machineIdFromUrl)
  const [soLsx, setSoLsx] = useState('')
  const [lookup, setLookup] = useState<LookupState>({ loading: false, result: null, error: null })
  const [phieuDetail, setPhieuDetail] = useState<PhieuIn | null>(null)
  const [showPhieuDrawer, setShowPhieuDrawer] = useState(false)
  const [soLuong, setSoLuong] = useState<number | null>(null)
  const [nguoiSx, setNguoiSx] = useState(workerSession?.worker_name ?? '')
  const [gioBatDau, setGioBatDau] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [clockTime, setClockTime] = useState(dayjs().format('HH:mm'))
  const lsxRef = useRef<InputRef>(null)
  const slRef = useRef<InputNumberRef>(null)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  // Auto-select từ session worker
  useEffect(() => {
    if (workerSession?.machine_id && !selectedMachine) {
      setSelectedMachine(workerSession.machine_id)
    }
  }, [workerSession]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClockTime(dayjs().format('HH:mm')), 30000)
    return () => clearInterval(t)
  }, [])

  const { data: mayScanList = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['may-scan', phanXuongId],
    queryFn: () =>
      cd2Api.listMayScan(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined)
        .then(r => (Array.isArray(r.data) ? r.data.filter((m: MayScan) => m.active) : []))
        .catch(() => []),
  })

  // Auto-select URL param hoặc máy đầu tiên
  useEffect(() => {
    if (selectedMachine || workerSession?.machine_id) return
    if (machineIdFromUrl) {
      setSelectedMachine(machineIdFromUrl)
    } else if (mayScanList.length > 0) {
      setSelectedMachine(mayScanList[0].id)
    }
  }, [mayScanList, machineIdFromUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentMachine = mayScanList.find((m: MayScan) => m.id === selectedMachine)

  const { data: todayLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['scan-history', selectedMachine],
    queryFn: () =>
      cd2Api.getScanHistory({ may_scan_id: selectedMachine ?? undefined, days: 1 })
        .then(r => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
    enabled: !!selectedMachine,
    refetchInterval: 30_000,
  })

  const submitMutation = useMutation({
    mutationFn: (data: Parameters<typeof cd2Api.createScanLog>[0]) => cd2Api.createScanLog(data),
    onSuccess: () => {
      message.success('Đã lưu sản lượng!')
      const savedSoLsx = soLsx
      setSoLuong(null)
      setGioBatDau(null)
      qc.invalidateQueries({ queryKey: ['scan-history', selectedMachine] })
      qc.invalidateQueries({ queryKey: ['scan-history-all'] })
      qc.invalidateQueries({ queryKey: ['cd2-dashboard'] })
      // Re-lookup lại để cập nhật lich_su_scan và tiến độ ngay sau khi lưu
      setTimeout(() => {
        handleLookup(savedSoLsx)
        lsxRef.current?.focus()
      }, 300)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lưu thất bại, vui lòng thử lại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cd2Api.deleteScanLog(id),
    onSuccess: () => {
      message.success('Đã xoá')
      qc.invalidateQueries({ queryKey: ['scan-history', selectedMachine] })
    },
  })

  // Socket: nhận cập nhật real-time khi máy scan khác nộp sản lượng
  useEffect(() => {
    const handleUpdate = () => {
      qc.invalidateQueries({ queryKey: ['scan-history'] })
    }
    socket.on('machine_status_update', handleUpdate)
    return () => { socket.off('machine_status_update', handleUpdate) }
  }, [qc])

  const handleLookup = async (val?: string) => {
    const code = (val ?? soLsx).trim().toUpperCase()
    if (!code) return
    setSoLsx(code)
    setLookup({ loading: true, result: null, error: null })
    setPhieuDetail(null)
    setSoLuong(null)
    setGioBatDau(null)
    try {
      const res = await cd2Api.scanLookup(code, selectedMachine ?? undefined)
      setLookup({ loading: false, result: res.data, error: null })
      setGioBatDau(new Date().toISOString())
      setTimeout(() => slRef.current?.focus?.(), 100)
      // Lấy thêm thông tin phiếu in đầy đủ (nếu có)
      cd2Api.phieuLookup(code).then(r => {
        if (r.data) setPhieuDetail(r.data as unknown as PhieuIn)
      }).catch(() => { /* không có phiếu in thì bỏ qua */ })
    } catch {
      setLookup({ loading: false, result: null, error: 'Không tìm thấy lệnh sản xuất' })
    }
  }

  const handleSubmit = () => {
    if (!selectedMachine) { message.warning('Chọn máy scan'); return }
    if (!soLsx.trim()) { message.warning('Nhập số lệnh SX'); return }
    if (!soLuong || soLuong <= 0) { message.warning('Nhập số lượng TP'); return }

    // Validate client-side: không vượt 110% kế hoạch
    const kh = lookup.result?.so_luong_ke_hoach
    const da = lookup.result?.da_scan ?? 0
    if (kh != null && (da + soLuong) > kh * 1.1) {
      const conLai = Math.max(0, kh * 1.1 - da)
      message.error(`Vượt giới hạn 110%: đã scan ${da.toLocaleString('vi-VN')} / ${kh.toLocaleString('vi-VN')} kế hoạch. Còn có thể nhập: ${conLai.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}`)
      return
    }

    const dtPerUnit = lookup.result?.dien_tich_don_vi ?? null
    const dienTich = dtPerUnit != null ? parseFloat((dtPerUnit * soLuong).toFixed(4)) : undefined
    const donGia = currentMachine?.don_gia ?? undefined

    submitMutation.mutate({
      may_scan_id: selectedMachine,
      so_lsx: soLsx.trim().toUpperCase(),
      ten_hang: lookup.result?.ten_hang ?? undefined,
      dai: lookup.result?.dai ?? undefined,
      rong: lookup.result?.rong ?? undefined,
      cao: lookup.result?.cao ?? undefined,
      kho_tt: lookup.result?.kho_tt ?? undefined,
      dien_tich: dienTich,
      so_luong_tp: soLuong,
      don_gia: donGia != null ? Number(donGia) : undefined,
      nguoi_sx: nguoiSx.trim() || undefined,
      gio_bat_dau: gioBatDau ?? undefined,
      gio_ket_thuc: new Date().toISOString(),
    })
  }

  function handleWorkerLogout() {
    localStorage.removeItem('cd2_worker_session')
    navigate('/cd2/machine-login')
  }

  // Thống kê hôm nay
  const logs = Array.isArray(todayLogs) ? todayLogs : []
  const todayTotal = logs.reduce((s: number, l: ScanLog) => s + l.so_luong_tp, 0)
  const todayDt = logs.reduce((s: number, l: ScanLog) => s + (l.dien_tich ?? 0), 0)
  const todayLuong = logs.reduce((s: number, l: ScanLog) => s + (l.tien_luong ?? 0), 0)

  const dtPerUnit = lookup.result?.dien_tich_don_vi ?? null
  const totalDt = dtPerUnit != null && soLuong ? dtPerUnit * soLuong : null
  const donGiaNum = currentMachine?.don_gia ? Number(currentMachine.don_gia) : null
  const tienLuong = totalDt != null && donGiaNum ? totalDt * donGiaNum : null

  // ── Màn hình chọn máy ─────────────────────────────────────────────────────

  if (!selectedMachine) {
    return (
      <div style={{ padding: '24px 16px', background: '#f0f2f5', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <BarcodeOutlined style={{ fontSize: 40, color: SCAN_COLOR, marginBottom: 12 }} />
          <Title level={3} style={{ margin: 0, color: SCAN_COLOR }}>Chọn máy scan</Title>
          <Text type="secondary">Vui lòng chọn máy bạn đang vận hành</Text>
        </div>
        {loadingMachines ? <div style={{ textAlign: 'center' }}><Spin /></div> : (
          <Row gutter={[16, 16]}>
            {mayScanList.map((m: MayScan) => (
              <Col xs={12} key={m.id}>
                <Card
                  hoverable
                  style={{ borderRadius: 16, textAlign: 'center', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  onClick={() => setSelectedMachine(m.id)}
                  styles={{ body: { padding: '24px 12px' } }}
                >
                  <Title level={5} style={{ margin: 0, fontSize: 16 }}>{m.ten_may}</Title>
                  <Tag color="cyan" style={{ marginTop: 10, borderRadius: 4 }}>
                    {m.loai === 'can_mang' ? 'Cán màng' : m.loai === 'xa' ? 'Xả' : 'Scan'}
                  </Tag>
                  {m.don_gia != null && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {Number(m.don_gia).toLocaleString('vi-VN')}đ/m²
                    </div>
                  )}
                </Card>
              </Col>
            ))}
            {mayScanList.length === 0 && (
              <Col span={24}>
                <Empty description="Chưa có máy scan nào" />
                <Button icon={<SettingOutlined />} onClick={() => setShowSettings(true)} style={{ marginTop: 16 }}>
                  Cấu hình máy scan
                </Button>
              </Col>
            )}
          </Row>
        )}
        {showSettings && (
          <MayScanSettingsModal
            open
            onClose={() => setShowSettings(false)}
            onSaved={() => { setShowSettings(false); qc.invalidateQueries({ queryKey: ['may-scan'] }) }}
          />
        )}
      </div>
    )
  }

  // ── Màn hình chính ────────────────────────────────────────────────────────

  const loaiLabel = currentMachine?.loai === 'can_mang' ? 'Cán màng'
    : currentMachine?.loai === 'xa' ? 'Xả' : 'Scan'

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', paddingBottom: 60 }}>

      {/* ── Header ── */}
      <div style={{
        background: SCAN_COLOR, padding: '14px 16px 12px',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {workerSession ? (
            <Button
              icon={<LogoutOutlined />} shape="circle" onClick={handleWorkerLogout}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', flexShrink: 0 }}
            />
          ) : (
            <Button
              icon={<ArrowLeftOutlined />} shape="circle" onClick={() => setSelectedMachine(null)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', flexShrink: 0 }}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
              {currentMachine?.ten_may ?? 'Máy scan'}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {workerSession && (
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  {workerSession.worker_name}{workerSession.shift ? ` · Ca ${workerSession.shift}` : ''}
                </Text>
              )}
              <span style={{
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
              }}>
                {loaiLabel.toUpperCase()}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{clockTime}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>
              {dayjs().format('DD/MM')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', maxWidth: 540, margin: '0 auto' }}>

        {/* ── Thống kê hôm nay ── */}
        {todayTotal > 0 && (
          <Card
            style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 16 }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: SCAN_COLOR }}>
                  {todayTotal.toLocaleString('vi-VN')}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>TP hôm nay</div>
              </div>
              {todayDt > 0 && (
                <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>
                    {todayDt.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>m² hôm nay</div>
                </div>
              )}
              {todayLuong > 0 && (
                <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>
                    {(todayLuong / 1000).toFixed(0)}K
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>Tiền lương</div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Khu vực scan LSX ── */}
        <Card
          style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 16 }}
          styles={{ body: { padding: '16px 16px 14px' } }}
        >
          {/* Trạng thái lookup */}
          <div style={{
            background: lookup.result ? '#f6ffed' : lookup.error ? '#fff2f0' : '#e6fffb',
            border: `2px dashed ${lookup.result ? '#52c41a' : lookup.error ? '#ff4d4f' : SCAN_COLOR}`,
            borderRadius: 16, padding: '16px', marginBottom: 14, textAlign: 'center',
          }}>
            {!lookup.result && !lookup.error && !lookup.loading && (
              <>
                <BarcodeOutlined style={{ fontSize: 40, color: SCAN_COLOR, display: 'block', margin: '0 auto 6px' }} />
                <Text style={{ fontSize: 14, color: SCAN_COLOR, fontWeight: 600 }}>Sẵn sàng quét</Text>
              </>
            )}
            {lookup.loading && (
              <>
                <Spin size="large" style={{ display: 'block', margin: '0 auto 8px' }} />
                <Text style={{ fontSize: 13, color: '#fa8c16' }}>Đang tra cứu...</Text>
              </>
            )}
            {lookup.error && (
              <>
                <div style={{ fontSize: 28, marginBottom: 4 }}>❌</div>
                <Text style={{ fontSize: 14, color: '#ff4d4f', fontWeight: 600 }}>{lookup.error}</Text>
              </>
            )}
            {lookup.result && (
              <>
                <CheckCircleFilled style={{ fontSize: 28, color: '#52c41a', display: 'block', margin: '0 auto 6px' }} />
                <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>
                  {lookup.result.ten_hang}
                </Text>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {lookup.result.dai && (
                    <Tag style={{ borderRadius: 8, fontSize: 12 }}>
                      {+lookup.result.dai}×{+lookup.result.rong}×{+lookup.result.cao}
                    </Tag>
                  )}
                  {lookup.result.kho_tt && <Tag color="blue" style={{ borderRadius: 8, fontSize: 12 }}>Khổ TT: {lookup.result.kho_tt}</Tag>}
                  {lookup.result.dien_tich_don_vi && (
                    <Tag color="purple" style={{ borderRadius: 8, fontSize: 12 }}>
                      {lookup.result.dien_tich_don_vi.toFixed(4)} m²/cái
                    </Tag>
                  )}
                  {phieuDetail?.trang_thai && (
                    <Tag
                      color={TRANG_THAI_COLORS[phieuDetail.trang_thai] ?? 'default'}
                      style={{ borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                    >
                      {TRANG_THAI_LABELS[phieuDetail.trang_thai] ?? phieuDetail.trang_thai}
                    </Tag>
                  )}
                </div>
                {phieuDetail && (
                  <Button
                    type="link" size="small"
                    icon={<InfoCircleOutlined />}
                    style={{ marginTop: 6, fontSize: 13 }}
                    onClick={() => setShowPhieuDrawer(true)}
                  >
                    Xem chi tiết LSX
                  </Button>
                )}

                {/* Tiến độ scan so với kế hoạch */}
                {(() => {
                  const kh = lookup.result!.so_luong_ke_hoach
                  const da = lookup.result!.da_scan ?? 0
                  if (kh == null || kh === 0) return null
                  const pct = (da / kh) * 100
                  const barColor = pct >= 110 ? '#ff4d4f' : pct >= 100 ? '#fa8c16' : pct >= 80 ? '#fadb14' : '#52c41a'
                  const conLai = Math.max(0, kh * 1.1 - da)
                  return (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#f5f5f5', borderRadius: 8, textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12 }}>
                          Đã scan: <strong style={{ color: barColor }}>{da.toLocaleString('vi-VN')}</strong>
                          <Text type="secondary" style={{ fontSize: 11 }}> / {kh.toLocaleString('vi-VN')} KH</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</Text>
                      </div>
                      <div style={{ height: 6, background: '#e0e0e0', borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                      </div>
                      {pct >= 110 ? (
                        <Text style={{ fontSize: 11, color: '#ff4d4f', marginTop: 3, display: 'block', fontWeight: 600 }}>
                          ❌ Đã đạt giới hạn 110% — không thể nhập thêm
                        </Text>
                      ) : pct >= 100 ? (
                        <Text style={{ fontSize: 11, color: '#fa8c16', marginTop: 3, display: 'block' }}>
                          ⚠️ Vượt kế hoạch — còn có thể nhập: {conLai.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                        </Text>
                      ) : null}
                    </div>
                  )
                })()}

                {/* Lịch sử scan gần đây cho LSX này */}
                {lookup.result!.lich_su_scan && lookup.result!.lich_su_scan.length > 0 && (
                  <div style={{ marginTop: 10, textAlign: 'left' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <HistoryOutlined style={{ marginRight: 4 }} />
                      Lịch sử ({lookup.result!.lich_su_scan.length} lần)
                    </Text>
                    <div style={{ marginTop: 5, maxHeight: 130, overflowY: 'auto' }}>
                      {lookup.result!.lich_su_scan.slice(0, 7).map((s: ScanLog) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <Text type="secondary" style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.ten_may}{s.nguoi_sx ? ` · ${s.nguoi_sx}` : ''}
                          </Text>
                          <div style={{ flexShrink: 0, marginLeft: 8 }}>
                            <Text strong style={{ color: SCAN_COLOR, fontSize: 12 }}>{s.so_luong_tp.toLocaleString('vi-VN')}</Text>
                            <Text type="secondary" style={{ fontSize: 10, marginLeft: 5 }}>{dayjs(s.created_at).format('HH:mm DD/MM')}</Text>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input LSX + camera */}
          <Space.Compact style={{ width: '100%', marginBottom: lookup.result ? 0 : 10 }}>
            <Input
              ref={lsxRef}
              size="large"
              placeholder="Quét barcode hoặc nhập số LSX..."
              value={soLsx}
              onChange={e => { setSoLsx(e.target.value.toUpperCase()); if (lookup.error) setLookup({ loading: false, result: null, error: null }) }}
              onPressEnter={() => handleLookup()}
              style={{ fontSize: 15, letterSpacing: 1 }}
              autoFocus
              allowClear
              onFocus={e => e.target.select()}
            />
            <Button
              size="large"
              icon={<CameraOutlined style={{ fontSize: 20 }} />}
              onClick={() => setIsScannerOpen(true)}
              style={{ background: SCAN_COLOR, color: '#fff', border: 'none', width: 56, flexShrink: 0 }}
            />
          </Space.Compact>

          {soLsx && !lookup.result && (
            <Button
              type="primary" size="large" block icon={<BarcodeOutlined />}
              onClick={() => handleLookup()}
              loading={lookup.loading}
              style={{ marginTop: 10, height: 52, fontSize: 15, borderRadius: 12, background: SCAN_COLOR, border: 'none' }}
            >
              Tra cứu
            </Button>
          )}
        </Card>

        {/* ── Nhập sản lượng + Lưu (chỉ hiện khi đã lookup xong) ── */}
        {lookup.result && (
          <Card
            style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 16 }}
            styles={{ body: { padding: '16px 16px 14px' } }}
          >
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 12 }}>
              Nhập sản lượng
            </Text>

            <InputNumber
              ref={slRef}
              size="large"
              style={{ width: '100%', fontSize: 20, marginBottom: 10 }}
              min={1}
              placeholder="Số lượng thành phẩm"
              value={soLuong}
              onChange={v => setSoLuong(v)}
              onPressEnter={handleSubmit}
            />

            {/* Preview DT + tiền */}
            {tienLuong != null && (
              <div style={{
                background: '#e6fffb', borderRadius: 12, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', marginBottom: 10,
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888' }}>Diện tích</div>
                  <div style={{ fontWeight: 700, color: '#0891b2' }}>{totalDt?.toFixed(2)} m²</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>Tiền lương</div>
                  <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 16 }}>
                    {tienLuong.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ
                  </div>
                </div>
              </div>
            )}

            <Input
              size="large"
              placeholder="Tên công nhân (không bắt buộc)"
              value={nguoiSx}
              onChange={e => setNguoiSx(e.target.value)}
              style={{ marginBottom: 14, borderRadius: 10 }}
            />

            <Button
              type="primary" size="large" block
              onClick={handleSubmit}
              loading={submitMutation.isPending}
              disabled={!soLuong || soLuong <= 0}
              icon={<CheckCircleFilled />}
              style={{
                height: 64, borderRadius: 20, background: SCAN_COLOR, border: 'none',
                fontSize: 18, fontWeight: 700, boxShadow: `0 6px 20px rgba(8,145,178,0.4)`,
              }}
            >
              LƯU SẢN LƯỢNG
            </Button>
          </Card>
        )}

        {/* ── Lịch sử hôm nay ── */}
        <Card
          style={{ borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: 'none', marginBottom: 20 }}
          styles={{ body: { padding: '14px 16px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <HistoryOutlined style={{ fontSize: 16, color: SCAN_COLOR }} />
            <Text strong style={{ fontSize: 15 }}>Hôm nay</Text>
            {logs.length > 0 && <Badge count={logs.length} style={{ background: SCAN_COLOR }} />}
            <Button
              size="small" type="text" icon={<span style={{ fontSize: 12 }}>↻</span>}
              onClick={() => refetchLogs()} style={{ marginLeft: 'auto', color: '#888' }}
            />
          </div>

          {logs.length === 0 && (
            <Empty description="Chưa có bản ghi nào hôm nay" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {logs.map((log: ScanLog, idx: number) => {
              const durMin = log.gio_bat_dau && log.gio_ket_thuc
                ? dayjs(log.gio_ket_thuc).diff(dayjs(log.gio_bat_dau), 'minute') : null
              return (
                <div
                  key={log.id}
                  style={{
                    padding: '10px 0', borderBottom: idx < logs.length - 1 ? '1px solid #f0f0f0' : 'none',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>{log.so_lsx}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(log.created_at).format('HH:mm')}
                        {durMin != null && ` · ${durMin < 1 ? '<1' : durMin}p`}
                      </Text>
                    </div>
                    <div style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.ten_hang}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                      <Text style={{ fontSize: 12, color: SCAN_COLOR, fontWeight: 600 }}>
                        {log.so_luong_tp.toLocaleString('vi-VN')} TP
                      </Text>
                      {log.dien_tich != null && (
                        <Text type="secondary" style={{ fontSize: 12 }}>{log.dien_tich.toFixed(2)} m²</Text>
                      )}
                      {log.tien_luong != null && (
                        <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 600 }}>
                          {log.tien_luong.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ
                        </Text>
                      )}
                    </div>
                  </div>
                  <Popconfirm
                    title="Xoá bản ghi này?"
                    onConfirm={() => deleteMutation.mutate(log.id)}
                    okText="Xoá" cancelText="Không"
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ flexShrink: 0 }} />
                  </Popconfirm>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Nút cài đặt — chỉ hiện cho admin (không có workerSession) */}
        {!workerSession && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Button icon={<SettingOutlined />} onClick={() => setShowSettings(true)} type="text" style={{ color: '#888' }}>
              Cấu hình máy scan
            </Button>
          </div>
        )}
      </div>

      {showSettings && (
        <MayScanSettingsModal
          open
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); qc.invalidateQueries({ queryKey: ['may-scan'] }) }}
        />
      )}

      <QrScannerModal
        open={isScannerOpen}
        onScan={text => {
          setIsScannerOpen(false)
          const code = text.trim().toUpperCase()
          setSoLsx(code)
          handleLookup(code)
        }}
        onClose={() => setIsScannerOpen(false)}
      />

      {/* ── Drawer chi tiết LSX ── */}
      <Drawer
        open={showPhieuDrawer}
        onClose={() => setShowPhieuDrawer(false)}
        placement="bottom"
        height="82vh"
        title={null}
        styles={{ body: { padding: '0 16px 24px', overflowY: 'auto' } }}
      >
        {phieuDetail && (() => {
          const p = phieuDetail
          const isOverdue = p.ngay_giao_hang ? dayjs(p.ngay_giao_hang).isBefore(dayjs(), 'day') : false
          const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, color: '#888', minWidth: 110, flexShrink: 0 }}>{label}</span>
              <div style={{ fontSize: 14, textAlign: 'right', flex: 1, paddingLeft: 8 }}>{value}</div>
            </div>
          )
          return (
            <>
              <div style={{ background: SCAN_COLOR, margin: '0 -16px', padding: '20px 20px 16px', marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', display: 'block', lineHeight: 1.3 }}>
                  {p.ten_hang || p.so_phieu}
                </span>
                {p.quy_cach && (
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', display: 'block', marginTop: 4 }}>
                    {p.quy_cach}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {p.trang_thai && (
                    <Tag color={TRANG_THAI_COLORS[p.trang_thai] ?? 'default'} style={{ fontWeight: 600, borderRadius: 6 }}>
                      {TRANG_THAI_LABELS[p.trang_thai] ?? p.trang_thai}
                    </Tag>
                  )}
                  {p.ths && <Tag color="blue" style={{ borderRadius: 6 }}>{p.ths}</Tag>}
                  {p.loai && <Tag style={{ borderRadius: 6 }}>{p.loai}</Tag>}
                  {p.pp_ghep && <Tag color="purple" style={{ borderRadius: 6 }}>{p.pp_ghep}</Tag>}
                </div>
              </div>

              <Divider orientation="left" style={{ fontSize: 11, color: '#aaa', margin: '10px 0 2px' }}>ĐƠN HÀNG</Divider>
              <DetailRow label="Khách hàng" value={p.ten_khach_hang || '—'} />
              {p.ma_kh && <DetailRow label="Mã KH" value={<code style={{ fontSize: 13 }}>{p.ma_kh}</code>} />}
              <DetailRow label="LSX" value={<code style={{ fontSize: 13 }}>{p.so_lsx}</code>} />
              {p.so_don && <DetailRow label="Số đơn" value={p.so_don} />}
              <DetailRow label="SL phôi" value={
                <strong style={{ fontSize: 16, color: '#1a337e' }}>{p.so_luong_phoi?.toLocaleString()} tờ</strong>
              } />
              <DetailRow label="Ngày giao" value={p.ngay_giao_hang ? (
                <span style={{ color: isOverdue ? '#f5222d' : '#333' }}>
                  {dayjs(p.ngay_giao_hang).format('DD/MM/YYYY')}{isOverdue && ' ⚠️ Trễ'}
                </span>
              ) : '—'} />

              <Divider orientation="left" style={{ fontSize: 11, color: '#aaa', margin: '10px 0 2px' }}>KỸ THUẬT</Divider>
              {(p.dai || p.rong || p.cao) && (
                <DetailRow label="Kích thước" value={`${p.dai != null ? +p.dai : '—'} × ${p.rong != null ? +p.rong : '—'} × ${p.cao != null ? +p.cao : '—'} mm`} />
              )}
              {p.so_lop != null && <DetailRow label="Số lớp" value={`${p.so_lop} lớp`} />}
              {p.to_hop_song && <DetailRow label="Tổ hợp sóng" value={p.to_hop_song} />}
              {p.kho_tt != null && <DetailRow label="Khổ TT" value={`${p.kho_tt} mm`} />}
              {p.dai_tt != null && <DetailRow label="Dài TT" value={`${p.dai_tt} mm`} />}
              {p.loai_in && <DetailRow label="Loại in" value={p.loai_in} />}

              {(p.ghi_chu_printer || p.ghi_chu) && (
                <>
                  <Divider orientation="left" style={{ fontSize: 11, color: '#aaa', margin: '10px 0 2px' }}>GHI CHÚ</Divider>
                  {p.ghi_chu_printer && <DetailRow label="Ghi chú in" value={<span style={{ color: '#fa8c16' }}>{p.ghi_chu_printer}</span>} />}
                  {p.ghi_chu && <DetailRow label="Ghi chú" value={p.ghi_chu} />}
                </>
              )}
            </>
          )
        })()}
      </Drawer>
    </div>
  )
}
