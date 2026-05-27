import { Skeleton, Space, Table } from 'antd'

interface TableSkeletonProps {
  columns?: number
  rows?: number
  showFilters?: boolean
  showTitle?: boolean
}

/**
 * Skeleton loader cho trang danh sách/bảng.
 * Layout ổn định (không CLS) — kích thước khớp với table thật.
 */
export function TableSkeleton({
  columns = 6,
  rows = 8,
  showFilters = true,
  showTitle = false,
}: TableSkeletonProps) {
  const skeletonCols = Array.from({ length: columns }, (_, i) => ({
    key: i,
    dataIndex: i,
    title: (
      <Skeleton.Input
        active
        size="small"
        style={{ width: 40 + ((i * 23) % 60), height: 14 }}
      />
    ),
    render: () => (
      <Skeleton.Input
        active
        size="small"
        style={{ width: '100%', minWidth: 40, height: 14 }}
      />
    ),
  }))

  const skeletonData = Array.from({ length: rows }, (_, i) => ({ key: i }))

  return (
    <div>
      {showTitle && (
        <Skeleton.Input active style={{ width: 200, marginBottom: 16, display: 'block' }} />
      )}
      {showFilters && (
        <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <Skeleton.Input active style={{ width: 220 }} />
          <Skeleton.Input active style={{ width: 130 }} />
          <Skeleton.Input active style={{ width: 130 }} />
          <Skeleton.Button active style={{ width: 80 }} />
        </Space>
      )}
      <Table
        columns={skeletonCols}
        dataSource={skeletonData}
        pagination={false}
        rowKey="key"
        size="small"
      />
    </div>
  )
}
