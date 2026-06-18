import { useState, useEffect } from 'react'
import { Modal, Checkbox, Input, InputNumber, Button, Divider } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
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

function extractTitle(title: unknown): string {
  if (typeof title === 'string') return title
  if (typeof title === 'number') return String(title)
  if (Array.isArray(title)) return title.map(extractTitle).filter(Boolean).join(' ')
  if (title && typeof title === 'object' && 'props' in (title as object)) {
    const el = title as { props?: { children?: unknown; title?: unknown; label?: unknown } }
    return (
      extractTitle(el.props?.children) ||
      extractTitle(el.props?.title) ||
      extractTitle(el.props?.label) ||
      ''
    )
  }
  return ''
}

interface DraftItem {
  key: string
  originalTitle: string
  label?: string
  visible: boolean
  width?: number
  originalWidth?: number
  fixed?: 'left' | false
  originalFixed?: 'left' | 'right' | boolean
  nonHideable: boolean
}

interface SortableRowProps {
  item: DraftItem
  editMode: boolean
  isSearching: boolean
  onChange: (key: string, patch: Partial<DraftItem>) => void
}

function SortableRow({ item, editMode, isSearching, onChange }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    padding: '5px 8px',
    gap: 8,
    background: isDragging ? '#e6f4ff' : undefined,
    borderBottom: '1px solid #f5f5f5',
    userSelect: 'none',
  }

  const displayLabel = item.label ?? item.originalTitle
  const isCodeFixed = item.originalFixed === 'left' || item.originalFixed === 'right'
  const isPinnedLeft = item.fixed === 'left' || item.originalFixed === 'left'

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <span
        {...(isSearching ? {} : { ...attributes, ...listeners })}
        style={{
          cursor: isSearching ? 'not-allowed' : 'grab',
          color: isSearching ? '#e5e7eb' : '#bbb',
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
        }}
        title={isSearching ? 'Bỏ tìm kiếm để kéo đổi thứ tự' : 'Kéo để đổi thứ tự'}
      >
        <HolderOutlined />
      </span>

      {/* Visible checkbox */}
      <Checkbox
        checked={item.visible}
        disabled={item.nonHideable}
        onChange={() => onChange(item.key, { visible: !item.visible })}
        style={{ flexShrink: 0 }}
      />

      {/* Column name */}
      <span style={{
        flex: editMode ? '0 0 140px' : 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 13,
        color: item.visible ? undefined : '#bfbfbf',
      }}>
        {item.originalTitle || <em style={{ color: '#bfbfbf' }}>[{item.key}]</em>}
      </span>

      {editMode ? (
        <>
          {/* Display label input */}
          <Input
            size="small"
            value={displayLabel}
            style={{ flex: 1, minWidth: 80 }}
            onChange={e => {
              const val = e.target.value
              onChange(item.key, {
                label: val === item.originalTitle ? undefined : (val || undefined),
              })
            }}
          />
          {/* Width input */}
          <InputNumber
            size="small"
            value={item.width ?? item.originalWidth ?? 150}
            style={{ width: 70, flexShrink: 0 }}
            min={40}
            max={800}
            onChange={v => onChange(item.key, { width: v ?? undefined })}
          />
          {/* Pin to left checkbox */}
          <div style={{ width: 50, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <Checkbox
              checked={isPinnedLeft}
              disabled={isCodeFixed}
              onChange={e => onChange(item.key, { fixed: e.target.checked ? 'left' : false })}
            />
          </div>
        </>
      ) : (
        isCodeFixed && (
          <span style={{ fontSize: 11, color: '#bfbfbf', flexShrink: 0 }}>
            {item.originalFixed === 'left' ? 'Cố định trái' : 'Cố định phải'}
          </span>
        )
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
  open, columns, prefs, nonHideable, onSave, onClose,
}: ColumnSettingsProps) {
  const [search, setSearch] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [showHidden, setShowHidden] = useState(true)
  const [items, setItems] = useState<DraftItem[]>([])

  useEffect(() => {
    if (!open) return
    const draft: DraftItem[] = columns
      .map((col, idx) => {
        const key = getColKey(col)
        const pref = prefs[key]
        return {
          key,
          originalTitle: extractTitle(col.title),
          label: pref?.label,
          visible: pref?.visible ?? true,
          width: pref?.width,
          originalWidth: typeof (col as { width?: number }).width === 'number'
            ? (col as { width?: number }).width
            : undefined,
          fixed: pref?.fixed,
          originalFixed: col.fixed as 'left' | 'right' | undefined,
          nonHideable: nonHideable.includes(key),
          _defaultOrder: pref?.order ?? idx,
        } as DraftItem & { _defaultOrder: number }
      })
      .filter(it => it.key)
      .sort((a, b) =>
        ((a as DraftItem & { _defaultOrder: number })._defaultOrder) -
        ((b as DraftItem & { _defaultOrder: number })._defaultOrder)
      )
    setItems(draft)
    setSearch('')
  }, [open, columns, prefs, nonHideable])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const isSearching = search.trim().length > 0

  const filteredItems = (() => {
    let list = items
    if (isSearching) {
      const q = search.toLowerCase()
      list = list.filter(it =>
        it.originalTitle.toLowerCase().includes(q) ||
        (it.label ?? '').toLowerCase().includes(q)
      )
    } else if (!showHidden) {
      list = list.filter(it => it.visible)
    }
    return list
  })()

  function handleDragEnd(event: DragEndEvent) {
    if (isSearching) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const oldIdx = prev.findIndex(i => i.key === active.id)
      const newIdx = prev.findIndex(i => i.key === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function handleChange(key: string, patch: Partial<DraftItem>) {
    setItems(prev => prev.map(it => (it.key === key ? { ...it, ...patch } : it)))
  }

  function showAll() {
    setItems(prev => prev.map(it => (it.nonHideable ? it : { ...it, visible: true })))
  }

  function hideAll() {
    setItems(prev => prev.map(it => (it.nonHideable ? it : { ...it, visible: false })))
  }

  function handleOk() {
    const newPrefs: ColPrefs = {}
    items.forEach((it, idx) => {
      if (!it.key) return
      newPrefs[it.key] = {
        visible: it.visible,
        order: idx,
        ...(it.label !== undefined ? { label: it.label } : {}),
        ...(it.width !== undefined ? { width: it.width } : {}),
        ...(it.fixed !== undefined ? { fixed: it.fixed } : {}),
      }
    })
    onSave(newPrefs)
  }

  const visibleCount = items.filter(it => it.visible).length
  const hiddenCount = items.length - visibleCount
  const allChecked = visibleCount === items.length
  const someChecked = visibleCount > 0 && visibleCount < items.length

  return (
    <Modal
      title="Tùy chỉnh giao diện"
      open={open}
      onCancel={onClose}
      width={editMode ? 700 : 420}
      styles={{ body: { padding: '12px 0 0' } }}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {hiddenCount > 0 && !isSearching && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12 }}
                onClick={() => setShowHidden(v => !v)}
              >
                {showHidden ? 'Ẩn bớt' : `Hiện thêm (${hiddenCount} cột ẩn)`}
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" onClick={handleOk}>Xác nhận</Button>
          </div>
        </div>
      }
    >
      {/* Search + edit mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 10px' }}>
        <Input.Search
          placeholder="Nhập từ khóa tìm kiếm"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          size="small"
          style={{ flex: 1 }}
        />
        <Button
          type="link"
          size="small"
          onClick={() => setEditMode(v => !v)}
          style={{ padding: 0, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {editMode ? 'Thu gọn' : 'Sửa tên cột hiển thị và độ rộng'}
        </Button>
      </div>

      {/* Column list header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        background: '#fafafa',
        borderTop: '1px solid #f0f0f0',
        borderBottom: '1px solid #f0f0f0',
        fontSize: 11,
        color: '#8c8c8c',
        fontWeight: 600,
      }}>
        <span style={{ width: 14, flexShrink: 0 }} />
        <Checkbox
          checked={allChecked}
          indeterminate={someChecked}
          onChange={e => (e.target.checked ? showAll() : hideAll())}
          style={{ flexShrink: 0 }}
        />
        <span style={{ flex: editMode ? '0 0 140px' : 1 }}>Tên cột dữ liệu</span>
        {editMode ? (
          <>
            <span style={{ flex: 1 }}>Tên cột trên giao diện</span>
            <span style={{ width: 70, textAlign: 'center', flexShrink: 0 }}>Độ rộng</span>
            <span style={{ width: 50, textAlign: 'center', flexShrink: 0 }}>Cố định cột</span>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', fontWeight: 400 }}>
            <span style={{ color: '#595959', fontSize: 11, marginRight: 4 }}>
              {visibleCount}/{items.length}
            </span>
            <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 11 }} onClick={showAll}>
              Hiện tất cả
            </Button>
            <Divider type="vertical" style={{ margin: '0 2px' }} />
            <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 11 }} onClick={hideAll}>
              Ẩn tất cả
            </Button>
          </div>
        )}
      </div>

      {/* Draggable rows */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {isSearching ? (
          filteredItems.map(item => (
            <SortableRow
              key={item.key}
              item={item}
              editMode={editMode}
              isSearching
              onChange={handleChange}
            />
          ))
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredItems.map(i => i.key)} strategy={verticalListSortingStrategy}>
              {filteredItems.map(item => (
                <SortableRow
                  key={item.key}
                  item={item}
                  editMode={editMode}
                  isSearching={false}
                  onChange={handleChange}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {filteredItems.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#bfbfbf', fontSize: 13 }}>
            Không tìm thấy cột nào
          </div>
        )}
      </div>
    </Modal>
  )
}
