import { useState, useCallback, useEffect, useRef } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, pointerWithin, rectIntersection, getFirstCollision,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent, CollisionDetection } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Alert, Badge, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  message, Modal, Popconfirm, Row, Select, Space, Tag, Tooltip, Typography,
} from 'antd'
import {
  PlusOutlined, PrinterOutlined, ReloadOutlined, RollbackOutlined, SettingOutlined,
  PlayCircleOutlined, PauseOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, KanbanData, CompletePayload } from '../../api/cd2'
import PhieuInModal from './PhieuInModal'
import MayInSettingsModal from './MayInSettingsModal'
import CD2WorkshopSelector from '../../components/CD2WorkshopSelector'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import { socket } from '../../utils/socket'
import { storage, TTL } from '../../utils/storage'

const { Text } = Typography

// ── Pause session (storage với TTL ca làm — 12h) ─────────────────────────────
type PauseInfo = { time: string; ly_do: string }

const PAUSE_KEY = (id: number) => `cd2-in-pause-${id}`

function readPauses(): Record<number, PauseInfo> {
  const result: Record<number, PauseInfo> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('cd2-in-pause-')) {
      const id = parseInt(key.replace('cd2-in-pause-', ''))
      const val = storage.get<PauseInfo>(key)
      if (!isNaN(id) && val) result[id] = val
    }
  }
  return result
}

// ── Elapsed time live display ────────────────────────────────────────────────

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
    <span style={{ color: info.isStuck ? '#ff4d4f' : '#fa8c16', fontWeight: 600 }}>
      {info.isStuck ? '⚠️' : '🕐'} {info.text}
      {info.isStuck && <span style={{ fontSize: 10, marginLeft: 4 }}>Kẹt lâu!</span>}
    </span>
  )
}

const CA_OPTIONS = [
  { value: 'Ca 1', label: 'Ca 1' },
  { value: 'Ca 2', label: 'Ca 2' },
  { value: 'Ca 3', label: 'Ca 3' },
]

// ── Complete Modal (dùng chung cho Kết thúc + Ngưng & tạo in bù) ─────────────

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
  const [ngungSaving, setNgungSaving] = useState(false)

  const buildPayload = async (): Promise<CompletePayload> => {
    const v = await form.validateFields()
    return { ...v, ngay_in: v.ngay_in ? v.ngay_in.format('YYYY-MM-DD') : undefined }
  }

  const handleKetThuc = async () => {
    const payload = await buildPayload()
    setSaving(true)
    try {
      await cd2Api.completePrinting(phieu.id, payload)
      message.success('Đã hoàn thành in — chuyển sang Chờ định hình')
      form.resetFields()
      onDone()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi hoàn thành in')
    } finally {
      setSaving(false)
    }
  }

  const handleNgungIn = async () => {
    const payload = await buildPayload()
    setNgungSaving(true)
    try {
      const res = await cd2Api.ngungIn(phieu.id, payload)
      message.success(`Đã ngưng in — tạo phiếu bù ${res.data.phieu_bu.so_phieu} (${res.data.phieu_bu.so_luong_phoi} tấm)`, 5)
      form.resetFields()
      onDone()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi ngưng in')
    } finally {
      setNgungSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          Kết thúc in — {phieu.so_phieu}
        </Space>
      }
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={saving || ngungSaving}>
          Huỷ
        </Button>,
        <Button
          key="ngung"
          onClick={handleNgungIn}
          loading={ngungSaving}
          disabled={saving}
          style={{ background: '#fa8c16', borderColor: '#fa8c16', color: '#fff' }}
        >
          Ngưng & tạo in bù
        </Button>,
        <Button
          key="ketthuc"
          type="primary"
          onClick={handleKetThuc}
          loading={saving}
          disabled={ngungSaving}
        >
          Kết thúc
        </Button>,
      ]}
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
        onValuesChange={(changed) => {
          if (changed.so_luong_loi != null) {
            form.setFieldsValue({
              so_luong_in_ok: Math.max(0, (phieu.so_luong_phoi ?? 0) - (changed.so_luong_loi ?? 0)),
            })
          }
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

// ── StatCards ─────────────────────────────────────────────────────────────────

function StatCards({ kanban }: { kanban: KanbanData }) {
  const cols = kanban.columns

  // Đếm số đơn trên các máy in (tất cả cột may_X)
  const mayColKeys = kanban.may_ins.map(m => `may_${m.id}`)
  const dangInCount = mayColKeys.reduce((s, k) => s + (cols[k]?.filter(p => p.trang_thai === 'dang_in').length ?? 0), 0)
  const tronMayCount = mayColKeys.reduce((s, k) => s + (cols[k]?.length ?? 0), 0)

  const stats = [
    {
      label: 'Chờ in',
      count: cols['cho_in']?.length ?? 0,
      color: '#d46b08',
      bg: '#fff7e6',
      border: '#ffd591',
    },
    {
      label: 'Kế hoạch',
      count: cols['ke_hoach']?.length ?? 0,
      color: '#0958d9',
      bg: '#e6f4ff',
      border: '#91caff',
    },
    {
      label: 'Trên máy in',
      count: tronMayCount,
      color: '#d4380d',
      bg: '#fff2e8',
      border: '#ffbb96',
      sub: dangInCount > 0 ? `${dangInCount} đang in` : undefined,
    },
    {
      label: 'Chờ TP',
      count: cols['cho_dinh_hinh']?.length ?? 0,
      color: '#531dab',
      bg: '#f9f0ff',
      border: '#d3adf7',
    },
    {
      label: 'Thành phẩm',
      count: cols['sau_in']?.length ?? 0,
      color: '#08979c',
      bg: '#e6fffb',
      border: '#87e8de',
    },
    {
      label: 'Hoàn thành',
      count: cols['hoan_thanh']?.length ?? 0,
      color: '#389e0d',
      bg: '#f6ffed',
      border: '#b7eb8f',
    },
  ]

  const totalActive =
    (cols['cho_in']?.length ?? 0) +
    (cols['ke_hoach']?.length ?? 0) +
    tronMayCount +
    (cols['cho_dinh_hinh']?.length ?? 0) +
    (cols['sau_in']?.length ?? 0)

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 14 }}>
      {stats.map(s => (
        <Col key={s.label} xs={8} sm={4}>
          <div style={{
            background: s.bg,
            border: `1px solid ${s.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            textAlign: 'center',
            lineHeight: 1.2,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>
              {s.count}
            </div>
            <div style={{ fontSize: 11, color: '#595959', marginTop: 3 }}>{s.label}</div>
            {s.sub && (
              <div style={{ fontSize: 10, color: s.color, marginTop: 2, fontWeight: 600 }}>
                ▶ {s.sub}
              </div>
            )}
          </div>
        </Col>
      ))}
      <Col xs={8} sm={4}>
        <div style={{
          background: '#f0f5ff',
          border: '1px solid #adc6ff',
          borderRadius: 8,
          padding: '10px 12px',
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1d39c4' }}>
            {totalActive}
          </div>
          <div style={{ fontSize: 11, color: '#595959', marginTop: 3 }}>Đang xử lý</div>
        </div>
      </Col>
    </Row>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function KanbanCard({
  phieu,
  onClick,
  overlay = false,
  isPaused = false,
  pauseInfo,
  onBatDau,
  onTamDung,
  onTiepTuc,
  onKetThuc,
  onTraVeKhoPhoi,
}: {
  phieu: PhieuIn
  onClick?: () => void
  overlay?: boolean
  isPaused?: boolean
  pauseInfo?: PauseInfo
  onBatDau?: (p: PhieuIn) => void
  onTamDung?: (p: PhieuIn) => void
  onTiepTuc?: (p: PhieuIn) => void
  onKetThuc?: (p: PhieuIn) => void
  onTraVeKhoPhoi?: (p: PhieuIn) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phieu.id,
    data: { phieu, type: 'card' },
    disabled: overlay,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  const isOverdue = phieu.ngay_giao_hang
    ? dayjs(phieu.ngay_giao_hang).isBefore(dayjs(), 'day') || dayjs(phieu.ngay_giao_hang).isSame(dayjs(), 'day')
    : false

  const isStuck = phieu.trang_thai === 'dang_in' && !!phieu.gio_bat_dau_in
    && dayjs().diff(dayjs(phieu.gio_bat_dau_in), 'minute') >= 240

  const borderColor = isStuck ? '#ff4d4f' :
    isOverdue ? '#ff7a45' :
    phieu.trang_thai === 'dang_in' ? '#fa8c16' :
    phieu.trang_thai === 'ke_hoach' ? '#1677ff' :
    phieu.trang_thai === 'cho_dinh_hinh' ? '#722ed1' :
    phieu.trang_thai === 'sau_in' ? '#13c2c2' :
    phieu.trang_thai === 'dang_sau_in' ? '#52c41a' : '#d9d9d9'

  const STATE_TAG: Record<string, { label: string; color: string }> = {
    dang_in:        { label: 'Đang in',  color: 'orange' },
    ke_hoach:       { label: 'KH',       color: 'blue' },
    cho_dinh_hinh:  { label: 'Chờ TP',   color: 'purple' },
    sau_in:         { label: 'Đang TP',  color: 'cyan' },
    dang_sau_in:    { label: 'Đang TP',  color: 'green' },
  }
  const stateTag = STATE_TAG[phieu.trang_thai]

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        size="small"
        style={{
          marginBottom: 6,
          borderLeft: `3px solid ${borderColor}`,
          boxShadow: overlay ? '0 4px 16px rgba(0,0,0,0.18)' : undefined,
        }}
        styles={{ body: { padding: '8px 10px' } }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
          <Text style={{ fontSize: 11, color: '#888' }}>
            {phieu.so_lsx || phieu.so_phieu}
            {phieu.so_lsx && <span style={{ color: '#bbb', marginLeft: 4 }}>({phieu.so_phieu})</span>}
          </Text>
          <Space size={2}>
            {isOverdue && (
              <Tag color="error" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>Hết hạn!</Tag>
            )}
            {stateTag && (
              <Tag color={stateTag.color} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>{stateTag.label}</Tag>
            )}
          </Space>
        </div>

        <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2, lineHeight: 1.3 }}>
          {phieu.ten_hang || '—'}
        </div>

        {phieu.ten_khach_hang && (
          <div style={{ fontSize: 11, color: '#595959', marginTop: 2 }}>{phieu.ten_khach_hang}</div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(() => {
            const hasInOk = phieu.so_luong_in_ok != null
            const slVal = hasInOk ? phieu.so_luong_in_ok : phieu.so_luong_phoi
            return slVal != null ? (
              <Text style={{ fontSize: 11 }}>
                <span style={{ color: '#888' }}>{hasInOk ? 'In OK: ' : 'SL: '}</span>
                <strong style={hasInOk ? { color: '#52c41a' } : undefined}>{slVal.toLocaleString('vi-VN')}</strong>
              </Text>
            ) : null
          })()}
          {phieu.quy_cach && (
            <Text style={{ fontSize: 11, color: '#888' }}>{phieu.quy_cach}</Text>
          )}
          {phieu.ths && (
            <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>{phieu.ths}</Tag>
          )}
          {phieu.pp_ghep && (
            <Tag style={{ fontSize: 10, margin: 0 }}>{phieu.pp_ghep}</Tag>
          )}
          {phieu.loai && (
            <Tag style={{ fontSize: 10, margin: 0 }}>{phieu.loai}</Tag>
          )}
          {phieu.in_2_lan && (
            <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>In 2 lần</Tag>
          )}
        </div>

        {phieu.ngay_giao_hang && (
          <div style={{ fontSize: 10, color: isOverdue ? '#ff4d4f' : '#aaa', marginTop: 4, fontWeight: isOverdue ? 600 : 400 }}>
            Giao: {dayjs(phieu.ngay_giao_hang).format('DD/MM/YY')}
          </div>
        )}

        {phieu.trang_thai === 'dang_in' && phieu.gio_bat_dau_in && (
          <div style={{ fontSize: 10, marginTop: 4 }}>
            <ElapsedTime start={phieu.gio_bat_dau_in} />
          </div>
        )}

        {phieu.trang_thai === 'hoan_thanh' && phieu.gio_bat_dau_in && phieu.gio_hoan_thanh && (() => {
          const mins = dayjs(phieu.gio_hoan_thanh).diff(dayjs(phieu.gio_bat_dau_in), 'minute')
          const h = Math.floor(mins / 60)
          const m = mins % 60
          return (
            <div style={{ fontSize: 10, color: '#52c41a', marginTop: 4, fontWeight: 600 }}>
              ⏱ {h > 0 ? `${h}h ` : ''}{m}m
            </div>
          )
        })()}

        {/* ── Quick action buttons ── */}
        {!overlay && (phieu.trang_thai === 'cho_in' || phieu.trang_thai === 'ke_hoach') && (
          <div
            style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 6, cursor: 'default' }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              block
              style={{ background: '#52c41a', borderColor: '#52c41a', fontSize: 12 }}
              onClick={() => onBatDau?.(phieu)}
            >
              Bắt đầu in
            </Button>
            {!phieu.may_in_id && (
              <Popconfirm
                title={`Trả phôi về kho và huỷ phiếu in ${phieu.so_phieu}?`}
                description="Phôi sẽ được hoàn lại kho, phiếu in sẽ bị huỷ."
                onConfirm={() => onTraVeKhoPhoi?.(phieu)}
                okText="Xác nhận"
                cancelText="Thôi"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<RollbackOutlined />}
                  block
                  style={{ marginTop: 4, fontSize: 12 }}
                >
                  Trả về kho phôi
                </Button>
              </Popconfirm>
            )}
          </div>
        )}

        {!overlay && phieu.trang_thai === 'dang_in' && (
          <div
            style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 6, cursor: 'default' }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {isPaused ? (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div style={{ fontSize: 10, color: '#faad14', fontWeight: 600 }}>
                  ⏸ Tạm dừng{pauseInfo ? ` lúc ${pauseInfo.time}` : ''}
                </div>
                {pauseInfo?.ly_do && (
                  <div style={{ fontSize: 10, color: '#8c8c8c', fontStyle: 'italic' }}>
                    Lý do: {pauseInfo.ly_do}
                  </div>
                )}
                <Button
                  size="small"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  block
                  onClick={() => onTiepTuc?.(phieu)}
                >
                  Tiếp tục in
                </Button>
              </Space>
            ) : (
              <Space.Compact block>
                <Button
                  size="small"
                  icon={<PauseOutlined />}
                  style={{ flex: 1 }}
                  onClick={() => onTamDung?.(phieu)}
                >
                  Tạm dừng
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{ flex: 1 }}
                  onClick={() => onKetThuc ? onKetThuc(phieu) : onClick?.()}
                >
                  Kết thúc
                </Button>
              </Space.Compact>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({
  colId, title, cards, color, onCardClick, pauses, onBatDau, onTamDung, onTiepTuc, onKetThuc, onTraVeKhoPhoi,
}: {
  colId: string
  title: string
  cards: PhieuIn[]
  color?: string
  onCardClick: (p: PhieuIn) => void
  pauses: Record<number, PauseInfo>
  onBatDau: (p: PhieuIn) => void
  onTamDung: (p: PhieuIn) => void
  onTiepTuc: (p: PhieuIn) => void
  onKetThuc: (p: PhieuIn) => void
  onTraVeKhoPhoi: (p: PhieuIn) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 210, maxWidth: 230 }}>
      <div style={{
        padding: '8px 10px',
        background: color || '#fafafa',
        borderRadius: '6px 6px 0 0',
        borderBottom: '2px solid #e8e8e8',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Text strong style={{ fontSize: 13 }}>{title}</Text>
        <Badge count={cards.length} showZero style={{ backgroundColor: '#bbb' }} />
      </div>

      <div
        ref={setNodeRef}
        style={{
          flex: 1, minHeight: 80, padding: '8px 6px',
          background: isOver ? '#e6f4ff' : '#f5f5f5',
          borderRadius: '0 0 6px 6px',
          border: isOver ? '2px dashed #1677ff' : '2px solid transparent',
          transition: 'background 0.15s, border 0.15s',
        }}
      >
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => {
            const localPause = pauses[card.id]
            const backendPaused = !localPause && !!card.tam_dung_luc
            const isPaused = !!localPause || backendPaused
            const pauseInfo: PauseInfo | undefined = localPause
              ?? (card.tam_dung_luc ? { time: dayjs(card.tam_dung_luc).format('HH:mm'), ly_do: card.tam_dung_ly_do || '' } : undefined)
            return (
              <KanbanCard
                key={card.id}
                phieu={card}
                onClick={() => onCardClick(card)}
                isPaused={isPaused}
                pauseInfo={pauseInfo}
                onBatDau={onBatDau}
                onTamDung={onTamDung}
                onTiepTuc={onTiepTuc}
                onKetThuc={onKetThuc}
                onTraVeKhoPhoi={onTraVeKhoPhoi}
              />
            )
          })}
        </SortableContext>
        {cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: 12 }}>
            Thả thẻ vào đây
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getColumnStatus(colId: string): { trang_thai: string; may_in_id: number | null } {
  if (colId === 'cho_in') return { trang_thai: 'cho_in', may_in_id: null }
  if (colId === 'ke_hoach') return { trang_thai: 'ke_hoach', may_in_id: null }
  if (colId === 'cho_dinh_hinh') return { trang_thai: 'cho_dinh_hinh', may_in_id: null }
  if (colId === 'sau_in') return { trang_thai: 'sau_in', may_in_id: null }
  if (colId === 'hoan_thanh') return { trang_thai: 'hoan_thanh', may_in_id: null }
  if (colId.startsWith('may_')) {
    return { trang_thai: 'ke_hoach', may_in_id: parseInt(colId.replace('may_', ''), 10) }
  }
  return { trang_thai: 'cho_in', may_in_id: null }
}

function getCardColumn(phieu: PhieuIn): string {
  if (phieu.trang_thai === 'cho_in') return 'cho_in'
  if (phieu.trang_thai === 'ke_hoach' && !phieu.may_in_id) return 'ke_hoach'
  if (phieu.trang_thai === 'cho_dinh_hinh') return 'cho_dinh_hinh'
  if (phieu.trang_thai === 'sau_in') return 'sau_in'
  if (phieu.trang_thai === 'hoan_thanh') return 'hoan_thanh'
  if ((phieu.trang_thai === 'ke_hoach' || phieu.trang_thai === 'dang_in') && phieu.may_in_id) {
    return `may_${phieu.may_in_id}`
  }
  return 'cho_in'
}

function getAllCards(columns: Record<string, PhieuIn[]>): PhieuIn[] {
  return Object.values(columns).flat()
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CD2KanbanPage() {
  const qc = useQueryClient()
  const [activePhieu, setActivePhieu] = useState<PhieuIn | null>(null)
  const [localColumns, setLocalColumns] = useState<Record<string, PhieuIn[]> | null>(null)
  const [selectedPhieu, setSelectedPhieu] = useState<PhieuIn | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()
  const [pauses, setPauses] = useState<Record<number, PauseInfo>>(readPauses)
  const [pausingPhieu, setPausingPhieu] = useState<PhieuIn | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const [completingPhieu, setCompletingPhieu] = useState<PhieuIn | null>(null)

  const { data: kanban, isLoading, isError, error } = useQuery({
    queryKey: ['cd2-kanban', phanXuongId],
    queryFn: () => cd2Api.getKanban({ phan_xuong_id: phanXuongId! }).then(r => r.data),
    enabled: !!phanXuongId,
    retry: 1,
    // refetchInterval removed in favor of WebSockets
  })

  useEffect(() => {
    if (kanban && !activePhieu) {
      setLocalColumns(kanban.columns)
    }
  }, [kanban, activePhieu])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const lastOverId = useRef<string | null>(null)

  // Dùng pointer position để detect column — closestCorners dùng ghost rect nên kéo trái không nhận
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      lastOverId.current = String(pointerCollisions[0].id)
      return pointerCollisions
    }
    const intersections = rectIntersection(args)
    const overId = getFirstCollision(intersections, 'id')
    if (overId != null) {
      lastOverId.current = String(overId)
      return intersections
    }
    return lastOverId.current ? [{ id: lastOverId.current }] : []
  }, [])

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['cd2-kanban'] })
  }, [qc])

  const handleBatDau = useCallback(async (phieu: PhieuIn) => {
    try {
      await cd2Api.startPrinting(phieu.id)
      message.success(`Bắt đầu in — ${phieu.so_phieu}`)
      invalidate()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi bắt đầu in')
    }
  }, [invalidate])

  const handleTraVeKhoPhoi = useCallback(async (phieu: PhieuIn) => {
    try {
      await cd2Api.traVeKhoPhoi(phieu.id)
      message.success(`Đã trả phôi về kho — huỷ phiếu ${phieu.so_phieu}`)
      invalidate()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi trả về kho phôi')
    }
  }, [invalidate])

  const handleTamDung = useCallback((phieu: PhieuIn) => {
    setPauseReason('')
    setPausingPhieu(phieu)
  }, [])

  const handleConfirmPause = useCallback(async () => {
    if (!pausingPhieu) return
    if (!pauseReason.trim()) { message.warning('Vui lòng nhập lý do tạm dừng'); return }
    const info: PauseInfo = { time: dayjs().format('HH:mm'), ly_do: pauseReason.trim() }
    const id = pausingPhieu.id
    storage.set(PAUSE_KEY(id), info, { ttl: 12 * TTL.HOUR })  // hết hạn sau 1 ca
    setPauses(prev => ({ ...prev, [id]: info }))
    setPausingPhieu(null)
    setPauseReason('')
    try {
      await cd2Api.tamDungIn(id, { ly_do: info.ly_do })
      message.info(`Tạm dừng lúc ${info.time} — ${info.ly_do}`)
      invalidate()
    } catch (e) {
      storage.remove(PAUSE_KEY(id))
      setPauses(prev => { const next = { ...prev }; delete next[id]; return next })
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tạm dừng in')
    }
  }, [pausingPhieu, pauseReason, invalidate])

  const handleKetThuc = useCallback((phieu: PhieuIn) => {
    setCompletingPhieu(phieu)
  }, [])

  const handleTiepTuc = useCallback(async (phieu: PhieuIn) => {
    storage.remove(PAUSE_KEY(phieu.id))
    setPauses(prev => { const next = { ...prev }; delete next[phieu.id]; return next })
    try {
      await cd2Api.tiepTucIn(phieu.id)
      message.success('Tiếp tục in')
      invalidate()
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tiếp tục in')
      invalidate()
    }
  }, [invalidate])

  // Lắng nghe tín hiệu từ WebSockets
  useEffect(() => {
    const handleUpdate = () => {
      invalidate()
    }
    socket.on('machine_status_update', handleUpdate)
    return () => {
      socket.off('machine_status_update', handleUpdate)
    }
  }, [invalidate])

  const handleXuongChange = (id: number | undefined) => {
    setPhanXuongId(id)
    setLocalColumns(null)
  }

  const cols = kanban ? [
    { id: 'cho_in',       title: 'Chờ in',         color: '#fff7e6' },
    { id: 'ke_hoach',     title: 'Kế hoạch in',     color: '#e6f7ff' },
    ...kanban.may_ins.map(m => ({
      id: `may_${m.id}`,
      title: m.ten_may,
      color: '#e6f4ff',
    })),
    { id: 'cho_dinh_hinh', title: 'Chờ TP',       color: '#f9f0ff' },
    { id: 'sau_in',        title: 'Thành phẩm',   color: '#e6fffb' },
    { id: 'hoan_thanh',    title: 'Hoàn thành',     color: '#f6ffed' },
  ] : []

  const currentColumns = localColumns ?? kanban?.columns ?? {}

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const phieu = event.active.data.current?.phieu as PhieuIn | undefined
    setActivePhieu(phieu ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    if (!localColumns) return
    const { active, over } = event
    if (!over) return

    const activeId = active.id as number
    const overId = over.id

    const allCards = getAllCards(localColumns)
    const activeCard = allCards.find(p => p.id === activeId)
    if (!activeCard) return

    const activeColId = getCardColumn(activeCard)
    let overColId: string

    if (typeof overId === 'string') {
      overColId = overId
    } else {
      const overCard = allCards.find(p => p.id === overId)
      if (!overCard) return
      overColId = getCardColumn(overCard)
    }

    if (activeColId === overColId) return

    const { trang_thai, may_in_id } = getColumnStatus(overColId)
    const updatedCard: PhieuIn = { ...activeCard, trang_thai, may_in_id }

    const newCols = { ...localColumns }
    for (const key of Object.keys(newCols)) {
      newCols[key] = newCols[key].filter(p => p.id !== activeId)
    }
    if (!newCols[overColId]) newCols[overColId] = []
    newCols[overColId] = [updatedCard, ...newCols[overColId]]
    setLocalColumns(newCols)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActivePhieu(null)
    if (!localColumns || !kanban) return
    const { active, over } = event
    if (!over) {
      setLocalColumns(kanban.columns)
      return
    }

    const activeId = active.id as number
    const overId = over.id

    const allServerCards = getAllCards(kanban.columns)
    const originalCard = allServerCards.find(p => p.id === activeId)
    if (!originalCard) return

    let targetColId: string
    if (typeof overId === 'string') {
      targetColId = overId
    } else {
      const allLocalCards = getAllCards(localColumns)
      const overCard = allLocalCards.find(p => p.id === overId)
      if (!overCard) { setLocalColumns(kanban.columns); return }
      targetColId = getCardColumn(overCard)
    }

    const { trang_thai, may_in_id } = getColumnStatus(targetColId)

    const targetCards = localColumns[targetColId] || []
    const newSortOrder = typeof overId === 'number'
      ? targetCards.findIndex(p => p.id === overId)
      : targetCards.length

    // Batch-update sort_order toàn bộ các column bị ảnh hưởng để thứ tự không bị nhảy
    const sourceColId = getCardColumn(originalCard)
    const affectedCols = new Set([sourceColId, targetColId])
    const reorderItems: { id: number; sort_order: number }[] = []
    for (const colId of affectedCols) {
      ;(localColumns[colId] || []).forEach((p, idx) =>
        reorderItems.push({ id: p.id, sort_order: idx })
      )
    }

    const isSameCol = sourceColId === targetColId
    const calls = isSameCol
      // Cùng cột: chỉ cần reorder, không gọi move (tránh race condition)
      ? [cd2Api.reorderPhieuIn(reorderItems)]
      // Khác cột: move trước (đổi trang_thai/may_in_id), rồi reorder cả 2 cột
      : [
          cd2Api.movePhieuIn(activeId, { trang_thai, may_in_id, sort_order: newSortOrder }),
          cd2Api.reorderPhieuIn(reorderItems),
        ]

    Promise.all(calls)
      .then(() => invalidate())
      .catch(() => {
        message.error('Cập nhật thất bại')
        setLocalColumns(kanban.columns)
        invalidate()
      })
  }

  if (!phanXuongId) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <PrinterOutlined style={{ fontSize: 20, color: '#1677ff' }} />
              <Typography.Title level={4} style={{ margin: 0 }}>
                Kanban Công Đoạn 2 — Máy In
              </Typography.Title>
              <CD2WorkshopSelector
                value={phanXuongId}
                onChange={handleXuongChange}
                phanXuongList={phanXuongList}
              />
            </Space>
          </Col>
        </Row>
        <Alert
          type="info"
          message="Vui lòng chọn xưởng"
          description="Chọn xưởng ở trên để xem Kanban máy in của xưởng đó."
          showIcon
          style={{ margin: '40px auto', maxWidth: 480 }}
        />
      </div>
    )
  }

  if (isLoading && !kanban) {
    return <Card loading style={{ margin: 24 }} />
  }

  if (isError) {
    const errMsg = (error as {response?: {data?: {detail?: string}}})?.response?.data?.detail
      || (error as {message?: string})?.message
      || 'Không thể kết nối server'
    return (
      <Alert
        type="error"
        message="Không thể tải Kanban máy in"
        description={errMsg}
        action={<Button onClick={invalidate}>Thử lại</Button>}
        style={{ margin: 24 }}
        showIcon
      />
    )
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <PrinterOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              Kanban Công Đoạn 2 — Máy In
            </Typography.Title>
            <CD2WorkshopSelector
              value={phanXuongId}
              onChange={handleXuongChange}
              phanXuongList={phanXuongList}
            />
          </Space>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Cấu hình máy in">
              <Button icon={<SettingOutlined />} onClick={() => setShowSettings(true)} />
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={invalidate}>Làm mới</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>
              Thêm phiếu in
            </Button>
          </Space>
        </Col>
      </Row>

      {kanban && <StatCards kanban={kanban} />}

      {kanban && kanban.may_ins.length === 0 && phanXuongId && (
        <Alert
          type="warning"
          message="Xưởng này chưa có máy in"
          description="Không có máy in nào được gán cho xưởng đang chọn. Hãy chọn 'Tất cả xưởng' hoặc vào Cấu hình máy in để gán xưởng."
          style={{ marginBottom: 12 }}
          showIcon
          action={
            <Button size="small" onClick={() => handleXuongChange(undefined)}>
              Xem tất cả xưởng
            </Button>
          }
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          paddingBottom: 16, minHeight: 'calc(100vh - 200px)',
          alignItems: 'flex-start',
        }}>
          {cols.map(col => (
            <KanbanColumn
              key={col.id}
              colId={col.id}
              title={col.title}
              color={col.color}
              cards={currentColumns[col.id] || []}
              onCardClick={p => setSelectedPhieu(p)}
              pauses={pauses}
              onBatDau={handleBatDau}
              onTamDung={handleTamDung}
              onTiepTuc={handleTiepTuc}
              onKetThuc={handleKetThuc}
              onTraVeKhoPhoi={handleTraVeKhoPhoi}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }} modifiers={[snapCenterToCursor]}>
          {activePhieu ? (
            <div style={{ width: 210 }}>
              <KanbanCard phieu={activePhieu} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {(selectedPhieu || showCreate) && (
        <PhieuInModal
          phieu={showCreate ? null : selectedPhieu}
          open
          onClose={() => { setSelectedPhieu(null); setShowCreate(false) }}
          onSaved={() => { setSelectedPhieu(null); setShowCreate(false); invalidate() }}
        />
      )}

      {showSettings && (
        <MayInSettingsModal
          open
          onClose={() => setShowSettings(false)}
          onSaved={invalidate}
        />
      )}

      {completingPhieu && (
        <CompleteModal
          phieu={completingPhieu}
          open
          onClose={() => setCompletingPhieu(null)}
          onDone={() => { setCompletingPhieu(null); invalidate() }}
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
    </div>
  )
}
