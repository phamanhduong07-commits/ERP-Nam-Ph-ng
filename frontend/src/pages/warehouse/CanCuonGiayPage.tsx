import { useState, useEffect, useRef, useCallback } from 'react'
import type { InputNumberRef } from 'rc-input-number'
import type { ApiError } from '../../api/types'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Button, Card, InputNumber, Typography, Space, Tag, Alert, Divider, List, Select, Segmented, message,
} from 'antd'
import {
  ScanOutlined, CheckCircleFilled, CloseCircleFilled, ReloadOutlined, PrinterOutlined,
  SelectOutlined, LogoutOutlined, BranchesOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import QrScannerModal from '../../components/QrScannerModal'
import { warehouseApi, type GiayRoll } from '../../api/warehouse'
import { useAuthStore } from '../../store/auth'
import { usePermission } from '../../hooks/usePermission'
import { productionPlansApi } from '../../api/productionPlans'
import { productionOrdersApi } from '../../api/productionOrders'

const { Title, Text } = Typography

const HISTORY_STORAGE_KEY = 'can_cuon_history'
const HISTORY_LIMIT = 5

const STATUS_COLOR: Record<string, string> = {
  trong_kho: 'blue',
  dang_dung: 'orange',
  da_dung:   'default',
}
const STATUS_LABEL: Record<string, string> = {
  trong_kho: 'Trong kho',
  dang_dung: 'Đang dùng',
  da_dung:   'Đã dùng hết',
}

interface HistoryEntry {
  barcode: string
  ma_chinh: string | null
  kg_truoc: number
  kg_sau: number
  timestamp: string
}

export default function CanCuonGiayPage() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { hasPermission } = usePermission()
  const canImport = hasPermission('inventory.import')
  const isStandalone = location.pathname === '/kho-cuon-giay'

  const handleLogout = () => {
    logout()
    navigate('/kho-login')
  }

  const [barcode, setBarcode]       = useState('')
  const [roll, setRoll]             = useState<GiayRoll | null>(null)
  const [rollList, setRollList]     = useState<GiayRoll[] | null>(null)
  const [kgConLai, setKgConLai]     = useState<number | null>(null)
  const [scanning, setScanning]     = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // LSX / KHSX picker
  const [orderMode, setOrderMode]   = useState<'lsx' | 'khsx'>('khsx')
  const [selectedPlanId, setSelectedPlanId]   = useState<number | null>(null)
  const [planLsxIds, setPlanLsxIds]           = useState<number[]>([])
  const [loadingPlanLsx, setLoadingPlanLsx]   = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)

  const { data: activeSessions } = useQuery({
    queryKey: ['active-production-sessions'],
    queryFn: () => warehouseApi.getActiveProductionSessions().then(r => r.data),
    staleTime: 10_000,
  })

  useEffect(() => {
    if (Array.isArray(activeSessions) && activeSessions.length === 1 && selectedSessionId === null) {
      setSelectedSessionId(activeSessions[0].id)
    }
  }, [activeSessions, selectedSessionId])

  const [history, setHistory]       = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY)
      const parsed: unknown = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
    } catch {
      return []
    }
  })
  const inputRef                    = useRef<HTMLInputElement | null>(null)
  const kgInputRef                  = useRef<InputNumberRef>(null)

  const { data: khsxPage } = useQuery({
    queryKey: ['can-giay-khsx-list'],
    queryFn: () => productionPlansApi.list({ page_size: 100 }).then(r => r.data),
    staleTime: 60_000,
  })
  const khsxList = khsxPage?.items ?? []

  const { data: lsxPaged } = useQuery({
    queryKey: ['can-giay-lsx-list'],
    queryFn: () => productionOrdersApi.list({ page_size: 500 }).then(r => r.data),
    staleTime: 60_000,
  })
  const lsxAll = lsxPaged?.items ?? []

  // LSX filtered to selected plan (for khsx mode)
  const lsxForPlan = planLsxIds.length
    ? lsxAll.filter(l => planLsxIds.includes(l.id))
    : []

  const handlePlanChange = async (planId: number | null) => {
    setSelectedPlanId(planId)
    setSelectedOrderId(null)
    setPlanLsxIds([])
    if (!planId) return
    setLoadingPlanLsx(true)
    try {
      const plan = await productionPlansApi.get(planId).then(r => r.data)
      const soLenhs = new Set((plan.lines ?? []).map(l => l.so_lenh).filter(Boolean))
      const ids = lsxAll.filter(l => soLenhs.has(l.so_lenh)).map(l => l.id)
      setPlanLsxIds(ids)
      if (ids.length === 1) setSelectedOrderId(ids[0])
    } catch {
      message.error('Không thể tải LSX từ KHSX')
    } finally {
      setLoadingPlanLsx(false)
    }
  }

  const selectRoll = useCallback((r: GiayRoll) => {
    setRoll(r)
    setRollList(null)
    setKgConLai(r.trong_luong_con_lai)
    setLookupError(null)
    setTimeout(() => kgInputRef.current?.focus(), 100)
  }, [])

  const lookupMut = useMutation({
    mutationFn: (bc: string) => warehouseApi.getGiayRollByBarcode(bc).then(r => r.data),
    onSuccess: (data) => {
      setRoll(data)
      setRollList(null)
      setKgConLai(data.trong_luong_con_lai)
      setLookupError(null)
      setTimeout(() => kgInputRef.current?.focus(), 100)
    },
    onError: async () => {
      // Không tìm được barcode → thử tìm theo số phiếu nhập
      const input = barcode.trim()
      try {
        const res = await warehouseApi.listGiayRolls({ so_phieu: input })
        if (res.data.length > 0) {
          setRollList(res.data)
          setRoll(null)
          setLookupError(null)
        } else {
          setLookupError(`Không tìm thấy barcode hoặc số phiếu: ${input}`)
          setRoll(null)
          setRollList(null)
        }
      } catch {
        setLookupError(`Không tìm thấy barcode hoặc số phiếu: ${input}`)
        setRoll(null)
        setRollList(null)
      }
    },
  })

  const canMut = useMutation({
    mutationFn: ({ id, kg, orderId, sessionId }: { id: number; kg: number; orderId?: number | null; sessionId?: number | null }) =>
      warehouseApi.canGiayRoll(id, kg, orderId, sessionId).then(r => r.data),
    onSuccess: (updated) => {
      const entry: HistoryEntry = {
        barcode: updated.barcode,
        ma_chinh: updated.ma_chinh,
        kg_truoc: roll?.trong_luong_con_lai ?? 0,
        kg_sau: updated.trong_luong_con_lai,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      }
      setHistory(prev => {
        const newHistory = [entry, ...prev].slice(0, HISTORY_LIMIT)
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory))
        } catch {
          // localStorage có thể đầy hoặc bị chặn (private mode) — bỏ qua, không chặn UI.
        }
        return newHistory
      })
      message.success(`✓ Đã ghi: ${updated.barcode} — còn ${updated.trong_luong_con_lai} kg`)
      resetForm()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi cập nhật'),
  })

  const resetForm = useCallback(() => {
    setBarcode('')
    setRoll(null)
    setRollList(null)
    setKgConLai(null)
    setLookupError(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Gửi cân: kiểm tra quyền + giá trị hợp lệ trước khi gọi API.
  const submitCan = useCallback(() => {
    if (!canImport) {
      message.error('Bạn không có quyền nhập kho.')
      return
    }
    if (!roll) return
    if (kgConLai == null || Number.isNaN(kgConLai)) {
      message.error('Vui lòng nhập số kg còn lại.')
      return
    }
    if (kgConLai < 0) {
      message.error('Số kg còn lại không được nhỏ hơn 0.')
      return
    }
    if (kgConLai > roll.trong_luong_ban_dau) {
      message.error(`Số kg còn lại không được lớn hơn trọng lượng lúc nhập (${roll.trong_luong_ban_dau} kg).`)
      return
    }
    canMut.mutate({ id: roll.id, kg: kgConLai, orderId: selectedOrderId, sessionId: selectedSessionId })
  }, [canImport, roll, kgConLai, selectedOrderId, selectedSessionId, canMut])

  const handleBarcodeSubmit = useCallback((bc: string) => {
    const trimmed = bc.trim()
    if (!trimmed) return
    setBarcode(trimmed)
    setRollList(null)
    lookupMut.mutate(trimmed)
  }, [lookupMut])

  const handlePrintOne = async (r: GiayRoll) => {
    try {
      const res = await apiClient.get<string>(
        warehouseApi.printGiayRollLabelOne(r.id),
        { responseType: 'text' },
      )
      // An toàn hơn document.write: render HTML qua Blob URL, không inject trực tiếp vào DOM.
      const blob = new Blob([res.data], { type: 'text/html; charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) {
        w.onload = () => URL.revokeObjectURL(url)
      } else {
        // Popup bị chặn → giải phóng URL ngay để tránh rò rỉ bộ nhớ.
        URL.revokeObjectURL(url)
        message.warning('Trình duyệt chặn cửa sổ in. Vui lòng cho phép popup rồi thử lại.')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      message.error((err as ApiError)?.response?.data?.detail || err?.message || 'Lỗi in tem')
    }
  }

  useEffect(() => { inputRef.current?.focus() }, [])

  const pctDung = roll
    ? Math.round((1 - roll.trong_luong_con_lai / roll.trong_luong_ban_dau) * 100)
    : 0

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px' }}>
      {isStandalone && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, padding: '8px 12px',
          background: '#002766', borderRadius: 8, color: '#fff',
        }}>
          <Space>
            <Text style={{ color: '#fff', fontSize: 16 }}>⚖️</Text>
            <Text strong style={{ color: '#fff' }}>{user?.ho_ten || user?.username || 'Thủ kho'}</Text>
          </Space>
          <Button size="small" icon={<LogoutOutlined />} onClick={handleLogout}
            style={{ background: 'transparent', borderColor: '#fff', color: '#fff' }}>
            Đăng xuất
          </Button>
        </div>
      )}
      <Title level={4} style={{ textAlign: 'center', marginBottom: 16 }}>
        Cân cuộn giấy
      </Title>

      {/* Barcode / số phiếu input */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <input
            ref={inputRef}
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBarcodeSubmit(barcode)}
            placeholder="Barcode hoặc số phiếu nhập..."
            style={{
              flex: 1, padding: '10px 12px', fontSize: 18, fontFamily: 'monospace',
              border: '1px solid #d9d9d9', borderRight: 'none', borderRadius: '6px 0 0 6px',
              outline: 'none',
            }}
          />
          <Button
            size="large"
            type="default"
            icon={<ScanOutlined />}
            onClick={() => setScanning(true)}
            style={{ borderRadius: '0 6px 6px 0', minWidth: 48 }}
          />
        </Space.Compact>

        <QrScannerModal
          open={scanning}
          onScan={(text) => {
            setScanning(false)
            setBarcode(text)
            handleBarcodeSubmit(text)
          }}
          onClose={() => setScanning(false)}
        />

        <Button
          type="primary" block size="large"
          style={{ marginTop: 8, fontSize: 16 }}
          loading={lookupMut.isPending}
          onClick={() => handleBarcodeSubmit(barcode)}
        >
          Tìm cuộn
        </Button>
      </Card>

      {/* Error */}
      {lookupError && (
        <Alert type="error" message={lookupError} icon={<CloseCircleFilled />}
          showIcon closable onClose={() => setLookupError(null)}
          style={{ marginBottom: 12 }} />
      )}

      {/* Danh sách cuộn theo số phiếu */}
      {rollList && (
        <Card
          size="small"
          style={{ marginBottom: 12 }}
          title={
            <Space>
              <Text strong>Phiếu {rollList[0]?.so_phieu_nhap}</Text>
              <Tag>{rollList.length} cuộn</Tag>
              <Button size="small" icon={<ReloadOutlined />} onClick={resetForm} />
            </Space>
          }
        >
          <List
            size="small"
            dataSource={rollList}
            renderItem={r => (
              <List.Item
                style={{ padding: '6px 0' }}
                actions={[
                  <Button
                    size="small" icon={<PrinterOutlined />}
                    onClick={() => handlePrintOne(r)}
                    title="In lại tem"
                  />,
                  <Button
                    size="small" icon={<SelectOutlined />} type="primary"
                    onClick={() => selectRoll(r)}
                    title="Chọn để cân"
                  />,
                ]}
              >
                <Space direction="vertical" size={0}>
                  <Text code style={{ fontSize: 13 }}>{r.barcode}</Text>
                  <Space size={4}>
                    <Text style={{ fontSize: 12 }}>{r.ma_chinh || '—'}</Text>
                    <Tag color={STATUS_COLOR[r.trang_thai]} style={{ fontSize: 11 }}>
                      {STATUS_LABEL[r.trang_thai]}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {r.trong_luong_con_lai} kg
                    </Text>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Phiên sản xuất picker */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <PlayCircleOutlined style={{ color: '#52c41a' }} />
          <Text strong style={{ fontSize: 14 }}>Phiên sản xuất đang chạy</Text>
          {selectedSessionId && (
            <Tag color="success" style={{ marginLeft: 'auto' }}>
              {Array.isArray(activeSessions)
                ? (activeSessions.find(s => s.id === selectedSessionId)?.ten_phien ?? `Phiên #${selectedSessionId}`)
                : `Phiên #${selectedSessionId}`}
            </Tag>
          )}
        </div>

        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Chọn Phiên sản xuất (Auto-detect nếu trống)..."
          style={{ width: '100%', fontSize: 16 }}
          size="large"
          allowClear
          value={selectedSessionId}
          onChange={v => setSelectedSessionId(v ?? null)}
          options={Array.isArray(activeSessions) ? activeSessions.map(s => ({
            value: s.id,
            label: `${s.ten_phien} (${s.phan_xuong_ten || 'Không xác định phân xưởng'})`,
          })) : []}
        />
        {!selectedSessionId && (
          <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
            Để trống sẽ tự động gán vào Phiên chạy máy đang hoạt động mới nhất
          </Text>
        )}
      </Card>

      {/* KHSX / LSX picker */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <BranchesOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ fontSize: 14 }}>Lệnh sản xuất</Text>
          {selectedOrderId && (
            <Tag color="blue" style={{ marginLeft: 'auto' }}>
              {lsxAll.find(l => l.id === selectedOrderId)?.so_lenh ?? `LSX #${selectedOrderId}`}
            </Tag>
          )}
        </div>

        <Segmented
          block
          value={orderMode}
          onChange={v => {
            setOrderMode(v as 'lsx' | 'khsx')
            setSelectedPlanId(null)
            setPlanLsxIds([])
            setSelectedOrderId(null)
          }}
          options={[
            { label: 'Theo KHSX', value: 'khsx' },
            { label: 'Theo LSX', value: 'lsx' },
          ]}
          style={{ marginBottom: 10 }}
        />

        {orderMode === 'khsx' ? (
          <>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn Kế hoạch SX..."
              style={{ width: '100%', marginBottom: 8, fontSize: 16 }}
              size="large"
              allowClear
              value={selectedPlanId}
              onChange={handlePlanChange}
              options={khsxList.map(p => ({ value: p.id, label: p.so_ke_hoach }))}
            />
            {selectedPlanId && (
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={loadingPlanLsx ? 'Đang tải LSX...' : lsxForPlan.length ? 'Chọn Lệnh SX...' : 'Không có LSX'}
                style={{ width: '100%', fontSize: 16 }}
                size="large"
                allowClear
                loading={loadingPlanLsx}
                disabled={loadingPlanLsx || !lsxForPlan.length}
                value={selectedOrderId}
                onChange={v => setSelectedOrderId(v ?? null)}
                options={lsxForPlan.map(l => ({
                  value: l.id,
                  label: `${l.so_lenh}${l.ten_khach_hang ? ' — ' + l.ten_khach_hang : ''}`,
                }))}
              />
            )}
          </>
        ) : (
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Tìm Lệnh SX..."
            style={{ width: '100%', fontSize: 16 }}
            size="large"
            allowClear
            value={selectedOrderId}
            onChange={v => setSelectedOrderId(v ?? null)}
            options={lsxAll.map(l => ({
              value: l.id,
              label: `${l.so_lenh}${l.ten_khach_hang ? ' — ' + l.ten_khach_hang : ''}`,
            }))}
          />
        )}

        {!selectedOrderId && (
          <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
            Không bắt buộc — chọn để ghi nhận chi phí theo lệnh SX
          </Text>
        )}
      </Card>

      {/* Roll info + cân input */}
      {roll && (
        <Card
          size="small"
          style={{ marginBottom: 12, borderColor: '#1677ff' }}
          title={
            <Space>
              <Text strong style={{ fontSize: 16 }}>{roll.barcode}</Text>
              <Tag color={STATUS_COLOR[roll.trang_thai]}>{STATUS_LABEL[roll.trang_thai]}</Tag>
            </Space>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 12 }}>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Mã giấy</Text><br />
              <Text strong>{roll.ma_chinh || '—'}</Text></div>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Khổ × ĐL</Text><br />
              <Text strong>{roll.kho ? `${roll.kho} cm` : '—'} × {roll.dinh_luong ? `${roll.dinh_luong} g/m²` : '—'}</Text></div>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Lúc nhập</Text><br />
              <Text>{roll.trong_luong_ban_dau.toLocaleString('vi-VN')} kg</Text></div>
            <div><Text type="secondary" style={{ fontSize: 12 }}>Còn lại (hệ thống)</Text><br />
              <Text strong style={{ color: '#1677ff' }}>{roll.trong_luong_con_lai.toLocaleString('vi-VN')} kg</Text></div>
            <div style={{ gridColumn: '1/-1' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Đã dùng</Text>
              <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8, marginTop: 4 }}>
                <div style={{
                  background: pctDung > 90 ? '#ff4d4f' : pctDung > 60 ? '#faad14' : '#52c41a',
                  width: `${pctDung}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s',
                }} />
              </div>
              <Text style={{ fontSize: 11 }}>{pctDung}% đã dùng</Text>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Cân còn lại (kg):</Text>
            <InputNumber
              ref={kgInputRef}
              value={kgConLai}
              onChange={v => setKgConLai(v)}
              min={0}
              max={roll.trong_luong_ban_dau}
              precision={1}
              size="large"
              style={{ width: '100%', marginTop: 4, fontSize: 22 }}
              placeholder="Nhập kg còn lại..."
              disabled={!canImport}
              onPressEnter={submitCan}
            />
            {kgConLai != null && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                → Đã dùng lần này:{' '}
                <Text strong style={{ color: '#d46b08' }}>
                  {(roll.trong_luong_con_lai - kgConLai).toFixed(1)} kg
                </Text>
              </Text>
            )}
          </div>

          <Space style={{ width: '100%' }}>
            <Button
              type="primary" size="large"
              icon={<CheckCircleFilled />}
              style={{ flex: 1, fontSize: 16, height: 48 }}
              loading={canMut.isPending}
              disabled={kgConLai == null || !canImport}
              title={!canImport ? 'Bạn không có quyền nhập kho' : undefined}
              onClick={submitCan}
              block
            >
              Xác nhận
            </Button>
            <Button size="large" icon={<PrinterOutlined />} onClick={() => handlePrintOne(roll)}
              style={{ height: 48 }} title="In lại tem cuộn này" />
            <Button size="large" icon={<ReloadOutlined />} onClick={resetForm}
              style={{ height: 48 }} />
          </Space>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card size="small" title={<Text type="secondary" style={{ fontSize: 12 }}>Lịch sử ca này</Text>}>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0',
              borderBottom: i < history.length - 1 ? '1px solid #f0f0f0' : undefined }}>
              <Space>
                <Text code style={{ fontSize: 12 }}>{h.barcode}</Text>
                <Text style={{ fontSize: 12 }}>{h.ma_chinh}</Text>
              </Space>
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {h.kg_truoc.toFixed(0)} → <Text strong style={{ color: '#1677ff' }}>{h.kg_sau.toFixed(0)} kg</Text>
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{h.timestamp}</Text>
              </Space>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
