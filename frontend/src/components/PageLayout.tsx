import type { ReactNode, CSSProperties } from 'react'
import { Breadcrumb } from 'antd'
import type { BreadcrumbProps } from 'antd'

interface PageLayoutProps {
  title: ReactNode
  breadcrumb?: BreadcrumbProps['items']
  actions?: ReactNode
  children: ReactNode
  contentStyle?: CSSProperties
  noPadding?: boolean
}

/**
 * Standard page wrapper: sticky header (title + breadcrumb + actions) + scrollable content.
 * Uses .page-header / .page-header-title CSS classes from index.css.
 */
export default function PageLayout({
  title,
  breadcrumb,
  actions,
  children,
  contentStyle,
  noPadding = false,
}: PageLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="page-header">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <Breadcrumb items={breadcrumb} style={{ marginBottom: 2, fontSize: 12 }} />
          )}
          <h1 className="page-header-title">{title}</h1>
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: noPadding ? 0 : '20px 24px',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  )
}
