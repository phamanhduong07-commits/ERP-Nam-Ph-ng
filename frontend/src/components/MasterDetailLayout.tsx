import { type ReactNode } from 'react'
import { Empty, Typography } from 'antd'
import { SelectOutlined } from '@ant-design/icons'

const { Text } = Typography

interface Props {
  master: ReactNode
  detail: ReactNode | null
  emptyText?: string
}

export default function MasterDetailLayout({ master, detail, emptyText = 'Chọn một mục để xem chi tiết' }: Props) {
  return (
    <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 130px)', minHeight: 500 }}>
      {/* Master panel */}
      <div style={{
        width: 420,
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {master}
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: '#f0f0f0', flexShrink: 0 }} />

      {/* Detail panel */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {detail ?? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            color: '#bfbfbf',
          }}>
            <SelectOutlined style={{ fontSize: 48 }} />
            <Text type="secondary">{emptyText}</Text>
          </div>
        )}
      </div>
    </div>
  )
}
