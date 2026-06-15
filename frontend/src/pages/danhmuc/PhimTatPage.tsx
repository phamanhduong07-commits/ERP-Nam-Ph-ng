import { Typography } from 'antd'
import { ALL_HOTKEYS } from '../../config/hotkeys'

const { Title } = Typography

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

function formatKey(key: string): string {
  return key
    .split('+')
    .map(p => SPECIAL_KEYS[p.toLowerCase()] ?? (p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' + ')
}

const GLOBAL_GROUP = 'Toàn cục'

export default function PhimTatPage() {
  const grouped = ALL_HOTKEYS.reduce((acc, h) => {
    acc[h.group] = [...(acc[h.group] ?? []), h]
    return acc
  }, {} as Record<string, typeof ALL_HOTKEYS>)

  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    if (a === GLOBAL_GROUP) return -1
    if (b === GLOBAL_GROUP) return 1
    return a.localeCompare(b, 'vi')
  })

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <Title level={4} style={{ marginBottom: 4 }}>Phím tắt bàn phím</Title>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
        Danh sách đầy đủ các phím tắt trong hệ thống ERP Nam Phương.
      </p>

      {sortedGroups.map(group => (
        <div key={group} style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            {group}
          </div>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
            {grouped[group].map((h, i) => (
              <div
                key={h.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderBottom: i < grouped[group].length - 1 ? '1px solid #f5f5f5' : 'none',
                }}
              >
                <span style={{ fontSize: 13 }}>{h.description}</span>
                <kbd style={kbdStyle}>{formatKey(h.key)}</kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
