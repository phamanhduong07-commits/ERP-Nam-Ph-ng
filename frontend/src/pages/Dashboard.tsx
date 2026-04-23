import { Card, Col, Row, Statistic, Typography, Space } from 'antd'
import {
  ShoppingCartOutlined, ClockCircleOutlined,
  CheckCircleOutlined, TeamOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../store/auth'

const { Title, Text } = Typography

export default function Dashboard() {
  const { user } = useAuthStore()
  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div>
      <Space direction="vertical" style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Xin chào, {user?.ho_ten} 👋
        </Title>
        <Text type="secondary">{today}</Text>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Đơn hàng mới hôm nay"
              value={0}
              prefix={<ShoppingCartOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Đang chờ duyệt"
              value={0}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Đang sản xuất"
              value={0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Khách hàng"
              value={763}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Hướng dẫn nhanh">
            <Row gutter={16}>
              {[
                { title: '1. Nhận đơn hàng', desc: 'Bán hàng → Đơn hàng → Tạo mới', path: '/sales/orders' },
                { title: '2. Duyệt đơn', desc: 'Chọn đơn → Duyệt → Chuyển SX', path: '/sales/orders' },
                { title: '3. Lệnh SX', desc: 'Sản xuất → Lệnh SX → Tạo từ đơn', path: '/production/orders' },
                { title: '4. Xuất kho', desc: 'Kho → Xuất kho → Giao hàng', path: '/warehouse/issues' },
              ].map((item) => (
                <Col xs={24} sm={12} lg={6} key={item.title}>
                  <Card size="small" type="inner" title={item.title}>
                    <Text type="secondary">{item.desc}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
