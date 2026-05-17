import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, InputNumber, message, Modal,
  Select, Space, Spin, Tag, Typography,
} from 'antd'
import {
  CaretRightOutlined, CheckOutlined, PauseOutlined, RedoOutlined,
} from '@ant-design/icons'
import { cd2Api, Machine, PhieuIn } from '../../api/cd2'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import { useAuthStore } from '../../store/auth'

const { Text, Title } = Typography

const STATE_TAG: Record<string, { label: string; color: string }> = {
  ke_hoach:     { label: 'Chờ in',       color: 'blue' },
  dang_in:      { label: 'Đang in',      color: 'green' },
  cho_dinh_hinh:{ label: 'Chờ ĐH',       color: 'orange' },
  sau_in:       { label: 'Định hình',    color: 'purple' },
  dang_sau_in:  { label: 'Đang ĐH',      color: 'purple' },
  hoan_thanh:   { label: 'Hoàn thành',   color: 'default' },
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
  const [completePhieu, setCompletePhieu] = useState<PhieuIn | null>(null)
  const [form] = Form.useForm()

  // Lấy danh sách máy theo xưởng
  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', phanXuongId],
    queryFn: () => cd2Api.listMachines(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
  })

  // Nếu máy chưa chọn mà user có machine_id → tự set
  useMemo(() => {
    if (!selectedMachineId && user?.machine_id) setSelectedMachineId(user.machine_id)
  }, [user?.machine_id])

  const selectedMachine: Machine | undefined = machines.find(m => m.id === selectedMachineId)

  // Danh sách phiếu in cho máy đang chọn
  const { data: phieuList = [], isLoading: loadingPhieu, refetch } = useQuery({
    queryKey: ['worker-phieu', selectedMachineId],
    queryFn: () => cd2Api.listPhieuIn({ may_in_id: selectedMachineId }).then(r => r.data),
    enabled: !!selectedMachineId,
    refetchInterval: 30000,
  })

  const trackMutation = useMutation({
    mutationFn: (data: any) => cd2Api.trackProduction(data),
    onSuccess: () => {
      message.success('Đã cập nhật!')
      qc.invalidateQueries({ queryKey: ['worker-phieu', selectedMachineId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  const doTrack = (phieu: PhieuIn, eventType: 'start' | 'stop' | 'resume' | 'complete', extra: any = {}) => {
    if ('vibrate' in navigator) navigator.vibrate(50)
    trackMutation.mutate({
      production_order_id: phieu.production_order_id ?? 0,
      machine_id: selectedMachineId!,
      phieu_in_id: phieu.id,
      event_type: eventType,
      ...extra,
    })
  }

  const onConfirmComplete = (values: any) => {
    if (!completePhieu) return
    doTrack(completePhieu, 'complete', {
      quantity_ok: values.quantity_ok,
      quantity_loi: values.quantity_loi ?? 0,
    })
    setCompletePhieu(null)
    form.resetFields()
  }

  // Sắp xếp: dang_in lên trước, ke_hoach tiếp theo
  const sorted = [...phieuList].sort((a, b) => {
    const order: Record<string, number> = { dang_in: 0, ke_hoach: 1 }
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
          <Button
            size="small"
            icon={<RedoOutlined />}
            onClick={() => refetch()}
            style={{ marginLeft: 8 }}
          />
        )}
      </Card>

      {!selectedMachineId && (
        <Card>
          <Text type="secondary">Vui lòng chọn máy để xem hàng chờ.</Text>
        </Card>
      )}

      {selectedMachineId && loadingPhieu && <Spin style={{ display: 'block', margin: '20px auto' }} />}

      {selectedMachineId && !loadingPhieu && sorted.length === 0 && (
        <Card>
          <Text type="secondary">Không có phiếu nào cho máy này.</Text>
        </Card>
      )}

      {sorted.map(phieu => {
        const state = STATE_TAG[phieu.trang_thai] ?? { label: phieu.trang_thai, color: 'default' }
        const isActive = phieu.trang_thai === 'dang_in'
        const isReady  = phieu.trang_thai === 'ke_hoach'

        return (
          <Card
            key={phieu.id}
            size="small"
            style={{ marginBottom: 10, borderLeft: `4px solid ${isActive ? '#52c41a' : isReady ? '#1677ff' : '#d9d9d9'}` }}
            title={
              <Space>
                <Text strong>{phieu.so_phieu}</Text>
                <Tag color={state.color}>{state.label}</Tag>
              </Space>
            }
          >
            <div style={{ marginBottom: 8 }}>
              <Text>{phieu.ten_hang || phieu.so_lsx}</Text>
              {phieu.ten_khach_hang && <Text type="secondary" style={{ marginLeft: 8 }}>— {phieu.ten_khach_hang}</Text>}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">SL phôi: </Text>
              <Text strong>{phieu.so_luong_phoi?.toLocaleString()}</Text>
              {phieu.so_luong_in_ok != null && phieu.so_luong_in_ok > 0 && (
                <Text type="secondary" style={{ marginLeft: 12 }}>✓ OK: {phieu.so_luong_in_ok?.toLocaleString()}</Text>
              )}
            </div>

            {/* Nút hành động */}
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
              {isActive && (
                <>
                  <Button
                    icon={<PauseOutlined />}
                    loading={trackMutation.isPending}
                    onClick={() => doTrack(phieu, 'stop')}
                  >
                    Tạm dừng
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    loading={trackMutation.isPending}
                    onClick={() => { setCompletePhieu(phieu); form.setFieldValue('quantity_ok', phieu.so_luong_phoi) }}
                  >
                    Hoàn thành
                  </Button>
                </>
              )}
            </Space>
          </Card>
        )
      })}

      {/* Modal hoàn thành */}
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
