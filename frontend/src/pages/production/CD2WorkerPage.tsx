import { useState, useEffect } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, InputNumber, message, Modal,
  Select, Space, Spin, Tag, Typography,
} from 'antd'
import {
  CaretRightOutlined, CheckOutlined, PauseOutlined, RedoOutlined,
  PlayCircleOutlined, WarningFilled,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, Machine, PhieuIn, TrackPayload } from '../../api/cd2'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import { useAuthStore } from '../../store/auth'
import { socket } from '../../utils/socket'

const { Text, Title } = Typography

const STATE_TAG: Record<string, { label: string; color: string }> = {
  cho_in:        { label: 'Chờ in',       color: 'default' },
  ke_hoach:      { label: 'Kế hoạch',     color: 'blue' },
  dang_in:       { label: 'Đang in',      color: 'green' },
  cho_dinh_hinh: { label: 'Chờ TP',       color: 'orange' },
  sau_in:        { label: 'Thành phẩm',  color: 'purple' },
  dang_sau_in:   { label: 'Đang TP',     color: 'purple' },
  hoan_thanh:    { label: 'Hoàn thành',   color: 'default' },
}

// Phiếu có hạn giao hôm nay hoặc quá hạn
function isOverdue(phieu: PhieuIn): boolean {
  if (!phieu.ngay_giao_hang) return false
  return dayjs(phieu.ngay_giao_hang).isBefore(dayjs(), 'day') ||
         dayjs(phieu.ngay_giao_hang).isSame(dayjs(), 'day')
}

export default function CD2WorkerPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { phanXuongId } = useCD2Workshop()

  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(
    () => {
      try {
        const raw = localStorage.getItem('cd2_worker_session')
        const ws = raw ? JSON.parse(raw) : null
        return ws?.machine_id ?? null
      } catch { return null }
    }
  )
  // IDs phiếu đang tạm dừng (local session state — mất khi reload, đủ cho dùng ca)
  const [pausedIds, setPausedIds] = useState<Set<number>>(new Set())
  const [completePhieu, setCompletePhieu] = useState<PhieuIn | null>(null)
  const [form] = Form.useForm()

  // Auto-set machine từ tài khoản user nếu chưa chọn
  useEffect(() => {
    if (!selectedMachineId && user?.machine_id) setSelectedMachineId(user.machine_id)
  }, [user?.machine_id])

  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', phanXuongId],
    queryFn: () => cd2Api.listMachines(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
  })

  const selectedMachine: Machine | undefined = machines.find(m => m.id === selectedMachineId)

  const { data: phieuList = [], isLoading: loadingPhieu, refetch } = useQuery({
    queryKey: ['worker-phieu', selectedMachineId],
    queryFn: () => cd2Api.listPhieuIn({ may_in_id: selectedMachineId }).then(r => r.data),
    enabled: !!selectedMachineId,
    // WebSocket xử lý real-time; không cần polling
  })

  // Lắng nghe WebSocket — cập nhật ngay khi tổ trưởng kéo Kanban
  useEffect(() => {
    const onUpdate = () => qc.invalidateQueries({ queryKey: ['worker-phieu', selectedMachineId] })
    socket.on('machine_status_update', onUpdate)
    return () => { socket.off('machine_status_update', onUpdate) }
  }, [qc, selectedMachineId])

  const trackMutation = useMutation({
    mutationFn: (data: TrackPayload) => cd2Api.trackProduction(data),
    onSuccess: () => {
      message.success('Đã cập nhật!')
      qc.invalidateQueries({ queryKey: ['worker-phieu', selectedMachineId] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Thất bại'),
  })

  const doTrack = (
    phieu: PhieuIn,
    eventType: 'start' | 'stop' | 'resume' | 'complete',
    extra: Partial<TrackPayload> = {}
  ) => {
    if ('vibrate' in navigator) navigator.vibrate(50)
    trackMutation.mutate({
      production_order_id: phieu.production_order_id ?? 0,
      machine_id: selectedMachineId!,
      phieu_in_id: phieu.id,
      event_type: eventType,
      ...extra,
    })
  }

  const handleStop = (phieu: PhieuIn) => {
    doTrack(phieu, 'stop')
    setPausedIds(prev => new Set(prev).add(phieu.id))
  }

  const handleResume = (phieu: PhieuIn) => {
    doTrack(phieu, 'resume')
    setPausedIds(prev => { const s = new Set(prev); s.delete(phieu.id); return s })
  }

  const onConfirmComplete = (values: { quantity_ok: number; quantity_loi?: number }) => {
    if (!completePhieu) return
    doTrack(completePhieu, 'complete', {
      quantity_ok: values.quantity_ok,
      quantity_loi: values.quantity_loi ?? 0,
    })
    setPausedIds(prev => { const s = new Set(prev); s.delete(completePhieu.id); return s })
    setCompletePhieu(null)
    form.resetFields()
  }

  // Sắp xếp: dang_in → ke_hoach → cho_in → còn lại
  const sorted = [...phieuList].sort((a, b) => {
    const order: Record<string, number> = { dang_in: 0, ke_hoach: 1, cho_in: 2 }
    return (order[a.trang_thai] ?? 9) - (order[b.trang_thai] ?? 9)
  })

  if (loadingMachines) return <Spin style={{ display: 'block', margin: '40px auto' }} />

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '12px 8px' }}>
      <Title level={4} style={{ marginBottom: 12 }}>Máy in của tôi</Title>

      {/* Chọn máy */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Text strong>Máy: </Text>
        <Select
          placeholder="Chọn máy"
          value={selectedMachineId ?? undefined}
          onChange={v => setSelectedMachineId(v)}
          style={{ width: 220, marginLeft: 8 }}
          options={machines.map(m => ({ value: m.id, label: m.ten_may }))}
        />
        {selectedMachine && (
          <Button size="small" icon={<RedoOutlined />} onClick={() => refetch()} style={{ marginLeft: 8 }} />
        )}
      </Card>

      {!selectedMachineId && (
        <Card><Text type="secondary">Vui lòng chọn máy để xem hàng chờ.</Text></Card>
      )}

      {selectedMachineId && loadingPhieu && <Spin style={{ display: 'block', margin: '20px auto' }} />}

      {selectedMachineId && !loadingPhieu && sorted.length === 0 && (
        <Card><Text type="secondary">Không có phiếu nào cho máy này.</Text></Card>
      )}

      {sorted.map(phieu => {
        const state = STATE_TAG[phieu.trang_thai] ?? { label: phieu.trang_thai, color: 'default' }
        const isActive  = phieu.trang_thai === 'dang_in'
        const isReady   = phieu.trang_thai === 'ke_hoach' || phieu.trang_thai === 'cho_in'
        const isPaused  = isActive && pausedIds.has(phieu.id)
        const overdue   = isOverdue(phieu)

        const borderColor = overdue ? '#ff4d4f'
          : isActive && !isPaused ? '#52c41a'
          : isReady               ? '#1677ff'
          : '#d9d9d9'

        return (
          <Card
            key={phieu.id}
            size="small"
            style={{ marginBottom: 10, borderLeft: `4px solid ${borderColor}` }}
            title={
              <Space>
                <Text strong>{phieu.so_lsx || phieu.so_phieu}</Text>
                {phieu.so_lsx && <Text type="secondary" style={{ fontSize: 11 }}> ({phieu.so_phieu})</Text>}
                <Tag color={isPaused ? 'warning' : state.color}>
                  {isPaused ? '⏸ Tạm dừng' : state.label}
                </Tag>
                {overdue && (
                  <Tag color="error" icon={<WarningFilled />}>Hết hạn giao!</Tag>
                )}
              </Space>
            }
          >
            <div style={{ marginBottom: 6 }}>
              <Text>{phieu.ten_hang || phieu.so_lsx}</Text>
              {phieu.ten_khach_hang && (
                <Text type="secondary" style={{ marginLeft: 8 }}>— {phieu.ten_khach_hang}</Text>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">SL phôi: </Text>
              <Text strong>{phieu.so_luong_phoi?.toLocaleString()}</Text>
              {phieu.so_luong_in_ok != null && phieu.so_luong_in_ok > 0 && (
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  ✓ OK: {phieu.so_luong_in_ok?.toLocaleString()}
                </Text>
              )}
              {phieu.ngay_giao_hang && (
                <Text
                  style={{ marginLeft: 12, color: overdue ? '#ff4d4f' : '#888', fontSize: 12 }}
                >
                  Giao: {dayjs(phieu.ngay_giao_hang).format('DD/MM/YY')}
                </Text>
              )}
            </div>

            <Space wrap>
              {isReady && (
                <Button
                  type="primary"
                  icon={<CaretRightOutlined />}
                  loading={trackMutation.isPending}
                  onClick={() => doTrack(phieu, 'start')}
                >
                  Bắt đầu
                </Button>
              )}
              {isActive && !isPaused && (
                <>
                  <Button
                    icon={<PauseOutlined />}
                    loading={trackMutation.isPending}
                    onClick={() => handleStop(phieu)}
                  >
                    Tạm dừng
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    loading={trackMutation.isPending}
                    onClick={() => {
                      setCompletePhieu(phieu)
                      form.setFieldValue('quantity_ok', phieu.so_luong_phoi)
                    }}
                  >
                    Hoàn thành
                  </Button>
                </>
              )}
              {isPaused && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={trackMutation.isPending}
                  onClick={() => handleResume(phieu)}
                >
                  Tiếp tục
                </Button>
              )}
            </Space>
          </Card>
        )
      })}

      <Modal
        title="Kết quả in"
        open={!!completePhieu}
        onCancel={() => { setCompletePhieu(null); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Xác nhận"
        cancelText="Huỷ"
      >
        <Form form={form} layout="vertical" onFinish={onConfirmComplete}>
          <Form.Item
            name="quantity_ok"
            label="Số lượng OK"
            rules={[{ required: true, message: 'Nhập số lượng OK' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quantity_loi" label="Số lượng lỗi (nếu có)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
