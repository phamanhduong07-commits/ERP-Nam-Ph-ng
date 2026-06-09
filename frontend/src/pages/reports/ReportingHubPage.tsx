import React from 'react'
import { Row, Col, Card, Typography, Space, Divider } from 'antd'
import {
  LineChartOutlined,
  PieChartOutlined,
  AuditOutlined,
  ContainerOutlined,
  DollarOutlined,
  StockOutlined,
  AreaChartOutlined,
  SafetyCertificateOutlined,
  InboxOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

const { Title, Text, Paragraph } = Typography

interface ReportCardProps {
  title: string
  description: string
  icon: React.ReactNode
  path: string
  color: string
}

const ReportCard: React.FC<ReportCardProps> = ({ title, description, icon, path, color }) => {
  const navigate = useNavigate()

  return (
    <Card
      hoverable
      className="reporting-card"
      style={{
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        border: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        background: '#ffffff'
      }}
      onClick={() => navigate(path)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: color,
          fontSize: 24
        }}>
          {icon}
        </div>
        <Title level={5} style={{ marginBottom: 8 }}>{title}</Title>
        <Paragraph type="secondary" style={{ fontSize: 13, flex: 1 }}>{description}</Paragraph>
      </div>
    </Card>
  )
}

interface ReportEntry extends ReportCardProps {
  permissions?: string[]
}

const ReportingHubPage: React.FC = () => {
  const user = useAuthStore(state => state.user)
  const role = user?.role ?? ''
  const userPerms: string[] = user?.permissions ?? []

  function canSee(perms?: string[]): boolean {
    if (role === 'ADMIN' || !perms || perms.length === 0) return true
    return perms.some(p => userPerms.includes(p))
  }

  const mgmtCards: ReportEntry[] = [
    {
      title: 'Giá thành Sản xuất',
      description: 'Phân tích chi tiết giá thành thực tế từng LSX so với định mức.',
      icon: <AreaChartOutlined />,
      path: '/accounting/reports/production-costing',
      color: '#1890ff',
      permissions: ['report.export'],
    },
    {
      title: 'Lãi lỗ Phân xưởng',
      description: 'Theo dõi hiệu quả kinh doanh của từng phân xưởng sản xuất.',
      icon: <PieChartOutlined />,
      path: '/accounting/reports/workshop-pnl',
      color: '#722ed1',
      permissions: ['report.export'],
    },
    {
      title: 'Hiệu suất Sản xuất',
      description: 'Báo cáo tiến độ, tỷ lệ lỗi và năng suất lao động.',
      icon: <LineChartOutlined />,
      path: '/reports/production-performance',
      color: '#52c41a',
      permissions: ['report.view'],
    },
    {
      title: 'Doanh thu & Lợi nhuận',
      description: 'Phân tích doanh thu theo khách hàng, khu vực và dòng hàng.',
      icon: <DollarOutlined />,
      path: '/reports/revenue',
      color: '#faad14',
      permissions: ['report.export'],
    },
  ]

  const financialCards: ReportEntry[] = [
    {
      title: 'Cân đối phát sinh',
      description: 'Bảng cân đối tài khoản kế toán tổng hợp toàn hệ thống.',
      icon: <AuditOutlined />,
      path: '/accounting/trial-balance',
      color: '#13c2c2',
      permissions: ['accounting.view'],
    },
    {
      title: 'Bảng CĐPS (Thuế)',
      description: 'Dữ liệu kế toán phục vụ quyết toán thuế và BCTC.',
      icon: <SafetyCertificateOutlined />,
      path: '/reports/tax-trial-balance',
      color: '#f5222d',
      permissions: ['accounting.view'],
    },
    {
      title: 'Báo cáo Thuế GTGT',
      description: 'Tờ khai thuế GTGT và danh sách hóa đơn đầu ra/đầu vào.',
      icon: <ContainerOutlined />,
      path: '/reports/vat-summary',
      color: '#eb2f96',
      permissions: ['accounting.view'],
    },
  ]

  const warehouseCards: ReportEntry[] = [
    {
      title: 'Nhập-Xuất-Tồn kho',
      description: 'Báo cáo chi tiết nhập xuất tồn theo từng kho, nguyên liệu.',
      icon: <InboxOutlined />,
      path: '/reports/inventory',
      color: '#1890ff',
      permissions: ['report.inventory'],
    },
    {
      title: 'Tồn phôi & Thành phẩm',
      description: 'Tổng hợp tồn kho phôi sóng và thành phẩm theo phân xưởng.',
      icon: <DatabaseOutlined />,
      path: '/reports/phoi-thanh-pham',
      color: '#52c41a',
      permissions: ['report.phoi_thanh_pham'],
    },
    {
      title: 'Công nợ Tổng hợp',
      description: 'Theo dõi dòng tiền và tuổi nợ của khách hàng/nhà cung cấp.',
      icon: <StockOutlined />,
      path: '/reports/debt-summary',
      color: '#2f54eb',
      permissions: ['report.cong_no'],
    },
  ]

  const visibleMgmt = mgmtCards.filter(c => canSee(c.permissions))
  const visibleFinancial = financialCards.filter(c => canSee(c.permissions))
  const visibleWarehouse = warehouseCards.filter(c => canSee(c.permissions))

  return (
    <div style={{ padding: '24px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2}>Trung tâm Báo cáo Nam Phương ERP</Title>
        <Text type="secondary">Hệ thống báo cáo tổng hợp, phân tích dữ liệu kinh doanh và sản xuất theo thời gian thực.</Text>
      </div>

      {visibleMgmt.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Báo cáo Quản trị & Sản xuất</Title>
            <Divider style={{ flex: 1, margin: '0 16px' }} />
          </div>
          <Row gutter={[24, 24]}>
            {visibleMgmt.map(card => (
              <Col key={card.path} xs={24} sm={12} md={8} lg={6}>
                <ReportCard title={card.title} description={card.description} icon={card.icon} path={card.path} color={card.color} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {visibleFinancial.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Báo cáo Tài chính & Thuế</Title>
            <Divider style={{ flex: 1, margin: '0 16px' }} />
          </div>
          <Row gutter={[24, 24]}>
            {visibleFinancial.map(card => (
              <Col key={card.path} xs={24} sm={12} md={8} lg={6}>
                <ReportCard title={card.title} description={card.description} icon={card.icon} path={card.path} color={card.color} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {visibleWarehouse.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Kho & Công nợ</Title>
            <Divider style={{ flex: 1, margin: '0 16px' }} />
          </div>
          <Row gutter={[24, 24]}>
            {visibleWarehouse.map(card => (
              <Col key={card.path} xs={24} sm={12} md={8} lg={6}>
                <ReportCard title={card.title} description={card.description} icon={card.icon} path={card.path} color={card.color} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      <style>{`
        .reporting-card {
          transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
        }
        .reporting-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 30px rgba(27, 22, 142, 0.12) !important;
        }
      `}</style>
    </div>
  )
}

export default ReportingHubPage
