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
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

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

const ReportingHubPage: React.FC = () => {
  return (
    <div style={{ padding: '24px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2}>Trung tâm Báo cáo Nam Phương ERP</Title>
        <Text type="secondary">Hệ thống báo cáo tổng hợp, phân tích dữ liệu kinh doanh và sản xuất theo thời gian thực.</Text>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Báo cáo Quản trị & Sản xuất</Title>
          <Divider style={{ flex: 1, margin: '0 16px' }} />
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Giá thành Sản xuất" 
              description="Phân tích chi tiết giá thành thực tế từng LSX so với định mức."
              icon={<AreaChartOutlined />}
              path="/accounting/reports/production-costing"
              color="#1890ff"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Lãi lỗ Phân xưởng" 
              description="Theo dõi hiệu quả kinh doanh của từng phân xưởng sản xuất."
              icon={<PieChartOutlined />}
              path="/accounting/reports/workshop-pnl"
              color="#722ed1"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Hiệu suất Sản xuất" 
              description="Báo cáo tiến độ, tỷ lệ lỗi và năng suất lao động."
              icon={<LineChartOutlined />}
              path="/reports/production-performance"
              color="#52c41a"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Doanh thu & Lợi nhuận" 
              description="Phân tích doanh thu theo khách hàng, khu vực và dòng hàng."
              icon={<DollarOutlined />}
              path="/reports/revenue"
              color="#faad14"
            />
          </Col>
        </Row>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>Báo cáo Tài chính & Thuế</Title>
          <Divider style={{ flex: 1, margin: '0 16px' }} />
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Cân đối phát sinh" 
              description="Bảng cân đối tài khoản kế toán tổng hợp toàn hệ thống."
              icon={<AuditOutlined />}
              path="/accounting/trial-balance"
              color="#13c2c2"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Bảng CĐPS (Thuế)" 
              description="Dữ liệu kế toán phục vụ quyết toán thuế và BCTC."
              icon={<SafetyCertificateOutlined />}
              path="/reports/tax-trial-balance"
              color="#f5222d"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Báo cáo Thuế GTGT" 
              description="Tờ khai thuế GTGT và danh sách hóa đơn đầu ra/đầu vào."
              icon={<ContainerOutlined />}
              path="/reports/vat-summary"
              color="#eb2f96"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ReportCard 
              title="Công nợ Tổng hợp" 
              description="Theo dõi dòng tiền và tuổi nợ của khách hàng/nhà cung cấp."
              icon={<StockOutlined />}
              path="/reports/debt-summary"
              color="#2f54eb"
            />
          </Col>
        </Row>
      </div>
      
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
