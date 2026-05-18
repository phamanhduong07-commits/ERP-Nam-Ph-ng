import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Badge, Button, Card, Col, DatePicker, Divider, Empty, Form, Input,
  InputNumber, Modal, Popconfirm, Row, Select, Space, Spin,
  Tabs, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined,
  PauseOutlined, PlayCircleOutlined, PrinterOutlined, ReloadOutlined, SwapOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, KanbanData, CompletePayload } from '../../api/cd2'
import CD2WorkshopSelector from '../../components/CD2WorkshopSelector'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'

const { Text, Title } = Typography

type PauseInfo = { time: string; ly_do: string }
const PAUSE_KEY = (id: number) => `cd2-in-pause-${id}`
function readPauses(): Record<number, PauseInfo> {
  const result: Record<number, PauseInfo> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('cd2-in-pause-')) {
      const id = parseInt(key.replace('cd2-in-pause-', ''))
      try {
        const val = JSON.parse(localStorage.getItem(key) || 'null')
        if (!isNaN(id) && val) result[id] = val
      } catch { /* ignore */ }
    }
  }
  return result
}

function formatElapsed(start: string): { text: string; isStuck: boolean } {
  const mins = dayjs().diff(dayjs(start), 'minute')
  const isStuck = mins >= 240
  if (mins < 60) return { text: `${mins}p`, isStuck }
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return { text: m > 0 ? `${h}g${m}p` : `${h}g`, isStuck }
}

function ElapsedTime({ start }: { start: string }) {
  const [info, setInfo] = useState(() => formatElapsed(start))
  useEffect(() => {
    const id = setInterval(() => setInfo(formatElapsed(start)), 30_000)
    return () => clearInterval(id)
  }, [start])
  return (
    <span style={{ color: info.isStuck ? '#ff4d4f' : '#fa8c16', fontWeight: 600, fontSize: 11 }}>
      {info.isStuck ? '⚠️' : '🕐'} {info.text}{info.isStuck ? ' — Kẹt lâu!' : ''}
    </span>
  )
}

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
    const total = (v.so_luong_in_ok ?? 0) + (v.so_luong_loi ?? 0) + (v.so_luong_setup ?? 0)
    if (phieu.so_luong_phoi && total > phieu.so_luong_phoi * 1.15) {
      message.warning(
        `Tổng SL ghi (${total.toLocaleString('vi-VN')}) vượt quá SL phôi (${phieu.so_luong_phoi.toLocaleString('vi-VN')}) hơn 15% — vui lòng kiểm tra lại.`,
        5,
      )
    }
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
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Lỗi hoàn thành in')
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
  onPause,
  onResume,
  isActing,
  isPaused,
  pauseInfo,
}: {
  phieu: PhieuIn
  machines: { id: number; ten_may: string }[]
  onStart: () => void
  onComplete: () => void
  onTransfer: () => void
  onRemove: () => void
  onPause: () => void
  onResume: () => void
  isActing: boolean
  isPaused: boolean
  pauseInfo?: PauseInfo
}) {
  const isRunning = phieu.trang_thai === 'dang_in'
  const isStuck = isRunning && !!phieu.gio_bat_dau_in
    && dayjs().diff(dayjs(phieu.gio_bat_dau_in), 'minute') >= 240

  return (
    <Card
      size="small"
      style={{
        marginBottom: 10,
        borderLeft: `4px solid ${isStuck ? '#ff4d4f' : isPaused ? '#faad14' : isRunning ? '#fa8c16' : '#1677ff'}`,
        background: isPaused ? '#fffef0' : isRunning ? '#fffbe6' : '#fff',
        boxShadow: isRunning ? `0 2px 12px rgba(${isStuck ? '255,77,79' : '250,140,22'},0.18)` : undefined,
      }}
    >
      <Row justify="space-between" align="top" wrap={false}>
        {/* Thông tin */}
        <Col flex="auto">
          <Space size={6} style={{ marginBottom: 4 }} wrap>
            <Text style={{ fontSize: 11, color: '#888' }}>{phieu.so_phieu}</Text>
            {isRunning && !isPaused && !isStuck && <Tag color="orange" style={{ margin: 0 }}>▶ Đang in</Tag>}
            {isRunning && isStuck && <Tag color="error" style={{ margin: 0 }}>⚠️ Kẹt lâu</Tag>}
            {isPaused && <Tag color="gold" style={{ margin: 0 }}>⏸ Tạm dừng</Tag>}
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
          {isPaused && pauseInfo && (
            <div style={{ fontSize: 11, color: '#d4b106', marginTop: 4, fontStyle: 'italic' }}>
              ⏸ {pauseInfo.time} — {pauseInfo.ly_do}
            </div>
          )}
          {isRunning && phieu.gio_bat_dau_in && !isPaused && (
            <div style={{ marginTop: 4 }}>
              <ElapsedTime start={phieu.gio_bat_dau_in} />
            </div>
          )}
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
            {isRunning && !isPaused && (
              <Button icon={<PauseOutlined />} size="small" onClick={onPause}>
                Tạm dừng
              </Button>
            )}
            {isRunning && isPaused && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                size="small"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={onResume}
              >
                Tiếp tục
              </Button>
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
  const [completePhieu, setCompletePhieu] = useState<PhieuIn | null>(null)
  const [transferPhieu, setTransferPhieu] = useState<PhieuIn | null>(null)
  const [actingId, setActingId] = useState<number | null>(null)
  const [pauses, setPauses] = useState<Record<number, PauseInfo>>(() => readPauses())
  const [pausingPhieu, setPausingPhieu] = useState<PhieuIn | null>(null)
  const [pauseReason, setPauseReason] = useState('')

  const cards: PhieuIn[] = kanban.columns[`may_${mayId}`] ?? []
  const running = cards.filter(p => p.trang_thai === 'dang_in')
  const waiting = cards.filter(p => p.trang_thai === 'ke_hoach')

  const startMutation = useMutation({
    mutationFn: (id: number) => cd2Api.startPrinting(id),
    onSuccess: () => { message.success('Đã bắt đầu in'); onRefresh() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
    onSettled: () => setActingId(null),
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      cd2Api.movePhieuIn(id, { trang_thai: 'ke_hoach', may_in_id: null, sort_order: 0 }),
    onSuccess: () => { message.success('Đã trả về Kế hoạch in'); onRefresh() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const handleTamDung = (phieu: PhieuIn) => {
    setPauseReason('')
    setPausingPhieu(phieu)
  }

  const handleConfirmPause = async () => {
    if (!pausingPhieu) return
    if (!pauseReason.trim()) { message.warning('Vui lòng nhập lý do tạm dừng'); return }
    const info: PauseInfo = { time: dayjs().format('HH:mm'), ly_do: pauseReason.trim() }
    const id = pausingPhieu.id
    localStorage.setItem(PAUSE_KEY(id), JSON.stringify(info))
    setPauses(prev => ({ ...prev, [id]: info }))
    setPausingPhieu(null)
    setPauseReason('')
    try {
      await cd2Api.tamDungIn(id, { ly_do: info.ly_do })
      message.info(`Tạm dừng lúc ${info.time} — ${info.ly_do}`)
      onRefresh()
    } catch (e: any) {
      localStorage.removeItem(PAUSE_KEY(id))
      setPauses(prev => { const next = { ...prev }; delete next[id]; return next })
      message.error(e?.response?.data?.detail || 'Lỗi tạm dừng in')
    }
  }

  const handleTiepTuc = async (phieu: PhieuIn) => {
    localStorage.removeItem(PAUSE_KEY(phieu.id))
    setPauses(prev => { const next = { ...prev }; delete next[phieu.id]; return next })
    try {
      await cd2Api.tiepTucIn(phieu.id)
      message.success('Tiếp tục in')
      onRefresh()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Lỗi tiếp tục in')
      onRefresh()
    }
  }

  const machines = kanban.may_ins

  if (cards.length === 0) {
    return (
      <Empty
        image={<PrinterOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />}
        imageStyle={{ height: 48 }}
        description={
          <span style={{ color: '#bbb', fontSize: 13 }}>
            Máy này chưa có phiếu nào.<br />
            <span style={{ fontSize: 11 }}>Kéo thả phiếu từ Kanban hoặc phân công ở trang Kế hoạch in.</span>
          </span>
        }
        style={{ padding: '32px 0' }}
      />
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
          {running.map(p => {
            const localPause = pauses[p.id]
            const isPaused = !!localPause || !!p.tam_dung_luc
            const pauseInfo: PauseInfo | undefined = localPause
              ?? (p.tam_dung_luc ? { time: dayjs(p.tam_dung_luc).format('HH:mm'), ly_do: p.tam_dung_ly_do || '' } : undefined)
            return (
              <QueueCard
                key={p.id}
                phieu={p}
                machines={machines}
                isActing={actingId === p.id}
                isPaused={isPaused}
                pauseInfo={pauseInfo}
                onStart={() => { setActingId(p.id); startMutation.mutate(p.id) }}
                onComplete={() => setCompletePhieu(p)}
                onTransfer={() => setTransferPhieu(p)}
                onRemove={() => removeMutation.mutate(p.id)}
                onPause={() => handleTamDung(p)}
                onResume={() => handleTiepTuc(p)}
              />
            )
          })}
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
              isPaused={false}
              onStart={() => { setActingId(p.id); startMutation.mutate(p.id) }}
              onComplete={() => setCompletePhieu(p)}
              onTransfer={() => setTransferPhieu(p)}
              onRemove={() => removeMutation.mutate(p.id)}
              onPause={() => handleTamDung(p)}
              onResume={() => handleTiepTuc(p)}
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

      <Modal
        open={!!pausingPhieu}
        title={`Tạm dừng in — ${pausingPhieu?.so_phieu ?? ''}`}
        onCancel={() => setPausingPhieu(null)}
        onOk={handleConfirmPause}
        okText="Xác nhận tạm dừng"
        cancelText="Huỷ"
        okButtonProps={{ danger: true, icon: <PauseOutlined /> }}
        width={400}
        destroyOnClose
      >
        <div style={{ marginBottom: 8, color: '#595959' }}>
          Nhập lý do tạm dừng <span style={{ color: '#ff4d4f' }}>*</span>
        </div>
        <Input.TextArea
          rows={3}
          placeholder="Vd: Hết mực in, máy hỏng, nghỉ giải lao..."
          value={pauseReason}
          onChange={e => setPauseReason(e.target.value)}
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleConfirmPause() } }}
          autoFocus
        />
      </Modal>
    </>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MayInQueuePage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('')
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  const { data: kanban, isLoading } = useQuery({
    queryKey: ['cd2-kanban', phanXuongId],
    queryFn: () => cd2Api.getKanban(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
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
            <CD2WorkshopSelector value={phanXuongId} onChange={id => { setPhanXuongId(id); setActiveTab('') }} phanXuongList={phanXuongList} />
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
