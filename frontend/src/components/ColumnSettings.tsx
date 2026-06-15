import { useState, useEffect } from 'react'
import { Modal, Checkbox, Input, Typography, Button, Divider } from 'antd'
import { HolderOutlined, SearchOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnsType } from 'antd/es/table'
import type { ColPrefs } from '../hooks/useColumnPrefs'
import { getColKey } from '../hooks/useColumnPrefs'

const { Text } = Typography

interface DraftItem {
  key: string
  title: string
  visible: boolean
  fixed?: 'left' | 'right' | boolean
}

function extractTitle(title: unknown): string {
  if (typeof title === 'string') return title
  if (typeof title === 'number') return String(title)
  return ''
}

interface SortableRowProps {
  item: DraftItem
  nonHideable: string[]
  onToggle: (key: string) => void
}

function SortableRow({ item, nonHideable, onToggle }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    gap: 8,
    background: isDragging ? '#f0f7ff' : undefined,
    borderRadius: 4,
    userSelect: 'none',
  }

  const isFixed = item.fixed === 'left' || item.fixed === 'right'
  const disabled = nonHideable.includes(item.key) || isFixed

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: '#bbb', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
        title="Kéo để đổi thứ tự"
      >
        <HolderOutlined />
      </span>
      <Checkbox
        checked={item.visible}
        disabled={disabled}
        onChange={() => onToggle(item.key)}
        style={{ flexShrink: 0 }}
      />
      <Text style={{ flex: 1, fontSize: 13 }}>
        {item.title || <Text type="secondary" italic>[{item.key}]</Text>}
      </Text>
      {isFixed && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {item.fixed === 'left' ? 'Cố định trái' : 'Cố định phải'}
        </Text>
      )}
    </div>
  )
}

interface ColumnSettingsProps {
  open: boolean
  columns: ColumnsType<unknown>
  prefs: ColPrefs
  nonHideable: string[]
  onSave: (prefs: ColPrefs) => void
  onClose: () => void
}

export default function ColumnSettings({
  open,
  columns,
  prefs,
  nonHideable,
  onSave,
  onClose,
}: ColumnSettingsProps) {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  // Build draft items from prefs+columns whenever modal opens
  useEffect(() => {
    if (!open) return
    const draft: DraftItem[] = columns
      .map(col => ({
        key: getColKey(col),
        title: extractTitle(col.title),
        visible: prefs[getColKey(col)]?.visible ?? true,
        fixed: col.fixed,
      }))
      .filter(it => it.key)
      .sort((a, b) => (prefs[a.key]?.order ?? 0) - (prefs[b.key]?.order ?? 0))
    setItems(draft)
    setSearch('')
  }, [open, columns, prefs])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const oldIdx = prev.findIndex(i => i.key === active.id)
      const newIdx = prev.findIndex(i => i.key === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function toggleVisible(key: string) {
    setItems(prev => prev.map(it => (it.key === key ? { ...it, visible: !it.visible } : it)))
  }

  function showAll() {
    setItems(prev => prev.map(it => ({ ...it, visible: true })))
  }

  function hideAll() {
    setItems(prev =>
      prev.map(it => {
        if (nonHideable.includes(it.key) || it.fixed === 'left' || it.fixed === 'right')
          return it
        return { ...it, visible: false }
      }),
    )
  }

  function handleOk() {
    const newPrefs: ColPrefs = {}
    items.forEach((it, idx) => {
      newPrefs[it.key] = { visible: it.visible, order: idx }
    })
    onSave(newPrefs)
  }

  const filteredItems = search
    ? items.filter(it => it.title.toLowerCase().includes(search.toLowerCase()))
    : items

  const visibleCount = items.filter(it => it.visible).length

  return (
    <Modal
      title="Tùy chỉnh giao diện"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="Xác nhận"
      cancelText="Hủy"
      width={400}
      styles={{ body: { padding: '12px 0' } }}
      destroyOnClose
    >
      {/* Search + show/hide all */}
      <div style={{ padding: '0 16px 8px' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Nhập từ khóa tìm kiếm"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          size="small"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Đang hiện {visibleCount}/{items.length} cột
          </Text>
          <span>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={showAll}>
              Hiện tất cả
            </Button>
            <Divider type="vertical" />
            <Button type="link" size="small" style={{ padding: 0 }} onClick={hideAll}>
              Ẩn tất cả
            </Button>
          </span>
        </div>
      </div>

      {/* Column header */}
      <div
        style={{
          padding: '4px 16px',
          background: '#e6f4ff',
          borderTop: '1px solid #d0e8ff',
          borderBottom: '1px solid #d0e8ff',
          fontSize: 12,
          fontWeight: 600,
          color: '#1677ff',
          marginBottom: 4,
        }}
      >
        Tên cột dữ liệu
      </div>

      {/* Draggable list */}
      <div style={{ maxHeight: 380, overflowY: 'auto', padding: '4px 8px' }}>
        {search ? (
          // When searching, render without drag (can't reorder filtered subset)
          filteredItems.map(item => (
            <SortableRow
              key={item.key}
              item={item}
              nonHideable={nonHideable}
              onToggle={toggleVisible}
            />
          ))
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.key)} strategy={verticalListSortingStrategy}>
              {items.map(item => (
                <SortableRow
                  key={item.key}
                  item={item}
                  nonHideable={nonHideable}
                  onToggle={toggleVisible}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {filteredItems.length === 0 && (
          <Text type="secondary" style={{ padding: '12px 8px', display: 'block', textAlign: 'center' }}>
            Không tìm thấy cột nào
          </Text>
        )}
      </div>
    </Modal>
  )
}
