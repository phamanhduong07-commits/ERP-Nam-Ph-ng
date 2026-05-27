import { Card, Col, Row, Skeleton } from 'antd'

interface FormSkeletonProps {
  fields?: number
  cols?: number
  showActions?: boolean
  showTitle?: boolean
}

/**
 * Skeleton loader cho trang chi tiết / form nhập liệu.
 * Giả lập label + input theo dạng lưới cột.
 */
export function FormSkeleton({
  fields = 8,
  cols = 2,
  showActions = true,
  showTitle = true,
}: FormSkeletonProps) {
  const span = Math.floor(24 / cols)
  const rows = Math.ceil(fields / cols)

  return (
    <Card>
      {showTitle && (
        <Skeleton.Input active style={{ width: 240, marginBottom: 24, display: 'block' }} />
      )}

      <Row gutter={[16, 20]}>
        {Array.from({ length: rows * cols }, (_, i) => (
          <Col key={i} xs={24} md={span}>
            {/* Label */}
            <Skeleton.Input
              active
              size="small"
              style={{ width: 80 + ((i * 17) % 50), height: 12, marginBottom: 6, display: 'block' }}
            />
            {/* Input */}
            <Skeleton.Input active style={{ width: '100%', height: 32 }} />
          </Col>
        ))}
      </Row>

      {showActions && (
        <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
          <Skeleton.Button active style={{ width: 90 }} />
          <Skeleton.Button active style={{ width: 70 }} />
        </div>
      )}
    </Card>
  )
}
