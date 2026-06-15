import { useMemo } from 'react'
import { Modal } from 'antd'
import { useHotkeyRegistry, type HotkeyDefinition } from '../contexts/HotkeyContext'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

const GLOBAL_GROUP = 'Toàn cục'

const kbdStyle: React.CSSProperties = {
  background: '#f5f5f5',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 12,
  fontFamily: 'monospace',
}

const SPECIAL_KEYS: Record<string, string> = {
  arrowdown: '↓', arrowup: '↑', arrowleft: '←', arrowright: '→',
  enter: 'Enter', escape: 'Esc',
}

function formatKeyForDisplay(key: string): string {
  return key
    .split('+')
    .map((part) => {
      const trimmed = part.trim().toLowerCase()
      return SPECIAL_KEYS[trimmed] ?? (trimmed.charAt(0).toUpperCase() + trimmed.slice(1))
    })
    .join(' + ')
}

function groupByGroupName(hotkeys: HotkeyDefinition[]): Map<string, HotkeyDefinition[]> {
  const grouped = new Map<string, HotkeyDefinition[]>()
  for (const hotkey of hotkeys) {
    const existing = grouped.get(hotkey.group)
    if (existing) {
      existing.push(hotkey)
    } else {
      grouped.set(hotkey.group, [hotkey])
    }
  }
  return grouped
}

function sortGroupNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    if (a === GLOBAL_GROUP) return b === GLOBAL_GROUP ? 0 : -1
    if (b === GLOBAL_GROUP) return 1
    return a.localeCompare(b, 'vi')
  })
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const { getHotkeys } = useHotkeyRegistry()

  // Recompute only while the modal is open so the registry is read at display time.
  const groups = useMemo(() => {
    if (!open) return []
    const grouped = groupByGroupName(getHotkeys())
    return sortGroupNames(Array.from(grouped.keys())).map((name) => ({
      name,
      items: grouped.get(name) ?? [],
    }))
  }, [open, getHotkeys])

  return (
    <Modal title="Phím tắt bàn phím" open={open} onCancel={onClose} footer={null} width={480}>
      {groups.length === 0 ? (
        <div style={{ color: '#999', padding: '8px 0' }}>Chưa có phím tắt nào được đăng ký.</div>
      ) : (
        groups.map((group) => (
          <div key={group.name} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{group.name}</div>
            {group.items.map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                }}
              >
                <span>{item.description}</span>
                <kbd style={kbdStyle}>{formatKeyForDisplay(item.key)}</kbd>
              </div>
            ))}
          </div>
        ))
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
        Nhấn ? để mở / Esc để đóng
      </div>
    </Modal>
  )
}
