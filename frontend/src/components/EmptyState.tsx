/**
 * EmptyState — Component hiển thị trạng thái rỗng cho toàn bộ ERP Nam Phương
 *
 * Dùng khi:
 *   - Bảng / danh sách không có dữ liệu (data.length === 0)
 *   - Kết quả tìm kiếm rỗng
 *   - Màn hình chưa được cấu hình
 *
 * Sử dụng:
 *   <EmptyState />                                    // mặc định
 *   <EmptyState title="Chưa có đơn hàng" description="Nhấn tạo mới để bắt đầu" />
 *   <EmptyState preset="search" />                    // kết quả tìm kiếm rỗng
 *   <EmptyState preset="filter" />                    // bộ lọc không khớp
 *   <EmptyState preset="error" />                     // lỗi tải dữ liệu
 *   <EmptyState action={{ label: 'Tạo mới', onClick: () => {} }} />
 *   <EmptyState action={{ label: 'Tạo đơn', icon: <PlusOutlined />, onClick: fn }} />
 *   <EmptyState size="small" />                       // dùng trong card nhỏ
 */

import React from 'react'
import { Button, Typography } from 'antd'
import {
  InboxOutlined,
  SearchOutlined,
  FilterOutlined,
  WarningOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  BarChartOutlined,
  PlusOutlined,
} from '@ant-design/icons'

const { Text } = Typography

// ── Preset configs ────────────────────────────────────────────────────────────

type Preset =
  | 'default'   // danh sách trống
  | 'search'    // tìm kiếm không có kết quả
  | 'filter'    // bộ lọc không khớp
  | 'error'     // lỗi tải dữ liệu
  | 'order'     // không có đơn hàng
  | 'customer'  // không có khách hàng
  | 'report'    // chưa có báo cáo
  | 'document'  // chưa có tài liệu / phiếu

interface PresetConfig {
  icon: React.ReactNode
  title: string
  description: string
}

const PRESETS: Record<Preset, PresetConfig> = {
  default: {
    icon: <InboxOutlined />,
    title: 'Chưa có dữ liệu',
    description: 'Danh sách hiện đang trống.',
  },
  search: {
    icon: <SearchOutlined />,
    title: 'Không tìm thấy kết quả',
    description: 'Thử thay đổi từ khóa hoặc xóa bộ lọc.',
  },
  filter: {
    icon: <FilterOutlined />,
    title: 'Không có dữ liệu phù hợp',
    description: 'Điều chỉnh bộ lọc để xem thêm kết quả.',
  },
  error: {
    icon: <WarningOutlined />,
    title: 'Không thể tải dữ liệu',
    description: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
  },
  order: {
    icon: <ShoppingCartOutlined />,
    title: 'Chưa có đơn hàng',
    description: 'Tạo đơn hàng đầu tiên để bắt đầu.',
  },
  customer: {
    icon: <TeamOutlined />,
    title: 'Chưa có khách hàng',
    description: 'Thêm khách hàng để quản lý thông tin.',
  },
  report: {
    icon: <BarChartOutlined />,
    title: 'Chưa có dữ liệu báo cáo',
    description: 'Chọn khoảng thời gian hoặc bộ lọc khác.',
  },
  document: {
    icon: <FileTextOutlined />,
    title: 'Chưa có phiếu / tài liệu',
    description: 'Tạo mới để bắt đầu theo dõi.',
  },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EmptyStateAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  type?: 'primary' | 'default' | 'dashed'
  danger?: boolean
}

interface EmptyStateProps {
  /** Preset xác định icon + title + description mặc định */
  preset?: Preset
  /** Override title (ưu tiên hơn preset) */
  title?: string
  /** Override description (ưu tiên hơn preset) */
  description?: string
  /** Override icon (ưu tiên hơn preset) */
  icon?: React.ReactNode
  /** Nút hành động tùy chọn */
  action?: EmptyStateAction
  /** Kích thước: 'default' (cho trang đầy) | 'small' (cho card/panel) */
  size?: 'default' | 'small'
  /** className bổ sung cho wrapper */
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

const EmptyState: React.FC<EmptyStateProps> = ({
  preset = 'default',
  title,
  description,
  icon,
  action,
  size = 'default',
  className = '',
}) => {
  const config = PRESETS[preset]

  const resolvedIcon  = icon        ?? config.icon
  const resolvedTitle = title       ?? config.title
  const resolvedDesc  = description ?? config.description

  const isSmall = size === 'small'

  return (
    <div
      className={className}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        isSmall ? '24px 16px' : '48px 24px',
        textAlign:      'center',
        width:          '100%',
      }}
    >
      {/* Icon */}
      <div
        style={{
          fontSize:    isSmall ? 36 : 52,
          color:       '#bfbfbf',
          lineHeight:  1,
          marginBottom: isSmall ? 10 : 16,
        }}
      >
        {resolvedIcon}
      </div>

      {/* Title */}
      <Text
        strong
        style={{
          fontSize:     isSmall ? 14 : 16,
          color:        '#595959',
          marginBottom: 6,
          display:      'block',
        }}
      >
        {resolvedTitle}
      </Text>

      {/* Description */}
      {resolvedDesc && (
        <Text
          style={{
            fontSize:     isSmall ? 12 : 13,
            color:        '#8c8c8c',
            marginBottom: action ? (isSmall ? 14 : 20) : 0,
            display:      'block',
            maxWidth:     320,
            lineHeight:   1.6,
          }}
        >
          {resolvedDesc}
        </Text>
      )}

      {/* Action button */}
      {action && (
        <Button
          type={action.type ?? 'primary'}
          icon={action.icon ?? <PlusOutlined />}
          onClick={action.onClick}
          danger={action.danger}
          size={isSmall ? 'small' : 'middle'}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

export default EmptyState

// ── HOC helper: bọc Table locale ─────────────────────────────────────────────
// Dùng trực tiếp làm locale.emptyText cho Ant Design Table:
//
//   <Table
//     locale={{ emptyText: <EmptyState preset="search" size="small" /> }}
//     ...
//   />

// ── Wrapper helper: kiểm tra data.length trước khi render ────────────────────
// Dùng khi muốn hiện EmptyState thay cho toàn bộ vùng nội dung:
//
//   import { withEmptyState } from '../components/EmptyState'
//
//   const list = withEmptyState(data, <EmptyState preset="order" action={{...}} />)
//   // list === null nếu data.length === 0 → render EmptyState thay thế

export function withEmptyState<T>(
  data: T[] | undefined | null,
  emptyNode: React.ReactNode,
): T[] | null {
  if (!data || data.length === 0) return null
  return data
}
