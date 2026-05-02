import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, closestCorners, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Badge, Button, Card, Col, message, Row, Space, Tag, Tooltip, Typography,
} from 'antd'
import {
  PlusOutlined, PrinterOutlined, ReloadOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, PhieuIn, KanbanData } from '../../api/cd2'
import PhieuInModal from './PhieuInModal'
import MayInSettingsModal from './MayInSettingsModal'

const { Text } = Typography

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
      label: 'Chờ định hình',
      count: cols['cho_dinh_hinh']?.length ?? 0,
      color: '#531dab',
      bg: '#f9f0ff',
      border: '#d3adf7',
    },
    {
      label: 'Sau in',
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
}: {
  phieu: PhieuIn
  onClick?: () => void
  overlay?: boolean
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
    cursor: 'grab',
  }

  const borderColor =
    phieu.trang_thai === 'dang_in' ? '#fa8c16' :
    phieu.trang_thai === 'ke_hoach' ? '#1677ff' :
    phieu.trang_thai === 'cho_dinh_hinh' ? '#722ed1' :
    phieu.trang_thai === 'sau_in' ? '#13c2c2' : '#d9d9d9'

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 11, color: '#888' }}>{phieu.so_phieu}</Text>
          {phieu.trang_thai === 'dang_in' && (
            <Tag color="orange" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>Đang in</Tag>
          )}
          {phieu.trang_thai === 'ke_hoach' && (
            <Tag color="blue" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>KH</Tag>
          )}
        </div>

        <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2, lineHeight: 1.3 }}>
          {phieu.ten_hang || '—'}
        </div>

        {phieu.ten_khach_hang && (
          <div style={{ fontSize: 11, color: '#595959', marginTop: 2 }}>{phieu.ten_khach_hang}</div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {phieu.so_luong_phoi != null && (
            <Text style={{ fontSize: 11 }}>
              <span style={{ color: '#888' }}>SL: </span>
              <strong>{phieu.so_luong_phoi.toLocaleString('vi-VN')}</strong>
            </Text>
          )}
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
        </div>

        {phieu.ngay_giao_hang && (
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
            Giao: {dayjs(phieu.ngay_giao_hang).format('DD/MM/YY')}
          </div>
        )}

        {phieu.trang_thai === 'dang_in' && phieu.gio_bat_dau_in && (
          <div style={{ fontSize: 10, color: '#fa8c16', marginTop: 4, fontWeight: 600 }}>
            ▶ Bắt đầu: {dayjs(phieu.gio_bat_dau_in).format('HH:mm')}
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
      </Card>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({
  colId, title, cards, color, onCardClick,
}: {
  colId: string
  title: string
  cards: PhieuIn[]
  color?: string
  onCardClick: (p: PhieuIn) => void
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
          {cards.map(card => (
            <KanbanCard key={card.id} phieu={card} onClick={() => onCardClick(card)} />
          ))}
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

  const { data: kanban, isLoading } = useQuery({
    queryKey: ['cd2-kanban'],
    queryFn: () => cd2Api.getKanban().then(r => r.data),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (kanban && !activePhieu) {
      setLocalColumns(kanban.columns)
    }
  }, [kanban, activePhieu])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['cd2-kanban'] })
  }, [qc])

  const cols = kanban ? [
    { id: 'cho_in',       title: 'Chờ in',         color: '#fff7e6' },
    { id: 'ke_hoach',     title: 'Kế hoạch in',     color: '#e6f7ff' },
    ...kanban.may_ins.map(m => ({
      id: `may_${m.id}`,
      title: m.ten_may,
      color: '#e6f4ff',
    })),
    { id: 'cho_dinh_hinh', title: 'Chờ định hình', color: '#f9f0ff' },
    { id: 'sau_in',        title: 'Sau in',         color: '#e6fffb' },
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

    cd2Api.movePhieuIn(activeId, { trang_thai, may_in_id, sort_order: newSortOrder })
      .then(() => invalidate())
      .catch(() => {
        message.error('Cập nhật thất bại')
        setLocalColumns(kanban.columns)
        invalidate()
      })
  }

  if (isLoading && !kanban) {
    return <Card loading style={{ margin: 24 }} />
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
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
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activePhieu ? <KanbanCard phieu={activePhieu} overlay /> : null}
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
    </div>
  )
}
