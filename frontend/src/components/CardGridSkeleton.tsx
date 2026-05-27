import { Card, Col, Row, Skeleton } from 'antd'

interface CardGridSkeletonProps {
  cards?: number
  cols?: number
  showChart?: boolean
}

/**
 * Skeleton loader cho Dashboard và trang báo cáo tổng quan.
 * Giả lập lưới metric cards + một khối chart lớn bên dưới.
 */
export function CardGridSkeleton({
  cards = 4,
  cols = 4,
  showChart = true,
}: CardGridSkeletonProps) {
  const span = Math.floor(24 / cols)

  return (
    <div>
      {/* Metric cards row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {Array.from({ length: cards }, (_, i) => (
          <Col key={i} xs={24} sm={12} md={span}>
            <Card size="small">
              <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Chart block */}
      {showChart && (
        <Card>
          <Skeleton.Input active style={{ width: 180, marginBottom: 16, display: 'block' }} />
          <Skeleton.Node
            active
            style={{ width: '100%', height: 280, borderRadius: 6 }}
          >
            <span />
          </Skeleton.Node>
        </Card>
      )}
    </div>
  )
}
