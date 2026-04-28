import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Badge, Button, Card, Col, DatePicker, Divider, Form, Input,
  InputNumber, Modal, Popconfirm, Row, Select, Space, Spin,
  Tabs, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, PrinterOutlined, ReloadOutlined, SwapOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, KanbanData, CompletePayload } from '../../api/cd2'

const { Text, Title } = Typography

const CA_OPTIONS = [
  { value: 'Ca 1', label: 'Ca 1' },
  { value: 'Ca 2', label: 'Ca 2' },
  { value: 'Ca 3', label: 'Ca 3' },
]

// ── Complete Modal ────────────────────────────────────────────────────────────

function CompleteModal({
  phieu,
  open,
  onClose,
  onDone,
}: {
  phieu: PhieuIn
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const payload: CompletePayload = {
        ...v,
        ngay_in: v.ngay_in ? v.ngay_in.format('YYYY-MM-DD') : undefined,
      }
      await cd2Api.completePrinting(phieu.id, payload)
      message.success('Đã hoàn thành in — chuyển sang Chờ định hình')
      form.resetFields()
      onDone()
    } catch {
      message.error('Lỗi, thử lại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          Hoàn thành in — {phieu.so_phieu}
        </Space>
      }
      onCancel={onClose}
      onOk={handleOk}
      okText="Xác nhận hoàn thành"
      cancelText="Huỷ"
      okButtonProps={{ loading: saving, type: 'primary' }}
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ngay_in: dayjs(),
          so_luong_in_ok: phieu.so_luong_phoi ?? undefined,
          so_luong_loi: 0,
          so_luong_setup: 0,
          so_lan_setup: 0,
        }}
      >
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="ngay_in" label="Ngày in">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ca" label="Ca">
              <Select options={CA_OPTIONS} placeholder="Chọn ca" allowClear />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="so_luong_in_ok"
              label="SL in đạt"
              rules={[{ required: true, message: 'Nhập SL' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="so_luong_loi" label="SL lỗi">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="so_luong_setup" label="SL setup">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="so_lan_setup" label="Số lần setup">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="ghi_chu_ket_qua" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ── Transfer Modal ────────────────────────────────────────────────────────────

function TransferModal({
  phieu,
  machines,
  open,
  onClose,
  onDone,
}: {
  phieu: PhieuIn
  machines: { id: number; ten_may: string }[]
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [targetId, setTargetId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const handleOk = async () => {
    if (!targetId) { message.warning('Chọn máy đích'); return }
    setSaving(true)
    try {
      await cd2Api.movePhieuIn(phieu.id, {
        trang_thai: 'ke_hoach',
        may_in_id: targetId,
        sort_order: 999,
      })
      message.success('Đã chuyển máy')
      setTargetId(null)
      onDone()
    } catch {
      message.error('Lỗi chuyển máy')
    } finally {
      setSaving(false)
    }
  }

  const others = machines.filter(m => m.id !== phieu.may_in_id)

  return (
    <Modal
      open={open}
      title={<Space><SwapOutlined />Chuyển sang máy khác — {phieu.so_phieu}</Space>}
      onCancel={onClose}
      onOk={handleOk}
      okText="Chuyển"
      cancelText="Huỷ"
      okButtonProps={{ loading: saving, disabled: !targetId }}
      width={360}
    >
      <Select
        style={{ width: '100%' }}
        placeholder="Chọn máy đích..."
        value={targetId}
        onChange={v => setTargetId(v)}
        options={others.map(m => ({ label: m.ten_may, value: m.id }))}
      />
    </Modal>
  )
}

// ── Queue Card ────────────────────────────────────────────────────────────────

function QueueCard({
  phieu,
  machines,
  onStart,
  onComplete,
  onTransfer,
  onRemove,
  isActing,
}: {
  phieu: PhieuIn
  machines: { id: number; ten_may: string }[]
  onStart: () => void
  onComplete: () => void
  onTransfer: () => void
  onRemove: () => void
  isActing: boolean
}) {
  const isRunning = phieu.trang_thai === 'dang_in'

  return (
    <Card
      size="small"
      style={{
        marginBottom: 10,
        borderLeft: `4px solid ${isRunning ? '#fa8c16' : '#1677ff'}`,
        background: isRunning ? '#fffbe6' : '#fff',
        boxShadow: isRunning ? '0 2px 12px rgba(250,140,22,0.18)' : undefined,
      }}
    >
      <Row justify="space-between" align="top" wrap={false}>
        {/* Thông tin */}
        <Col flex="auto">
          <Space size={6} style={{ marginBottom: 4 }} wrap>
            <Text style={{ fontSize: 11, color: '#888' }}>{phieu.so_phieu}</Text>
            {isRunning && <Tag color="orange" style={{ margin: 0 }}>▶ Đang in</Tag>}
            {phieu.loai && <Tag style={{ margin: 0, fontSize: 10 }}>{phieu.loai}</Tag>}
            {phieu.ths && <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>{phieu.ths}</Tag>}
          </Space>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
            {phieu.ten_hang || '—'}
          </div>
          {phieu.ten_khach_hang && (
            <div style={{ fontSize: 12, color: '#595959' }}>{phieu.ten_khach_hang}</div>
          )}
          <Space size={12} style={{ marginTop: 6 }} wrap>
            {phieu.so_luong_phoi != null && (
              <Text style={{ fontSize: 12 }}>
                SL phôi: <strong>{phieu.so_luong_phoi.toLocaleString('vi-VN')}</strong>
              </Text>
            )}
            {phieu.quy_cach && (
              <Text style={{ fontSize: 12, color: '#888' }}>{phieu.quy_cach}</Text>
            )}
            {phieu.pp_ghep && (
              <Tag style={{ fontSize: 10, margin: 0 }}>{phieu.pp_ghep}</Tag>
            )}
            {phieu.ngay_giao_hang && (
              <Text style={{ fontSize: 11, color: '#cf1322' }}>
                Giao: {dayjs(phieu.ngay_giao_hang).format('DD/MM/YY')}
              </Text>
            )}
          </Space>
          {phieu.ghi_chu_printer && (
            <div style={{ fontSize: 11, color: '#d46b08', marginTop: 4 }}>
              📝 {phieu.ghi_chu_printer}
            </div>
          )}
        </Col>

        {/* Actions */}
        <Col style={{ marginLeft: 12, flexShrink: 0 }}>
          <Space direction="vertical" size={6}>
            {!isRunning && (
              <Tooltip title="Bắt đầu in">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  size="small"
                  loading={isActing}
                  onClick={onStart}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Bắt đầu
                </Button>
              </Tooltip>
            )}
            {isRunning && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="small"
                onClick={onComplete}
              >
                Hoàn thành
              </Button>
            )}
            <Tooltip title="Chuyển sang máy khác">
              <Button icon={<SwapOutlined />} size="small" onClick={onTransfer} />
            </Tooltip>
            <Popconfirm
              title="Trả về Kế hoạch in?"
              onConfirm={onRemove}
              okText="Trả về"
              cancelText="Không"
            >
              <Tooltip title="Trả về kế hoạch">
                <Button icon={<CloseCircleOutlined />} size="small" danger />
              </Tooltip>
            </Popconfirm>
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ── Machine Tab Content ───────────────────────────────────────────────────────

function MachineTab({
  mayId,
  kanban,
  onRefresh,
}: {
  mayId: number
  kanban: KanbanData
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [completePhieu, setCompletePhieu] = useState<PhieuIn | null>(null)
  const [transferPhieu, setTransferPhieu] = useState<PhieuIn | null>(null)
  const [actingId, setActingId] = useState<number | null>(null)

  const cards: PhieuIn[] = kanban.columns[`may_${mayId}`] ?? []
  const running = cards.filter(p => p.trang_thai === 'dang_in')
  const waiting = cards.filter(p => p.trang_thai === 'ke_hoach')

  const startMutation = useMutation({
    mutationFn: (id: number) => cd2Api.startPrinting(id),
    onSuccess: () => { message.success('Đã bắt đầu in'); onRefresh() },
    onError: () => message.error('Lỗi'),
    onSettled: () => setActingId(null),
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      cd2Api.movePhieuIn(id, { trang_thai: 'ke_hoach', may_in_id: null, sort_order: 0 }),
    onSuccess: () => { message.success('Đã trả về Kế hoạch in'); onRefresh() },
    onError: () => message.error('Lỗi'),
  })

  const machines = kanban.may_ins

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb' }}>
        <PrinterOutlined style={{ fontSize: 40 }} />
        <div style={{ marginTop: 12, fontSize: 14 }}>Hàng chờ trống</div>
      </div>
    )
  }

  return (
    <>
      {/* Đang in */}
      {running.length > 0 && (
        <>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#fa8c16',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
          }}>
            ▶ Đang in ({running.length})
          </div>
          {running.map(p => (
            <QueueCard
              key={p.id}
              phieu={p}
              machines={machines}
              isActing={actingId === p.id}
              onStart={() => { setActingId(p.id); startMutation.mutate(p.id) }}
              onComplete={() => setCompletePhieu(p)}
              onTransfer={() => setTransferPhieu(p)}
              onRemove={() => removeMutation.mutate(p.id)}
            />
          ))}
          {waiting.length > 0 && <Divider style={{ margin: '12px 0' }} />}
        </>
      )}

      {/* Hàng chờ */}
      {waiting.length > 0 && (
        <>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#1677ff',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
          }}>
            Hàng chờ ({waiting.length})
          </div>
          {waiting.map(p => (
            <QueueCard
              key={p.id}
              phieu={p}
              machines={machines}
              isActing={actingId === p.id}
              onStart={() => { setActingId(p.id); startMutation.mutate(p.id) }}
              onComplete={() => setCompletePhieu(p)}
              onTransfer={() => setTransferPhieu(p)}
              onRemove={() => removeMutation.mutate(p.id)}
            />
          ))}
        </>
      )}

      {completePhieu && (
        <CompleteModal
          phieu={completePhieu}
          open
          onClose={() => setCompletePhieu(null)}
          onDone={() => { setCompletePhieu(null); onRefresh() }}
        />
      )}
      {transferPhieu && (
        <TransferModal
          phieu={transferPhieu}
          machines={machines}
          open
          onClose={() => setTransferPhieu(null)}
          onDone={() => { setTransferPhieu(null); onRefresh() }}
        />
      )}
    </>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MayInQueuePage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('')

  const { data: kanban, isLoading } = useQuery({
    queryKey: ['cd2-kanban'],
    queryFn: () => cd2Api.getKanban().then(r => r.data),
    refetchInterval: 15_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cd2-kanban'] })

  const machines = kanban?.may_ins ?? []

  // Xác định tab hiện tại (fallback sang máy đầu tiên)
  const resolvedTab = activeTab || String(machines[0]?.id ?? '')

  if (isLoading) return <Spin style={{ margin: 40 }} />

  if (machines.length === 0) {
    return (
      <Card style={{ margin: 24 }}>
        <Text type="secondary">Chưa có máy in nào. Vào Kanban → Cấu hình máy in.</Text>
      </Card>
    )
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <PrinterOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Queue Máy In</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Text type="secondary" style={{ fontSize: 11 }}>Tự cập nhật 15 giây</Text>
            <Button icon={<ReloadOutlined />} onClick={invalidate}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      <Tabs
        activeKey={resolvedTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={machines.map(m => {
          const cards: PhieuIn[] = kanban?.columns[`may_${m.id}`] ?? []
          const runningCount = cards.filter(p => p.trang_thai === 'dang_in').length

          return {
            key: String(m.id),
            label: (
              <Space size={6}>
                <PrinterOutlined />
                {m.ten_may}
                {cards.length > 0 && (
                  <Badge
                    count={cards.length}
                    style={{
                      backgroundColor: runningCount > 0 ? '#fa8c16' : '#1677ff',
                      fontSize: 10,
                    }}
                  />
                )}
              </Space>
            ),
            children: kanban ? (
              <MachineTab
                mayId={m.id}
                kanban={kanban}
                onRefresh={invalidate}
              />
            ) : null,
          }
        })}
      />
    </div>
  )
}
