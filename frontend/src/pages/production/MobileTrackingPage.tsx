import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Button, Space, Typography, Input, InputNumber, Modal, Form,
  message, Tag, Row, Col, Spin, Empty, Divider, Drawer, Badge, Progress,
} from 'antd'
import {
  PlayCircleFilled, CheckCircleFilled, PauseCircleFilled,
  ArrowLeftOutlined, ScanOutlined, WarningFilled,
  DesktopOutlined, HistoryOutlined as HistoryIcon, LogoutOutlined, CameraOutlined,
  UnorderedListOutlined, InfoCircleOutlined, ClockCircleOutlined,
  CaretRightFilled, ExclamationCircleFilled, SwapOutlined,
} from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useAuthStore } from '../../store/auth'
import { cd2Api, MayIn, MaySauIn, PhieuIn, WorkerSession, TRANG_THAI_COLORS, TRANG_THAI_LABELS } from '../../api/cd2'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import QrScannerModal from '../../components/QrScannerModal'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { socket } from '../../utils/socket'

const OFFLINE_QUEUE_KEY = 'cd2_offline_tracking_queue'
const { Title, Text } = Typography

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtElapsedCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function beep(type: 'success' | 'error' | 'warn') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const play = (freq: number, dur: number, delay = 0) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur / 1000)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + dur / 1000 + 0.01)
    }
    if (type === 'success') { play(880, 80) }
    else if (type === 'error') { play(330, 120); play(330, 120, 0.27) }
    else { play(550, 200) }
  } catch { /* ignore */ }
}

function usePullToRefresh(onRefresh: () => void) {
  const [isPulling, setIsPulling] = useState(false)
  const startYRef = useRef(0)
  const pulledRef = useRef(false)
  const callbackRef = useRef(onRefresh)
  callbackRef.current = onRefresh

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY === 0) startYRef.current = e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (window.scrollY > 0) return
      const dy = e.touches[0].clientY - startYRef.current
      if (dy > 80 && !pulledRef.current) { pulledRef.current = true; setIsPulling(true) }
    }
    const onEnd = () => {
      if (pulledRef.current) {
        if ('vibrate' in navigator) navigator.vibrate(30)
        callbackRef.current()
      }
      pulledRef.current = false; setIsPulling(false)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  return isPulling
}

// ── PhieuDetailDrawer ──────────────────────────────────────────────────────────

function PhieuDetailDrawer({
  phieu, onClose, onSelect,
}: {
  phieu: PhieuIn | null
  onClose: () => void
  onSelect: (p: PhieuIn) => void
}) {
  if (!phieu) return null
  const isOverdue = phieu.ngay_giao_hang
    ? dayjs(phieu.ngay_giao_hang).isBefore(dayjs(), 'day')
    : false

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '9px 0', borderBottom: '1px solid #f5f5f5',
    }}>
      <Text type="secondary" style={{ fontSize: 13, minWidth: 110, flexShrink: 0 }}>{label}</Text>
      <div style={{ textAlign: 'right', fontSize: 14, flex: 1, paddingLeft: 8 }}>{value}</div>
    </div>
  )

  const SectionHeader = ({ title }: { title: string }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14, marginBottom: 2 }}>
      {title}
    </div>
  )

  return (
    <Drawer
      open={!!phieu}
      onClose={onClose}
      placement="bottom"
      height="85vh"
      title={null}
      styles={{ body: { padding: '0 16px 24px', overflowY: 'auto' } }}
      footer={
        <Button
          type="primary" block size="large"
          style={{ borderRadius: 12, height: 52, fontWeight: 700, fontSize: 16, background: '#1a337e' }}
          onClick={() => { onSelect(phieu); onClose() }}
        >
          Chọn làm lệnh hiện tại
        </Button>
      }
    >
      {/* Block header */}
      <div style={{ background: '#1a337e', margin: '0 -16px', padding: '20px 20px 16px', marginBottom: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: 700, color: '#fff', display: 'block', lineHeight: 1.3 }}>
          {phieu.ten_hang || phieu.so_phieu}
        </Text>
        {phieu.quy_cach && (
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', display: 'block', marginTop: 4 }}>
            {phieu.quy_cach}
          </Text>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <Tag color={TRANG_THAI_COLORS[phieu.trang_thai] ?? 'default'} style={{ fontWeight: 600, borderRadius: 6 }}>
            {TRANG_THAI_LABELS[phieu.trang_thai] ?? phieu.trang_thai}
          </Tag>
          {phieu.loai && <Tag style={{ borderRadius: 6 }}>{phieu.loai}</Tag>}
          {phieu.ths && <Tag color="blue" style={{ borderRadius: 6 }}>{phieu.ths}</Tag>}
          {phieu.pp_ghep && <Tag color="purple" style={{ borderRadius: 6 }}>{phieu.pp_ghep}</Tag>}
        </div>
      </div>

      <SectionHeader title="Đơn hàng" />
      <Row label="Khách hàng" value={phieu.ten_khach_hang || '—'} />
      {phieu.ma_kh && <Row label="Mã KH" value={<Text code>{phieu.ma_kh}</Text>} />}
      <Row label="LSX" value={<Text code>{phieu.so_lsx}</Text>} />
      <Row label="Số đơn" value={phieu.so_don || '—'} />
      <Row label="SL phôi" value={
        <Text strong style={{ fontSize: 16, color: '#1a337e' }}>{phieu.so_luong_phoi?.toLocaleString()} tờ</Text>
      } />
      <Row label="Ngày giao" value={phieu.ngay_giao_hang ? (
        <Text style={{ color: isOverdue ? '#f5222d' : '#333' }}>
          {dayjs(phieu.ngay_giao_hang).format('DD/MM/YYYY')}{isOverdue && ' ⚠️ Trễ'}
        </Text>
      ) : '—'} />

      <SectionHeader title="Kỹ thuật" />
      {(phieu.dai || phieu.rong || phieu.cao) && (
        <Row label="Kích thước" value={`${phieu.dai ?? '—'} × ${phieu.rong ?? '—'} × ${phieu.cao ?? '—'} mm`} />
      )}
      {phieu.so_lop != null && <Row label="Số lớp" value={`${phieu.so_lop} lớp`} />}
      {phieu.to_hop_song && <Row label="Tổ hợp sóng" value={phieu.to_hop_song} />}
      {phieu.kho_tt != null && <Row label="Khổ TT" value={`${phieu.kho_tt} mm`} />}
      {phieu.dai_tt != null && <Row label="Dài TT" value={`${phieu.dai_tt} mm`} />}
      <Row label="Loại in" value={phieu.loai_in || '—'} />

      <SectionHeader title="Trạng thái" />
      <Row label="Bắt đầu in" value={phieu.gio_bat_dau_in ? dayjs(phieu.gio_bat_dau_in).format('HH:mm DD/MM') : '—'} />
      {phieu.ghi_chu_printer && (
        <Row label="Ghi chú in" value={<Text style={{ color: '#fa8c16' }}>{phieu.ghi_chu_printer}</Text>} />
      )}
      {phieu.ghi_chu_prepare && (
        <Row label="Ghi chú CB" value={phieu.ghi_chu_prepare} />
      )}
    </Drawer>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MobileTrackingPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const machineIdFromUrl = searchParams.get('machine_id')

  const workerSession = useMemo<WorkerSession | null>(() => {
    try {
      const raw = localStorage.getItem('cd2_worker_session')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [])

  // Sau in mode: kiosk worker được gán vào máy sau in (định hình)
  const isSauInMode = workerSession?.loai_may === 'sau_in'

  const { phanXuongId } = useCD2Workshop()

  const [selectedMachine, setSelectedMachine] = useState<MayIn | MaySauIn | null>(null)
  const [soLsx, setSoLsx] = useState('')
  const [currentOrder, setCurrentOrder] = useState<PhieuIn | null>(null)
  const [detailPhieu, setDetailPhieu] = useState<PhieuIn | null>(null)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [isDinhHinhCompleteModalOpen, setIsDinhHinhCompleteModalOpen] = useState(false)
  const [isNgungInModalOpen, setIsNgungInModalOpen] = useState(false)
  const [isNgungDinhHinhModalOpen, setIsNgungDinhHinhModalOpen] = useState(false)
  const [isStopModalOpen, setIsStopModalOpen] = useState(false)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sauInElapsedSeconds, setSauInElapsedSeconds] = useState(0)
  const [clockTime, setClockTime] = useState(dayjs().format('HH:mm'))
  const isOnline = useOnlineStatus()
  const [offlineQueue, setOfflineQueue] = useState<any[]>([])
  const [form] = Form.useForm()
  const [dinhHinhForm] = Form.useForm()
  const [ngungInForm] = Form.useForm()
  const [ngungDinhHinhForm] = Form.useForm()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sauInTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lsxInputRef = useRef<any>(null)

  // ── Trạng thái logic ──────────────────────────────────────────────────────

  // In mode states
  const isPending = !currentOrder?.trang_thai ||
    currentOrder.trang_thai === 'cho_in' || currentOrder.trang_thai === 'ke_hoach'
  const isRunning  = currentOrder?.trang_thai === 'dang_in' && !currentOrder?.tam_dung_luc
  const isPaused   = currentOrder?.trang_thai === 'dang_in' && !!currentOrder?.tam_dung_luc
  const isPostPrint = currentOrder?.trang_thai === 'cho_dinh_hinh'
    || currentOrder?.trang_thai === 'sau_in'
    || currentOrder?.trang_thai === 'dang_sau_in'
    || currentOrder?.trang_thai === 'hoan_thanh'

  // Sau in (thành phẩm) mode states
  // sau_in chưa có may_sau_in_id = desktop đã bắt đầu nhưng chưa gán máy → worker chưa nhận
  const isSauInPending = currentOrder?.trang_thai === 'cho_dinh_hinh'
    || (currentOrder?.trang_thai === 'sau_in' && !currentOrder?.may_sau_in_id)
  const isSauInRunning = ((currentOrder?.trang_thai === 'sau_in' && !!currentOrder?.may_sau_in_id)
    || currentOrder?.trang_thai === 'dang_sau_in') && !currentOrder?.tam_dung_luc
  const isSauInPaused  = ((currentOrder?.trang_thai === 'sau_in' && !!currentOrder?.may_sau_in_id)
    || currentOrder?.trang_thai === 'dang_sau_in') && !!currentOrder?.tam_dung_luc
  const isSauInDone    = currentOrder?.trang_thai === 'hoan_thanh'

  // Pill trạng thái máy hiện ở header
  const statusPill = isSauInMode
    ? (isSauInRunning
        ? { text: 'ĐANG LÀM TP', bg: '#722ed1' }
        : currentOrder && isSauInPending
        ? { text: 'CHỜ BẮT ĐẦU', bg: '#8c8c8c' }
        : isSauInDone
        ? { text: 'HOÀN THÀNH', bg: '#52c41a' }
        : null)
    : (isRunning
        ? { text: 'ĐANG IN', bg: '#52c41a' }
        : isPaused
        ? { text: 'TẠM DỪNG', bg: '#faad14' }
        : currentOrder && isPending
        ? { text: 'CHỜ BẮT ĐẦU', bg: '#8c8c8c' }
        : isPostPrint
        ? { text: 'XONG IN', bg: '#1677ff' }
        : null)

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['cd2-may-in', phanXuongId],
    queryFn: () => cd2Api.listMayIn(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
    enabled: !isSauInMode,
  })

  const { data: maySauIns = [], isLoading: loadingMaySauIns } = useQuery({
    queryKey: ['cd2-may-sau-in', phanXuongId],
    queryFn: () => cd2Api.listMaySauIn(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
    enabled: isSauInMode,
  })

  const { data: machinePhieuList = [] } = useQuery({
    queryKey: isSauInMode
      ? ['machine-phieu-sau-in-list', selectedMachine?.id]
      : ['machine-phieu-list', selectedMachine?.id],
    queryFn: () => isSauInMode
      ? cd2Api.listPhieuIn({ may_sau_in_id: selectedMachine!.id }).then(r => r.data)
      : cd2Api.listPhieuIn({ may_in_id: selectedMachine!.id }).then(r => r.data),
    enabled: !!selectedMachine,
    refetchInterval: 30000,
  })

  const { data: factoryLogs = [] } = useQuery({
    queryKey: ['factory-logs'],
    queryFn: () => cd2Api.getMachineLogs(0).then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: progress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['order-progress', currentOrder?.so_lsx],
    queryFn: () => cd2Api.getOrderProgress(currentOrder?.production_order_id ?? 0).then(r => r.data),
    enabled: !!currentOrder?.so_lsx,
  })

  const { user } = useAuthStore()

  // ── Session auto-select ───────────────────────────────────────────────────

  useEffect(() => {
    if (workerSession?.machine_id && workerSession?.machine_name && !selectedMachine) {
      setSelectedMachine({ id: workerSession.machine_id, ten_may: workerSession.machine_name, active: true, sort_order: 0 })
    }
  }, [workerSession]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedMachine || workerSession?.machine_id) return
    if (machines.length === 0) return
    if (machineIdFromUrl) {
      const t = machines.find(m => m.id === parseInt(machineIdFromUrl))
      if (t) { setSelectedMachine(t); return }
    }
    if (user?.machine_id) {
      const t = machines.find(m => m.id === user.machine_id)
      if (t) setSelectedMachine(t)
    }
  }, [machineIdFromUrl, machines, selectedMachine, user?.machine_id, workerSession])

  // Đồng bộ currentOrder khi danh sách cập nhật (lấy trạng thái mới nhất)
  // Chỉ cập nhật nếu phiếu vẫn còn trong list — sau complete phiếu rời list nên giữ nguyên optimistic state
  useEffect(() => {
    if (!currentOrder) return
    const updated = machinePhieuList.find(p => p.id === currentOrder.id)
    if (updated) setCurrentOrder(updated)
  }, [machinePhieuList]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer đếm giờ chạy ───────────────────────────────────────────────────

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (isRunning && currentOrder?.gio_bat_dau_in) {
      const start = dayjs(currentOrder.gio_bat_dau_in)
      const update = () => setElapsedSeconds(dayjs().diff(start, 'second'))
      update()
      timerRef.current = setInterval(update, 1000)
    } else {
      setElapsedSeconds(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRunning, currentOrder?.gio_bat_dau_in])

  // ── Timer sau in (gio_bat_dau_dinh_hinh) ────────────────────────────────

  useEffect(() => {
    if (sauInTimerRef.current) clearInterval(sauInTimerRef.current)
    if (isSauInRunning && currentOrder?.gio_bat_dau_dinh_hinh) {
      const start = dayjs(currentOrder.gio_bat_dau_dinh_hinh)
      const update = () => setSauInElapsedSeconds(dayjs().diff(start, 'second'))
      update()
      sauInTimerRef.current = setInterval(update, 1000)
    } else {
      setSauInElapsedSeconds(0)
    }
    return () => { if (sauInTimerRef.current) clearInterval(sauInTimerRef.current) }
  }, [isSauInRunning, currentOrder?.gio_bat_dau_dinh_hinh])

  // ── Live clock (cập nhật mỗi 30 giây) ───────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => setClockTime(dayjs().format('HH:mm')), 30000)
    return () => clearInterval(t)
  }, [])

  // ── Socket: nhận cập nhật real-time từ desktop/worker khác ───────────────

  useEffect(() => {
    const handleUpdate = () => {
      // Invalidate theo prefix — bắt cả các machineId khác nhau
      if (isSauInMode) {
        qc.invalidateQueries({ queryKey: ['machine-phieu-sau-in-list'] })
      } else {
        qc.invalidateQueries({ queryKey: ['machine-phieu-list'] })
      }
    }
    socket.on('machine_status_update', handleUpdate)
    return () => { socket.off('machine_status_update', handleUpdate) }
  }, [isSauInMode, qc])

  // ── Offline queue ─────────────────────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (raw) { try { setOfflineQueue(JSON.parse(raw)) } catch { setOfflineQueue([]) } }
  }, [])

  const saveOfflineLog = useCallback((data: any) => {
    setOfflineQueue(prev => {
      const next = [...prev, { ...data, timestamp: new Date().toISOString() }]
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) syncOfflineLogs()
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  const syncOfflineLogs = async () => {
    const queue = [...offlineQueue]
    message.loading(`Đang đồng bộ ${queue.length} lệnh offline...`, 0)
    let ok = 0
    for (const item of queue) {
      try { await cd2Api.trackProduction(item); ok++ } catch { /* keep */ }
    }
    const remaining = queue.slice(ok)
    setOfflineQueue(remaining)
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
    message.destroy()
    if (ok > 0) { message.success(`Đã đồng bộ ${ok} lệnh!`); invalidate() }
  }

  const invalidate = () => {
    if (isSauInMode) {
      qc.invalidateQueries({ queryKey: ['machine-phieu-sau-in-list', selectedMachine?.id] })
    } else {
      qc.invalidateQueries({ queryKey: ['machine-phieu-list', selectedMachine?.id] })
    }
    if (currentOrder?.so_lsx)
      qc.invalidateQueries({ queryKey: ['order-progress', currentOrder.so_lsx] })
  }

  const isPullingRefresh = usePullToRefresh(invalidate)

  // ── Định hình mutations (sau_in mode) ─────────────────────────────────────

  const dinhHinhStartMutation = useMutation({
    mutationFn: async (phieu_id: number) => {
      // Nếu phiếu chưa được gán máy (cho_dinh_hinh hoặc sau_in chưa có máy), gọi sau-in trước
      if (
        currentOrder?.trang_thai === 'cho_dinh_hinh' ||
        (currentOrder?.trang_thai === 'sau_in' && !currentOrder?.may_sau_in_id)
      ) {
        await cd2Api.startSauIn(phieu_id, {
          may_sau_in_id: selectedMachine?.id,
          printer_user_id: workerSession?.printer_user_id,
        })
      }
      return cd2Api.batDauSauIn(phieu_id)
    },
    onSuccess: () => {
      message.success('Đã bắt đầu làm thành phẩm!')
      setCurrentOrder(prev => prev ? {
        ...prev,
        trang_thai: 'dang_sau_in',
        may_sau_in_id: selectedMachine?.id ?? prev.may_sau_in_id ?? null,
        gio_bat_dau_dinh_hinh: prev.gio_bat_dau_dinh_hinh ?? new Date().toISOString(),
      } : prev)
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  const dinhHinhFinishMutation = useMutation({
    mutationFn: (body: { so_luong_sau_in_ok?: number; so_luong_sau_in_loi?: number; ghi_chu_sau_in?: string }) =>
      cd2Api.hoanThanh(currentOrder!.id, { ...body, printer_user_id: workerSession?.printer_user_id }),
    onSuccess: () => {
      message.success('Đã hoàn thành — đã nhập kho thành phẩm!')
      setCurrentOrder(prev => prev ? { ...prev, trang_thai: 'hoan_thanh' } : prev)
      setIsDinhHinhCompleteModalOpen(false)
      dinhHinhForm.resetFields()
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  // ── Ngưng giữa chừng + tạo phiếu bù ─────────────────────────────────────

  const ngungInMutation = useMutation({
    mutationFn: (values: any) => cd2Api.ngungIn(currentOrder!.id, {
      so_luong_in_ok: values.so_luong_in_ok,
      so_luong_loi: values.so_luong_loi,
      ghi_chu_ket_qua: values.ghi_chu_ket_qua,
    }),
    onSuccess: (res) => {
      const bu = res.data.phieu_bu
      message.success(`Đã ngưng — phiếu bù ${bu.so_phieu} (${bu.so_luong_phoi?.toLocaleString()} tờ) đã tạo`)
      setIsNgungInModalOpen(false)
      ngungInForm.resetFields()
      setCurrentOrder(null)
      setSoLsx('')
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  const ngungDinhHinhMutation = useMutation({
    mutationFn: (values: any) => cd2Api.ngungDinhHinh(currentOrder!.id, {
      so_luong_sau_in_ok: values.so_luong_sau_in_ok,
      so_luong_sau_in_loi: values.so_luong_sau_in_loi,
      ghi_chu_sau_in: values.ghi_chu_sau_in,
    }),
    onSuccess: (res) => {
      const bu = res.data.phieu_bu
      message.success(`Đã ngưng — phiếu bù ${bu.so_phieu} (${bu.so_luong_phoi?.toLocaleString()} tờ) đã tạo`)
      setIsNgungDinhHinhModalOpen(false)
      ngungDinhHinhForm.resetFields()
      setCurrentOrder(null)
      setSoLsx('')
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  // ── Thành phẩm: tạm dừng / tiếp tục ─────────────────────────────────────

  const sauInTamDungMutation = useMutation({
    mutationFn: (ly_do: string) => cd2Api.tamDungIn(currentOrder!.id, { ly_do }),
    onSuccess: (res) => {
      message.success('Đã tạm dừng')
      setCurrentOrder(res.data)
      setIsStopModalOpen(false)
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  const sauInTiepTucMutation = useMutation({
    mutationFn: async () => {
      const res = await cd2Api.tiepTucIn(currentOrder!.id)
      if (currentOrder?.trang_thai === 'sau_in' && currentOrder?.may_sau_in_id) {
        return cd2Api.batDauSauIn(currentOrder.id)
      }
      return res
    },
    onSuccess: (res) => {
      message.success('Tiếp tục làm thành phẩm')
      setCurrentOrder(res.data)
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  // ── Track mutation ────────────────────────────────────────────────────────

  const kioskMachineId = workerSession ? undefined : selectedMachine?.id

  const trackMutation = useMutation({
    mutationFn: (data: any) => {
      if (!isOnline) { saveOfflineLog(data); return Promise.resolve({ data: { ok: true, offline: true } }) }
      return cd2Api.trackProduction(data)
    },
    onSuccess: (res: any, variables: any) => {
      if (res.data?.offline) {
        message.warning('Đã lưu offline. Sẽ đồng bộ khi có mạng.')
      } else {
        message.success('Đã cập nhật!')
        // Cập nhật tức thì currentOrder theo event — không cần đợi refetch
        // (quan trọng với 'complete' vì phiếu sẽ biến khỏi machine-list sau khi may_in_id = null)
        const evt: string = variables?.event_type ?? ''
        setCurrentOrder(prev => {
          if (!prev) return prev
          if (evt === 'start')    return { ...prev, trang_thai: 'dang_in',       tam_dung_luc: null, tam_dung_ly_do: null, gio_bat_dau_in: new Date().toISOString() }
          if (evt === 'stop')     return { ...prev, tam_dung_luc: new Date().toISOString(), tam_dung_ly_do: variables?.ghi_chu ?? null }
          if (evt === 'resume')   return { ...prev, tam_dung_luc: null,           tam_dung_ly_do: null }
          if (evt === 'complete') return { ...prev, trang_thai: 'cho_dinh_hinh', may_in_id: null }
          return prev
        })
      }
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  const buildPayload = (eventType: string, extra = {}) => ({
    production_order_id: currentOrder?.production_order_id ?? 0,
    machine_id: kioskMachineId,
    phieu_in_id: currentOrder?.id ?? undefined,
    event_type: eventType,
    printer_user_id: workerSession?.printer_user_id ?? undefined,
    ...extra,
  })

  // Xác nhận trước BẮT ĐẦU để tránh ghi sai giờ
  const handleStartWithConfirm = () => {
    if ('vibrate' in navigator) navigator.vibrate(50)
    if (!selectedMachine || !currentOrder) return
    Modal.confirm({
      title: 'Xác nhận bắt đầu in',
      content: (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{currentOrder.ten_hang}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            {currentOrder.so_luong_phoi?.toLocaleString()} tờ · {currentOrder.so_lsx}
          </div>
        </div>
      ),
      okText: 'BẮT ĐẦU',
      cancelText: 'Huỷ',
      okButtonProps: {
        style: { background: '#52c41a', borderColor: '#52c41a', height: 44, fontSize: 16, fontWeight: 700 },
      },
      cancelButtonProps: { size: 'large' },
      centered: true,
      icon: <PlayCircleFilled style={{ color: '#52c41a' }} />,
      onOk: () => trackMutation.mutate(buildPayload('start')),
    })
  }

  const handleTrack = (eventType: 'stop' | 'resume' | 'complete', extraData = {}) => {
    if ('vibrate' in navigator) navigator.vibrate(50)
    if (!selectedMachine || !currentOrder) return
    if (eventType === 'complete') { setIsCompleteModalOpen(true); return }
    if (eventType === 'stop')     { setIsStopModalOpen(true); return }
    trackMutation.mutate(buildPayload(eventType, extraData))
  }

  const handleConfirmStop = (reason: string) => {
    if (isSauInMode) {
      sauInTamDungMutation.mutate(reason)
    } else {
      trackMutation.mutate(buildPayload('stop', { ghi_chu: reason }))
      setIsStopModalOpen(false)
    }
  }

  const onFinishComplete = (values: any) => {
    trackMutation.mutate(buildPayload('complete', values))
    setIsCompleteModalOpen(false)
    form.resetFields()
  }

  const handleLookup = async (val: string) => {
    const code = val.trim().toUpperCase()
    if (!code) return

    // Tìm trong danh sách máy đã load — không cần mạng
    const localMatch = machinePhieuList.find(
      p => (p.so_lsx || '').toUpperCase() === code ||
           (p.so_phieu || '').toUpperCase() === code
    )
    if (localMatch) {
      beep('success')
      if ('vibrate' in navigator) navigator.vibrate(60)
      setCurrentOrder(localMatch)
      setShowSearch(false)
      setTimeout(() => window.scrollTo({ top: 400, behavior: 'smooth' }), 100)
      return
    }

    // Không có trong danh sách máy — cần mạng
    if (!isOnline) {
      beep('error')
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
      message.warning('Mất kết nối — không tìm thấy trong danh sách máy. Vui lòng kết nối mạng để tra cứu.')
      return
    }

    try {
      const res = await cd2Api.phieuLookup(code)
      beep('success')
      if ('vibrate' in navigator) navigator.vibrate(60)
      setCurrentOrder(res.data)
      setShowSearch(false)
      setTimeout(() => window.scrollTo({ top: 400, behavior: 'smooth' }), 100)
    } catch {
      beep('error')
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
      message.error('Không tìm thấy Lệnh sản xuất!')
    }
  }

  const handleChangeOrder = () => {
    setCurrentOrder(null)
    setSoLsx('')
    setShowSearch(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleWorkerLogout() {
    localStorage.removeItem('cd2_worker_session')
    navigate('/cd2/machine-login')
  }

  // ── Màn hình chọn máy ─────────────────────────────────────────────────────

  if (!selectedMachine) {
    const displayMachines = isSauInMode ? maySauIns : machines
    const loadingDisplay  = isSauInMode ? loadingMaySauIns : loadingMachines

    return (
      <div style={{ padding: '24px 16px', background: '#f0f2f5', minHeight: '100vh', overflowX: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <DesktopOutlined style={{ fontSize: 40, color: isSauInMode ? '#722ed1' : '#1a337e', marginBottom: 12 }} />
          <Title level={3} style={{ margin: 0, color: isSauInMode ? '#722ed1' : '#1a337e' }}>
            Chọn máy {isSauInMode ? 'thành phẩm' : 'làm việc'}
          </Title>
          <Text type="secondary">Vui lòng chọn máy bạn đang vận hành</Text>
        </div>
        {loadingDisplay ? <div style={{ textAlign: 'center' }}><Spin /></div> : (
          <Row gutter={[16, 16]}>
            {displayMachines.map(m => (
              <Col xs={12} key={m.id}>
                <Card
                  hoverable
                  style={{ borderRadius: 16, textAlign: 'center', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  onClick={() => setSelectedMachine(m)}
                  styles={{ body: { padding: '24px 12px' } }}
                >
                  <Title level={5} style={{ margin: 0, fontSize: 16 }}>{m.ten_may}</Title>
                  <Tag color={isSauInMode ? 'purple' : 'blue'} style={{ marginTop: 10, borderRadius: 4 }}>
                    {isSauInMode ? 'MÁY THÀNH PHẨM' : 'MÁY IN'}
                  </Tag>
                </Card>
              </Col>
            ))}
            {displayMachines.length === 0 && <Col span={24}><Empty description="Chưa có máy nào" /></Col>}
          </Row>
        )}
        <Divider style={{ margin: '32px 0 16px' }}><Text type="secondary">Nhật ký xưởng hôm nay</Text></Divider>
        <Card style={{ borderRadius: 20, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 40 }}>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {factoryLogs.map((log: any, idx: number) => (
              <div key={log.id} style={{ padding: '10px 0', borderBottom: idx < factoryLogs.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <Text strong>{log.ten_may}</Text>
                  <Text type="secondary">{dayjs(log.created_at).format('HH:mm')}</Text>
                </div>
                <div style={{ fontSize: 13 }}>
                  <Tag color={log.event_type === 'complete' ? 'success' : 'processing'} style={{ fontSize: 11 }}>
                    {log.event_type.toUpperCase()}
                  </Tag>
                  <Text>{log.so_phieu}</Text>
                </div>
              </div>
            ))}
            {factoryLogs.length === 0 && <Empty description="Chưa có hoạt động" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </div>
        </Card>
      </div>
    )
  }

  // ── Màn hình chính (đã chọn máy) ─────────────────────────────────────────

  const pendingPhieuList = [...machinePhieuList]
    .filter(p => p.trang_thai !== 'hoan_thanh')
    .sort((a, b) => {
      const ord: Record<string, number> = isSauInMode
        ? { sau_in: 0, dang_sau_in: 0, cho_dinh_hinh: 1 }
        : { dang_in: 0, ke_hoach: 1, cho_in: 2 }
      return (ord[a.trang_thai] ?? 9) - (ord[b.trang_thai] ?? 9)
    })

  const donePhieuList = machinePhieuList.filter(p => p.trang_thai === 'hoan_thanh')

  const borderColor = (t: string) => ({
    dang_in: '#52c41a', ke_hoach: '#1677ff', cho_in: '#fa8c16', hoan_thanh: '#8c8c8c',
    cho_dinh_hinh: '#722ed1', sau_in: '#52c41a', dang_sau_in: '#52c41a',
  }[t] ?? '#d9d9d9')

  // Tiến độ in
  const printPct = currentOrder?.so_luong_phoi && (currentOrder.so_luong_in_ok ?? 0) > 0
    ? Math.min(100, Math.round(((currentOrder.so_luong_in_ok ?? 0) / currentOrder.so_luong_phoi) * 100))
    : null

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', paddingBottom: 60, overflowX: 'hidden' }}>

      {/* ── Pull-to-refresh indicator ── */}
      {isPullingRefresh && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          display: 'flex', justifyContent: 'center', padding: '6px 0',
          background: 'rgba(255,255,255,0.9)', pointerEvents: 'none',
        }}>
          <Spin size="small" />
          <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>Đang làm mới...</span>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background: '#1a337e', padding: '14px 16px 12px',
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
              {selectedMachine.ten_may}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {workerSession && (
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  {workerSession.worker_name}{workerSession.shift ? ` · Ca ${workerSession.shift}` : ''}
                </Text>
              )}
              {/* Pill trạng thái máy */}
              {statusPill && (
                <span style={{
                  background: statusPill.bg, color: '#fff',
                  borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                  letterSpacing: 0.5,
                }}>
                  {statusPill.text}
                </span>
              )}
              {!isOnline && <Tag color="error" style={{ margin: 0, fontSize: 10 }}>MẤT MẠNG</Tag>}
              {offlineQueue.length > 0 && <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>SYNC: {offlineQueue.length}</Tag>}
            </div>
          </div>

          {/* Live clock */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{clockTime}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>
              {dayjs().format('DD/MM')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', maxWidth: 540, margin: '0 auto' }}>

        {/* ── Danh sách LSX của máy (luôn hiện) ── */}
        <Card
          style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 16 }}
          styles={{ body: { padding: '14px 16px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <UnorderedListOutlined style={{ fontSize: 16, color: isSauInMode ? '#722ed1' : '#1a337e' }} />
            <Text strong style={{ fontSize: 15 }}>{isSauInMode ? 'Lệnh chờ làm thành phẩm' : 'Lịch in của máy'}</Text>
            {pendingPhieuList.length > 0 && (
              <Badge count={pendingPhieuList.length} style={{ background: isSauInMode ? '#722ed1' : '#1a337e' }} />
            )}
          </div>

          {pendingPhieuList.length === 0 && donePhieuList.length === 0 && (
            <Empty description="Chưa có lệnh nào được giao" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}

          {pendingPhieuList.map(phieu => {
            const isActive = phieu.id === currentOrder?.id
            const isRunningNow = phieu.trang_thai === 'dang_in' && !phieu.tam_dung_luc
            const elapsed = isRunningNow && phieu.gio_bat_dau_in
              ? fmtElapsed(dayjs().diff(dayjs(phieu.gio_bat_dau_in), 'second'))
              : null
            return (
              <div
                key={phieu.id}
                onClick={() => {
                  setCurrentOrder(phieu)
                  setSoLsx(phieu.so_lsx || phieu.so_phieu || '')
                  setShowSearch(false)
                  setTimeout(() => window.scrollTo({ top: 500, behavior: 'smooth' }), 100)
                }}
                style={{
                  padding: '10px 12px', marginBottom: 8, borderRadius: 12, cursor: 'pointer',
                  background: isActive ? '#e6f4ff' : '#fafafa',
                  border: `2px solid ${isActive ? '#1677ff' : '#f0f0f0'}`,
                  borderLeft: `4px solid ${borderColor(phieu.trang_thai)}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 14 }}>{phieu.so_lsx || phieu.so_phieu}</Text>
                    <Tag color={TRANG_THAI_COLORS[phieu.trang_thai] ?? 'default'} style={{ margin: 0, fontSize: 11 }}>
                      {TRANG_THAI_LABELS[phieu.trang_thai] ?? phieu.trang_thai}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {phieu.ten_hang}
                  </div>
                  {phieu.ten_khach_hang && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {phieu.ten_khach_hang}
                    </div>
                  )}
                  {phieu.quy_cach && (
                    <div style={{ fontSize: 12, color: '#1a337e', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {phieu.quy_cach}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {phieu.loai && <Tag style={{ fontSize: 10, margin: 0, borderRadius: 4, padding: '0 5px' }}>{phieu.loai}</Tag>}
                    {phieu.ths && <Tag color="blue" style={{ fontSize: 10, margin: 0, borderRadius: 4, padding: '0 5px' }}>{phieu.ths}</Tag>}
                    {phieu.pp_ghep && <Tag color="purple" style={{ fontSize: 10, margin: 0, borderRadius: 4, padding: '0 5px' }}>{phieu.pp_ghep}</Tag>}
                    {elapsed && (
                      <Tag color="green" icon={<ClockCircleOutlined />} style={{ fontSize: 10, margin: 0, borderRadius: 4, padding: '0 5px' }}>
                        {elapsed}
                      </Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {(() => {
                      const isTP = ['cho_dinh_hinh', 'sau_in', 'dang_sau_in'].includes(phieu.trang_thai)
                      const slVal = isTP ? (phieu.so_luong_in_ok ?? phieu.so_luong_phoi) : phieu.so_luong_phoi
                      return <Text type="secondary" style={{ fontSize: 11 }}>{slVal?.toLocaleString()} tờ</Text>
                    })()}
                    {phieu.ngay_giao_hang && (
                      <Text style={{ fontSize: 11, color: dayjs(phieu.ngay_giao_hang).isBefore(dayjs(), 'day') ? '#f5222d' : '#888' }}>
                        Giao: {dayjs(phieu.ngay_giao_hang).format('DD/MM')}
                      </Text>
                    )}
                  </div>
                  {phieu.ghi_chu_printer && (
                    <div style={{ fontSize: 11, color: '#fa8c16', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📝 {phieu.ghi_chu_printer}
                    </div>
                  )}
                </div>
                <Button
                  type="link"
                  style={{ flexShrink: 0, padding: '4px 6px', fontSize: 12 }}
                  onClick={e => { e.stopPropagation(); setDetailPhieu(phieu) }}
                >
                  Chi tiết ›
                </Button>
              </div>
            )
          })}

          {donePhieuList.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ✅ {donePhieuList.length} lệnh đã hoàn thành hôm nay
              </Text>
            </div>
          )}
        </Card>

        {/* ── Tìm kiếm: thu gọn khi đã chọn lệnh, mở rộng khi chưa ── */}
        {!currentOrder || showSearch ? (
          <Card
            style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 16 }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Space align="center">
                <ScanOutlined style={{ fontSize: 16, color: '#1677ff' }} />
                <Text strong>Tìm hoặc quét Lệnh SX</Text>
              </Space>
              {currentOrder && (
                <Button type="text" size="small" onClick={() => setShowSearch(false)}>Đóng</Button>
              )}
            </div>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                ref={lsxInputRef}
                placeholder="Nhập hoặc quét số LSX..."
                size="large" allowClear
                value={soLsx}
                onChange={e => setSoLsx(e.target.value.toUpperCase())}
                onPressEnter={() => handleLookup(soLsx)}
              />
              <Button
                size="large" icon={<CameraOutlined />}
                onClick={() => setIsScannerOpen(true)}
                style={{ background: '#1890ff', color: '#fff', border: 'none', width: 60 }}
              />
              <Button
                size="large" type="primary"
                onClick={() => handleLookup(soLsx)}
                style={{ background: '#001529', border: 'none', fontWeight: 600 }}
              >TÌM</Button>
            </Space.Compact>
          </Card>
        ) : (
          /* Thanh mini khi đã có lệnh — nút đổi lệnh */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 12, padding: '0 4px',
          }}>
            <Button
              size="middle" icon={<SwapOutlined />}
              onClick={() => setShowSearch(true)}
              style={{ borderRadius: 20, fontSize: 13, border: '1px solid #d9d9d9', background: '#fff' }}
            >
              Đổi lệnh / Quét mã
            </Button>
            <Button
              size="middle" danger
              onClick={handleChangeOrder}
              style={{ borderRadius: 20, fontSize: 13 }}
            >
              Bỏ chọn
            </Button>
          </div>
        )}

        {/* ── Card phiếu hiện tại ── */}
        {currentOrder && (
          <>
            <Card
              style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 16 }}
              styles={{ body: { padding: '16px 16px 14px' } }}
            >
              {/* Trạng thái + nút chi tiết */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Tag
                  color={TRANG_THAI_COLORS[currentOrder.trang_thai] ?? 'default'}
                  style={{ fontSize: 13, padding: '3px 10px', borderRadius: 8 }}
                >
                  {TRANG_THAI_LABELS[currentOrder.trang_thai] ?? currentOrder.trang_thai}
                </Tag>
                <Button
                  type="text" size="small" icon={<InfoCircleOutlined />}
                  onClick={() => setDetailPhieu(currentOrder)}
                  style={{ color: '#1677ff' }}
                >
                  Chi tiết
                </Button>
              </div>

              <Title level={4} style={{ margin: '0 0 10px' }}>{currentOrder.ten_hang}</Title>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 13 }}>
                {currentOrder.so_lsx
                  ? <div><Text type="secondary">LSX:</Text> <Text strong>{currentOrder.so_lsx}</Text></div>
                  : <div><Text type="secondary">Phiếu:</Text> <Text strong>{currentOrder.so_phieu}</Text></div>
                }
                {currentOrder.so_lsx && (
                  <div><Text type="secondary">Phiếu:</Text> <Text>{currentOrder.so_phieu}</Text></div>
                )}
                <div>
                  <Text type="secondary">SL:</Text>{' '}
                  <Text strong style={{ color: '#1a337e' }}>
                    {(isSauInMode
                      ? (currentOrder.so_luong_in_ok ?? currentOrder.so_luong_phoi)
                      : currentOrder.so_luong_phoi
                    )?.toLocaleString()} tờ
                  </Text>
                </div>
                {currentOrder.quy_cach && <div><Text type="secondary">Quy cách:</Text> <Text>{currentOrder.quy_cach}</Text></div>}
                {currentOrder.loai_in && <div><Text type="secondary">Loại in:</Text> <Text>{currentOrder.loai_in}</Text></div>}
                {currentOrder.ths && <div><Text type="secondary">THS:</Text> <Text>{currentOrder.ths}</Text></div>}
                {currentOrder.pp_ghep && <div><Text type="secondary">PP ghép:</Text> <Text>{currentOrder.pp_ghep}</Text></div>}
              </div>

              {/* Progress bar tiến độ in */}
              {printPct !== null && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#555' }}>Tiến độ in</Text>
                    <Text strong style={{ fontSize: 12, color: printPct >= 100 ? '#52c41a' : '#1677ff' }}>
                      {(currentOrder.so_luong_in_ok ?? 0).toLocaleString()} / {currentOrder.so_luong_phoi?.toLocaleString()} tờ
                    </Text>
                  </div>
                  <Progress
                    percent={printPct}
                    size="small"
                    strokeColor={printPct >= 100 ? '#52c41a' : printPct >= 70 ? '#1677ff' : '#faad14'}
                    trailColor="#f0f0f0"
                    showInfo={true}
                  />
                </div>
              )}

              {/* Đồng hồ đang chạy — in mode */}
              {isRunning && (
                <div style={{
                  marginTop: 12, background: '#f6ffed', borderRadius: 12,
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <ClockCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                    Đang chạy: {fmtElapsed(elapsedSeconds)}
                  </Text>
                </div>
              )}

              {/* Đồng hồ đang chạy — sau in mode */}
              {isSauInMode && isSauInRunning && (
                <div style={{
                  marginTop: 12, background: '#f9f0ff', borderRadius: 12,
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  border: '1px solid #d3adf7',
                }}>
                  <ClockCircleOutlined style={{ color: '#722ed1', fontSize: 20 }} />
                  <div>
                    <div style={{ color: '#722ed1', fontSize: 22, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtElapsedCompact(sauInElapsedSeconds)}
                    </div>
                    <div style={{ color: '#9254de', fontSize: 11, marginTop: 2 }}>Thời gian làm thành phẩm</div>
                  </div>
                </div>
              )}

              {/* Banner tạm dừng */}
              {(isPaused || isSauInPaused) && (
                <div style={{
                  marginTop: 12, background: '#fffbe6', borderRadius: 12,
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                  border: '1px solid #ffe58f',
                }}>
                  <ExclamationCircleFilled style={{ color: '#faad14', fontSize: 18 }} />
                  <div>
                    <Text strong style={{ color: '#d46b08', fontSize: 14 }}>Đang tạm dừng</Text>
                    {currentOrder.tam_dung_ly_do && (
                      <div style={{ color: '#8c6400', fontSize: 12 }}>{currentOrder.tam_dung_ly_do}</div>
                    )}
                    {currentOrder.tam_dung_luc && (
                      <div style={{ color: '#8c6400', fontSize: 11 }}>
                        Từ {dayjs(currentOrder.tam_dung_luc).format('HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Thông báo đã xong in (in mode) + nút đổi lệnh */}
              {!isSauInMode && isPostPrint && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    background: '#f6ffed', borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #b7eb8f',
                    marginBottom: 10,
                  }}>
                    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
                    <Text style={{ color: '#389e0d', fontSize: 14 }}>
                      Đã hoàn thành in — {TRANG_THAI_LABELS[currentOrder.trang_thai]}
                    </Text>
                  </div>
                  <Button
                    block size="large"
                    icon={<SwapOutlined />}
                    onClick={handleChangeOrder}
                    style={{ borderRadius: 16, height: 52, fontWeight: 600, fontSize: 15, border: '2px solid #1677ff', color: '#1677ff' }}
                  >
                    Chọn lệnh tiếp theo
                  </Button>
                </div>
              )}

              {/* Thông báo đã hoàn thành định hình (sau_in mode) */}
              {isSauInMode && isSauInDone && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    background: '#f6ffed', borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #b7eb8f',
                    marginBottom: 10,
                  }}>
                    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
                    <Text style={{ color: '#389e0d', fontSize: 14 }}>
                      Đã hoàn thành — đã nhập kho thành phẩm
                    </Text>
                  </div>
                  <Button
                    block size="large"
                    icon={<SwapOutlined />}
                    onClick={handleChangeOrder}
                    style={{ borderRadius: 16, height: 52, fontWeight: 600, fontSize: 15, border: '2px solid #722ed1', color: '#722ed1' }}
                  >
                    Chọn lệnh tiếp theo
                  </Button>
                </div>
              )}
            </Card>

            {/* ── Nút hành động — THÀNH PHẨM mode ── */}
            {isSauInMode && !isSauInDone && (
              <div style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]}>

                  {/* Chờ bắt đầu → BẮT ĐẦU LÀM TP */}
                  {isSauInPending && (
                    <Col span={24}>
                      <Button
                        type="primary" size="large" block icon={<PlayCircleFilled />}
                        onClick={() => {
                          if ('vibrate' in navigator) navigator.vibrate(50)
                          if (!currentOrder) return
                          Modal.confirm({
                            title: 'Xác nhận bắt đầu làm thành phẩm',
                            content: (
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{currentOrder.ten_hang}</div>
                                <div style={{ color: '#888', fontSize: 13 }}>{currentOrder.so_luong_phoi?.toLocaleString()} tờ · {currentOrder.so_lsx}</div>
                              </div>
                            ),
                            okText: 'BẮT ĐẦU',
                            cancelText: 'Huỷ',
                            okButtonProps: { style: { background: '#722ed1', borderColor: '#722ed1', height: 44, fontSize: 16, fontWeight: 700 } },
                            cancelButtonProps: { size: 'large' },
                            centered: true,
                            icon: <PlayCircleFilled style={{ color: '#722ed1' }} />,
                            onOk: () => dinhHinhStartMutation.mutate(currentOrder.id),
                          })
                        }}
                        loading={dinhHinhStartMutation.isPending}
                        style={{
                          height: 100, borderRadius: 24, background: '#722ed1', border: 'none',
                          fontSize: 22, fontWeight: 700, boxShadow: '0 8px 24px rgba(114,46,209,0.4)',
                        }}
                      >
                        BẮT ĐẦU LÀM TP
                      </Button>
                    </Col>
                  )}

                  {/* Đang chạy → TẠM DỪNG + HOÀN THÀNH + MÁY BỊ LỖI + NGƯNG */}
                  {isSauInRunning && (
                    <>
                      <Col span={12}>
                        <Button
                          size="large" block icon={<PauseCircleFilled />}
                          onClick={() => { if ('vibrate' in navigator) navigator.vibrate(50); setIsStopModalOpen(true) }}
                          style={{
                            height: 80, borderRadius: 20, border: 'none',
                            background: '#faad14', color: '#fff',
                            fontSize: 17, fontWeight: 700, boxShadow: '0 6px 16px rgba(250,173,20,0.3)',
                          }}
                        >
                          TẠM DỪNG
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          type="primary" size="large" block icon={<CheckCircleFilled />}
                          onClick={() => { if ('vibrate' in navigator) navigator.vibrate(50); setIsDinhHinhCompleteModalOpen(true) }}
                          loading={dinhHinhFinishMutation.isPending}
                          style={{
                            height: 80, borderRadius: 20, background: '#722ed1', border: 'none',
                            fontSize: 17, fontWeight: 700, boxShadow: '0 6px 16px rgba(114,46,209,0.3)',
                          }}
                        >
                          HOÀN THÀNH TP
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          size="large" block icon={<WarningFilled />}
                          onClick={() => setIsErrorModalOpen(true)}
                          style={{
                            height: 56, borderRadius: 16, border: '2px solid #f5222d',
                            background: '#fff1f0', color: '#f5222d',
                            fontSize: 16, fontWeight: 700,
                          }}
                        >
                          MÁY BỊ LỖI
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          size="large" block
                          onClick={() => setIsNgungDinhHinhModalOpen(true)}
                          style={{
                            height: 56, borderRadius: 16, border: '2px solid #d46b08',
                            background: '#fff7e6', color: '#d46b08',
                            fontSize: 15, fontWeight: 700,
                          }}
                        >
                          NGƯNG / PHIẾU BÙ
                        </Button>
                      </Col>
                    </>
                  )}

                  {/* Tạm dừng → TIẾP TỤC + HOÀN THÀNH + MÁY LỖI + NGƯNG */}
                  {isSauInPaused && (
                    <>
                      <Col span={24}>
                        <Button
                          type="primary" size="large" block icon={<CaretRightFilled />}
                          onClick={() => { if ('vibrate' in navigator) navigator.vibrate(50); sauInTiepTucMutation.mutate() }}
                          loading={sauInTiepTucMutation.isPending}
                          style={{
                            height: 88, borderRadius: 24, background: '#52c41a', border: 'none',
                            fontSize: 22, fontWeight: 700, boxShadow: '0 8px 24px rgba(82,196,26,0.4)',
                          }}
                        >
                          TIẾP TỤC
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          type="primary" size="large" block icon={<CheckCircleFilled />}
                          onClick={() => setIsDinhHinhCompleteModalOpen(true)}
                          loading={dinhHinhFinishMutation.isPending}
                          style={{ height: 72, borderRadius: 20, background: '#722ed1', border: 'none', fontSize: 16, fontWeight: 700 }}
                        >
                          HOÀN THÀNH TP
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          size="large" block icon={<WarningFilled />}
                          onClick={() => setIsErrorModalOpen(true)}
                          style={{
                            height: 72, borderRadius: 20, border: '2px solid #f5222d',
                            background: '#fff1f0', color: '#f5222d', fontSize: 16, fontWeight: 700,
                          }}
                        >
                          MÁY LỖI
                        </Button>
                      </Col>
                      <Col span={24}>
                        <Button
                          size="large" block
                          onClick={() => setIsNgungDinhHinhModalOpen(true)}
                          style={{
                            height: 52, borderRadius: 16, border: '2px solid #d46b08',
                            background: '#fff7e6', color: '#d46b08',
                            fontSize: 15, fontWeight: 700,
                          }}
                        >
                          NGƯNG HÔM NAY / TẠO PHIẾU BÙ
                        </Button>
                      </Col>
                    </>
                  )}

                </Row>
              </div>
            )}

            {/* ── Nút hành động — IN mode ── */}
            {!isSauInMode && !isPostPrint && (
              <div style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]}>

                  {/* Chờ bắt đầu → chỉ BẮT ĐẦU (có confirm) */}
                  {isPending && (
                    <Col span={24}>
                      <Button
                        type="primary" size="large" block icon={<PlayCircleFilled />}
                        onClick={handleStartWithConfirm}
                        loading={trackMutation.isPending}
                        style={{
                          height: 100, borderRadius: 24, background: '#52c41a', border: 'none',
                          fontSize: 24, fontWeight: 700, boxShadow: '0 8px 24px rgba(82,196,26,0.4)',
                        }}
                      >
                        BẮT ĐẦU
                      </Button>
                    </Col>
                  )}

                  {/* Đang chạy → TẠM DỪNG + HOÀN THÀNH + MÁY LỖI + NGƯNG */}
                  {isRunning && (
                    <>
                      <Col span={12}>
                        <Button
                          size="large" block icon={<PauseCircleFilled />}
                          onClick={() => handleTrack('stop')}
                          style={{
                            height: 80, borderRadius: 20, border: 'none',
                            background: '#faad14', color: '#fff',
                            fontSize: 17, fontWeight: 700, boxShadow: '0 6px 16px rgba(250,173,20,0.3)',
                          }}
                        >
                          TẠM DỪNG
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          type="primary" size="large" block icon={<CheckCircleFilled />}
                          onClick={() => handleTrack('complete')}
                          style={{
                            height: 80, borderRadius: 20, background: '#1a337e', border: 'none',
                            fontSize: 17, fontWeight: 700, boxShadow: '0 6px 16px rgba(26,51,126,0.3)',
                          }}
                        >
                          HOÀN THÀNH
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          size="large" block icon={<WarningFilled />}
                          onClick={() => setIsErrorModalOpen(true)}
                          style={{
                            height: 56, borderRadius: 16, border: '2px solid #f5222d',
                            background: '#fff1f0', color: '#f5222d',
                            fontSize: 16, fontWeight: 700,
                          }}
                        >
                          MÁY BỊ LỖI
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          size="large" block
                          onClick={() => setIsNgungInModalOpen(true)}
                          style={{
                            height: 56, borderRadius: 16, border: '2px solid #d46b08',
                            background: '#fff7e6', color: '#d46b08',
                            fontSize: 15, fontWeight: 700,
                          }}
                        >
                          NGƯNG / PHIẾU BÙ
                        </Button>
                      </Col>
                    </>
                  )}

                  {/* Đang tạm dừng → TIẾP TỤC + HOÀN THÀNH + MÁY LỖI + NGƯNG */}
                  {isPaused && (
                    <>
                      <Col span={24}>
                        <Button
                          type="primary" size="large" block icon={<CaretRightFilled />}
                          onClick={() => handleTrack('resume')}
                          loading={trackMutation.isPending}
                          style={{
                            height: 88, borderRadius: 24, background: '#52c41a', border: 'none',
                            fontSize: 22, fontWeight: 700, boxShadow: '0 8px 24px rgba(82,196,26,0.4)',
                          }}
                        >
                          TIẾP TỤC
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          type="primary" size="large" block icon={<CheckCircleFilled />}
                          onClick={() => handleTrack('complete')}
                          style={{ height: 72, borderRadius: 20, background: '#1a337e', border: 'none', fontSize: 16, fontWeight: 700 }}
                        >
                          HOÀN THÀNH
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          size="large" block icon={<WarningFilled />}
                          onClick={() => setIsErrorModalOpen(true)}
                          style={{
                            height: 72, borderRadius: 20, border: '2px solid #f5222d',
                            background: '#fff1f0', color: '#f5222d', fontSize: 16, fontWeight: 700,
                          }}
                        >
                          MÁY LỖI
                        </Button>
                      </Col>
                      <Col span={24}>
                        <Button
                          size="large" block
                          onClick={() => setIsNgungInModalOpen(true)}
                          style={{
                            height: 52, borderRadius: 16, border: '2px solid #d46b08',
                            background: '#fff7e6', color: '#d46b08',
                            fontSize: 15, fontWeight: 700,
                          }}
                        >
                          NGƯNG HÔM NAY / TẠO PHIẾU BÙ
                        </Button>
                      </Col>
                    </>
                  )}

                </Row>
              </div>
            )}

            {/* ── Nhật ký gần đây ── */}
            <Card
              title={<Space><HistoryIcon /><Text>Nhật ký lệnh này</Text></Space>}
              style={{ borderRadius: 20, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 20 }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              {loadingProgress ? <Spin size="small" /> : (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {(progress || []).slice(0, 8).map((log, idx) => {
                    const workerLabel = log.worker || workerSession?.worker_name || 'Công nhân'
                    return (
                      <div key={log.id} style={{ padding: '8px 0', borderBottom: idx < 7 ? '1px solid #f0f0f0' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Tag
                            color={
                              log.event_type === 'complete' ? 'success'
                                : log.event_type === 'error' ? 'error'
                                : log.event_type === 'stop' ? 'warning'
                                : log.event_type === 'resume' ? 'cyan'
                                : 'processing'
                            }
                            style={{ fontSize: 11, margin: 0 }}
                          >
                            {log.event_type.toUpperCase()}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>{workerLabel}</Text>
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                            {dayjs(log.created_at).format('HH:mm')}
                          </Text>
                        </div>
                        {log.ghi_chu && (
                          <Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>{log.ghi_chu}</Text>
                        )}
                      </div>
                    )
                  })}
                  {(progress || []).length === 0 && (
                    <Empty description="Chưa có lịch sử" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* ── Modal HOÀN THÀNH — key reset form đúng khi đổi lệnh ── */}
      <Modal
        key={currentOrder?.id ?? 'no-order'}
        title={<Title level={4} style={{ margin: 0 }}>Báo cáo kết quả</Title>}
        open={isCompleteModalOpen}
        onCancel={() => setIsCompleteModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinishComplete}
          initialValues={{ quantity_ok: currentOrder?.so_luong_phoi }}
        >
          <div style={{ background: '#f6ffed', padding: 16, borderRadius: 16, marginBottom: 20 }}>
            <Form.Item name="quantity_ok" label={<Text strong>Số lượng ĐẠT (OK)</Text>} rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} size="large" autoFocus placeholder="0" />
            </Form.Item>
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantity_loi" label="Số lượng LỖI">
                <InputNumber style={{ width: '100%' }} size="large" placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quantity_setup" label="Số phôi SETUP">
                <InputNumber style={{ width: '100%' }} size="large" placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu" label="Ghi chú thêm">
            <Input.TextArea placeholder="Lý do lỗi..." rows={2} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Button
            type="primary" size="large" block htmlType="submit" loading={trackMutation.isPending}
            style={{ height: 60, borderRadius: 16, background: '#1a337e', fontSize: 18, fontWeight: 700 }}
          >
            GỬI BÁO CÁO
          </Button>
        </Form>
      </Modal>

      {/* ── Modal HOÀN THÀNH ĐỊNH HÌNH ── */}
      <Modal
        key={`dinh-hinh-${currentOrder?.id ?? 'no-order'}`}
        title={<Title level={4} style={{ margin: 0, color: '#722ed1' }}>Kết quả thành phẩm</Title>}
        open={isDinhHinhCompleteModalOpen}
        onCancel={() => { setIsDinhHinhCompleteModalOpen(false); dinhHinhForm.resetFields() }}
        footer={null}
        destroyOnClose
        centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <Form
          form={dinhHinhForm}
          layout="vertical"
          onFinish={(values) => dinhHinhFinishMutation.mutate(values)}
          initialValues={{ so_luong_sau_in_ok: currentOrder?.so_luong_in_ok ?? currentOrder?.so_luong_phoi }}
        >
          <div style={{ background: '#f9f0ff', padding: 16, borderRadius: 16, marginBottom: 20, border: '1px solid #d3adf7' }}>
            <Form.Item name="so_luong_sau_in_ok" label={<Text strong>Số lượng ĐẠT (OK)</Text>} rules={[{ required: true, message: 'Nhập số lượng đạt' }]}>
              <InputNumber style={{ width: '100%' }} size="large" autoFocus placeholder="0" min={0} />
            </Form.Item>
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_luong_sau_in_loi" label="Số lượng LỖI">
                <InputNumber style={{ width: '100%' }} size="large" placeholder="0" min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu_sau_in" label="Ghi chú">
            <Input.TextArea placeholder="Ghi chú thêm..." rows={2} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Button
            type="primary" size="large" block htmlType="submit" loading={dinhHinhFinishMutation.isPending}
            style={{ height: 60, borderRadius: 16, background: '#722ed1', fontSize: 18, fontWeight: 700 }}
          >
            XÁC NHẬN HOÀN THÀNH
          </Button>
        </Form>
      </Modal>

      {/* ── Modal TẠM DỪNG ── */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Lý do dừng máy?</Title>}
        open={isStopModalOpen}
        onCancel={() => setIsStopModalOpen(false)}
        footer={null} centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
          {[
            { label: 'Thay dao / Thay khuôn', color: '#1677ff' },
            { label: 'Sửa chữa / Bảo trì', color: '#f5222d' },
            { label: 'Chờ phôi / Chờ vật tư', color: '#faad14' },
            { label: 'Nghỉ giữa ca / Ăn cơm', color: '#8c8c8c' },
            { label: 'Vệ sinh máy', color: '#52c41a' },
            { label: 'Lý do khác...', color: '#1a337e' },
          ].map(item => (
            <Button
              key={item.label} size="large" block
              style={{ height: 52, borderRadius: 12, textAlign: 'left', paddingLeft: 20, fontSize: 15, fontWeight: 500, borderColor: item.color, color: item.color }}
              onClick={() => handleConfirmStop(item.label)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Modal>

      {/* ── Modal MÁY LỖI ── */}
      <Modal
        title={<Space><WarningFilled style={{ color: '#f5222d' }} /><Title level={4} style={{ margin: 0, color: '#f5222d' }}>Báo lỗi máy</Title></Space>}
        open={isErrorModalOpen}
        onCancel={() => setIsErrorModalOpen(false)}
        footer={null} centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
          {[
            { label: 'Máy bị kẹt / Không chạy được', color: '#f5222d' },
            { label: 'Chất lượng in bị lỗi (mờ, lệch)', color: '#fa541c' },
            { label: 'Dao bị vỡ / Khuôn hỏng', color: '#fa8c16' },
            { label: 'Điện / Khí nén bị sự cố', color: '#d4380d' },
            { label: 'Lỗi khác...', color: '#8c0000' },
          ].map(item => (
            <Button
              key={item.label} size="large" block
              style={{ height: 52, borderRadius: 12, textAlign: 'left', paddingLeft: 20, fontSize: 15, fontWeight: 500, borderColor: item.color, color: item.color, background: '#fff1f0' }}
              onClick={() => {
                if (isSauInMode) {
                  sauInTamDungMutation.mutate(item.label)
                } else {
                  trackMutation.mutate(buildPayload('error', { ghi_chu: item.label }))
                }
                setIsErrorModalOpen(false)
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Modal>

      {/* ── Modal NGƯNG IN / TẠO PHIẾU BÙ ── */}
      <Modal
        key={`ngung-in-${currentOrder?.id ?? 'no-order'}`}
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#d46b08' }}>Ngưng hôm nay — Tạo phiếu bù</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Phiếu bù sẽ được tạo để in số lượng còn lại ngày mai
            </div>
          </div>
        }
        open={isNgungInModalOpen}
        onCancel={() => { setIsNgungInModalOpen(false); ngungInForm.resetFields() }}
        footer={null}
        destroyOnClose
        centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <Form
          form={ngungInForm}
          layout="vertical"
          onFinish={(values) => ngungInMutation.mutate(values)}
          initialValues={{ so_luong_in_ok: 0 }}
        >
          <div style={{ background: '#fff7e6', padding: 16, borderRadius: 16, marginBottom: 16, border: '1px solid #ffd591' }}>
            <div style={{ fontSize: 13, color: '#8c6400', marginBottom: 8 }}>
              Tổng phôi cần in: <strong>{currentOrder?.so_luong_phoi?.toLocaleString()} tờ</strong>
            </div>
            <Form.Item
              name="so_luong_in_ok"
              label={<Text strong>Số lượng đã in được hôm nay (OK)</Text>}
              rules={[{ required: true, message: 'Nhập số lượng đã làm' }]}
            >
              <InputNumber style={{ width: '100%' }} size="large" autoFocus min={0}
                max={currentOrder?.so_luong_phoi} placeholder="0" />
            </Form.Item>
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_luong_loi" label="Số lượng LỖI">
                <InputNumber style={{ width: '100%' }} size="large" placeholder="0" min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu_ket_qua" label="Ghi chú">
            <Input.TextArea placeholder="Lý do ngưng, ghi chú thêm..." rows={2} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Button
            size="large" block htmlType="submit" loading={ngungInMutation.isPending}
            style={{
              height: 56, borderRadius: 16, border: '2px solid #d46b08',
              background: '#fff7e6', color: '#d46b08', fontSize: 16, fontWeight: 700,
            }}
          >
            XÁC NHẬN NGƯNG & TẠO PHIẾU BÙ
          </Button>
        </Form>
      </Modal>

      {/* ── Modal NGƯNG ĐỊNH HÌNH / TẠO PHIẾU BÙ ── */}
      <Modal
        key={`ngung-dh-${currentOrder?.id ?? 'no-order'}`}
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#d46b08' }}>Ngưng hôm nay — Tạo phiếu bù</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Phiếu bù sẽ được tạo để làm thành phẩm số lượng còn lại
            </div>
          </div>
        }
        open={isNgungDinhHinhModalOpen}
        onCancel={() => { setIsNgungDinhHinhModalOpen(false); ngungDinhHinhForm.resetFields() }}
        footer={null}
        destroyOnClose
        centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <Form
          form={ngungDinhHinhForm}
          layout="vertical"
          onFinish={(values) => ngungDinhHinhMutation.mutate(values)}
          initialValues={{ so_luong_sau_in_ok: 0 }}
        >
          <div style={{ background: '#fff7e6', padding: 16, borderRadius: 16, marginBottom: 16, border: '1px solid #ffd591' }}>
            <div style={{ fontSize: 13, color: '#8c6400', marginBottom: 8 }}>
              Tổng cần làm TP: <strong>{(currentOrder?.so_luong_in_ok ?? currentOrder?.so_luong_phoi)?.toLocaleString()} tờ</strong>
            </div>
            <Form.Item
              name="so_luong_sau_in_ok"
              label={<Text strong>Số lượng đã làm TP được hôm nay (OK)</Text>}
              rules={[{ required: true, message: 'Nhập số lượng đã làm' }]}
            >
              <InputNumber style={{ width: '100%' }} size="large" autoFocus min={0}
                max={currentOrder?.so_luong_in_ok ?? currentOrder?.so_luong_phoi} placeholder="0" />
            </Form.Item>
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="so_luong_sau_in_loi" label="Số lượng LỖI">
                <InputNumber style={{ width: '100%' }} size="large" placeholder="0" min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu_sau_in" label="Ghi chú">
            <Input.TextArea placeholder="Lý do ngưng, ghi chú thêm..." rows={2} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Button
            size="large" block htmlType="submit" loading={ngungDinhHinhMutation.isPending}
            style={{
              height: 56, borderRadius: 16, border: '2px solid #d46b08',
              background: '#fff7e6', color: '#d46b08', fontSize: 16, fontWeight: 700,
            }}
          >
            XÁC NHẬN NGƯNG & TẠO PHIẾU BÙ
          </Button>
        </Form>
      </Modal>

      {/* ── Drawer chi tiết phiếu ── */}
      <PhieuDetailDrawer
        phieu={detailPhieu}
        onClose={() => setDetailPhieu(null)}
        onSelect={p => { setCurrentOrder(p); setSoLsx(p.so_lsx || p.so_phieu || ''); setShowSearch(false) }}
      />

      <QrScannerModal
        open={isScannerOpen}
        onScan={text => { setIsScannerOpen(false); setSoLsx(text); handleLookup(text) }}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  )
}
