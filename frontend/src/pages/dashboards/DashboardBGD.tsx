import React from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Card, Col, Empty, List, Progress,
  Row, Space, Tag, Typography,
} from 'antd'
import {
  AlertOutlined, ArrowRightOutlined, AreaChartOutlined, AuditOutlined,
  BuildOutlined, DatabaseOutlined, DollarOutlined, ExclamationCircleOutlined,
  InboxOutlined, RobotOutlined, ShoppingCartOutlined, ToolOutlined,
  TruckOutlined, WalletOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import {
  DashboardHeader, DashboardStats, KPICard, QuickLink,
  dashboardPageStyle, hoverCardCss, sharedCardStyle, usePrefetchPages,
} from './_shared'

const { Title, Text } = Typography

interface Props {
  stats: DashboardStats
  userName: string
}

export default function DashboardBGD({ stats, userName }: Props) {
  usePrefetchPages(['sales', 'production', 'warehouse', 'accounting'])
  const sales = stats.sales
  const prod = stats.production
  const wh = stats.warehouse
  const acc = stats.accounting
  const kpi = stats.kpi

  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader
        userName={userName}
        actions={
          <Space size={12}>
            <Button icon={<RobotOutlined />} size="large" style={{ borderRadius: 10 }}>Hỏi AI</Button>
            <Link to="/sales/orders/new">
              <Button type="primary" size="large" icon={<ShoppingCartOutlined />} style={{ borderRadius: 10, background: '#1b168e', border: 'none' }}>
                Tạo đơn mới
              </Button>
            </Link>
          </Space>
        }
      />

      {/* KPI hàng đầu */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Doanh thu tháng này"
            value={sales?.doanh_thu_thang || 0}
            suffix="VND"
            icon={<DollarOutlined />}
            gradient="linear-gradient(135deg, #1b168e 0%, #3a32cc 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Giá trị kho hàng"
            value={wh?.tong_gia_tri_ton || 0}
            suffix="VND"
            icon={<WalletOutlined />}
            color="#722ed1"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Đang sản xuất"
            value={prod?.dang_san_xuat || 0}
            suffix="LSX"
            icon={<ToolOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Công nợ quá hạn"
            value={acc?.ar_tien_qua_han || 0}
            suffix="VND"
            icon={<AlertOutlined />}
            color="#f5222d"
          />
        </Col>
      </Row>

      {/* KPI vận hành */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={12} lg={6}>
          <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ color: '#8c8c8c', fontSize: 13 }}>Backlog Sản xuất</Text>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <Title level={3} style={{ margin: 0, color: (kpi?.backlog_lsx ?? 0) > 50 ? '#cf1322' : '#1b168e', fontWeight: 800 }}>
                    {(kpi?.backlog_lsx ?? 0).toLocaleString()}
                  </Title>
                  <Text style={{ color: '#8c8c8c', fontSize: 12 }}>lệnh</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{(kpi?.backlog_so_luong ?? 0).toLocaleString()} thùng tồn đọng</Text>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fa8c1615', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fa8c16', fontSize: 20 }}>
                <BuildOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ color: '#8c8c8c', fontSize: 13 }}>Tồn kho phôi</Text>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <Title level={3} style={{ margin: 0, color: '#1b168e', fontWeight: 800 }}>
                    {(kpi?.ton_kho_phoi_kg ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Title>
                  <Text style={{ color: '#8c8c8c', fontSize: 12 }}>kg</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>Toàn bộ kho PHOI</Text>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#13c2c215', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#13c2c2', fontSize: 20 }}>
                <DatabaseOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ color: '#8c8c8c', fontSize: 13 }}>Tồn kho thành phẩm</Text>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <Title level={3} style={{ margin: 0, color: '#1b168e', fontWeight: 800 }}>
                    {(kpi?.ton_kho_tp_sl ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Title>
                  <Text style={{ color: '#8c8c8c', fontSize: 12 }}>thùng</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>Toàn bộ kho THANH_PHAM</Text>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#52c41a15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52c41a', fontSize: 20 }}>
                <InboxOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ color: '#8c8c8c', fontSize: 13 }}>Công nợ quá hạn</Text>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <Title level={3} style={{ margin: 0, color: (kpi?.cong_no_qua_han_tien ?? 0) > 0 ? '#cf1322' : '#3f8600', fontWeight: 800 }}>
                    {((kpi?.cong_no_qua_han_tien ?? 0) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </Title>
                  <Text style={{ color: '#8c8c8c', fontSize: 12 }}>triệu VND</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{kpi?.cong_no_qua_han_so_hd ?? 0} hóa đơn quá hạn</Text>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f5222d15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5222d', fontSize: 20 }}>
                <ExclamationCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={16}>
          <Card variant="borderless" style={{ ...sharedCardStyle, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Title level={4} style={{ margin: 0 }}>Vận hành Sản xuất</Title>
              <Link to="/production/plans"><Button type="link">Xem kế hoạch <ArrowRightOutlined /></Button></Link>
            </div>
            <Row gutter={32}>
              <Col span={12}>
                <div style={{ padding: 20, background: '#f0f2f5', borderRadius: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>Lệnh mới cần chạy</Text>
                      <Tag color="blue">{prod?.lenh_sx_moi || 0}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>Lệnh đang chạy</Text>
                      <Tag color="processing">{prod?.dang_san_xuat || 0}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>Lệnh trễ hạn</Text>
                      <Tag color="error">{prod?.lenh_sx_tre || 0}</Tag>
                    </div>
                  </Space>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Progress
                    type="dashboard"
                    percent={Math.round(((prod?.lenh_sx_hoan_thanh_hom_nay || 0) / Math.max(1, (prod?.lenh_sx_moi || 0) + (prod?.dang_san_xuat || 0))) * 100)}
                    strokeColor="#1b168e"
                    size={120}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Text strong style={{ fontSize: 16 }}>{prod?.lenh_sx_hoan_thanh_hom_nay || 0} Lệnh hoàn thành</Text>
                    <br />
                    <Text type="secondary">Trong ngày hôm nay</Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          <Row gutter={24}>
            <Col span={12}>
              <Card title="Kho & Giao nhận" variant="borderless" style={{ ...sharedCardStyle, height: '100%' }}>
                <List size="small">
                  <List.Item extra={<Text strong>{wh?.phieu_nhap_hom_nay || 0}</Text>}>Nhập kho nguyên liệu</List.Item>
                  <List.Item extra={<Text strong>{wh?.phieu_xuat_nvl_hom_nay || 0}</Text>}>Xuất NVL sản xuất</List.Item>
                  <List.Item extra={<Text strong>{wh?.phieu_giao_hom_nay || 0}</Text>}>Giao thành phẩm</List.Item>
                  <List.Item extra={<Text strong style={{ color: '#f5222d' }}>{wh?.giao_hang_cho_xuat || 0}</Text>}>Chờ xuất kho giao</List.Item>
                </List>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Phê duyệt & Tài chính" variant="borderless" style={{ ...sharedCardStyle, height: '100%' }}>
                <List size="small">
                  <List.Item extra={<Tag color="orange">{sales?.don_hang_cho_duyet || 0}</Tag>}>Đơn hàng chờ duyệt</List.Item>
                  <List.Item extra={<Tag color="orange">{stats.purchase?.po_cho_duyet || 0}</Tag>}>Đơn mua (PO) chờ duyệt</List.Item>
                  <List.Item extra={<Tag color="cyan">{acc?.phieu_thu_cho_duyet || 0}</Tag>}>Phiếu thu chờ duyệt</List.Item>
                  <List.Item extra={<Tag color="magenta">{acc?.phieu_chi_cho_duyet || 0}</Tag>}>Phiếu chi chờ duyệt</List.Item>
                </List>
              </Card>
            </Col>
          </Row>
        </Col>

        <Col span={8}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /> Lối tắt nghiệp vụ</Space>}
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
          >
            <Row gutter={[12, 12]}>
              <Col span={8}><QuickLink label="LSX" path="/production/orders" icon={<ToolOutlined />} color="#1890ff" /></Col>
              <Col span={8}><QuickLink label="Tồn kho" path="/warehouse/inventory" icon={<InboxOutlined />} color="#52c41a" /></Col>
              <Col span={8}><QuickLink label="Giao hàng" path="/sales/giao-hang" icon={<TruckOutlined />} color="#722ed1" /></Col>
              <Col span={8}><QuickLink label="Giá thành" path="/reports/hub" icon={<AreaChartOutlined />} color="#eb2f96" /></Col>
              <Col span={8}><QuickLink label="Công nợ" path="/reports/debt-summary" icon={<AuditOutlined />} color="#2f54eb" /></Col>
              <Col span={8}><QuickLink label="Báo giá" path="/quotes" icon={<DollarOutlined />} color="#faad14" /></Col>
            </Row>
          </Card>

          <Card
            title={<Space><AlertOutlined style={{ color: '#f5222d' }} /> Cảnh báo tồn kho</Space>}
            variant="borderless"
            style={sharedCardStyle}
            extra={<Link to="/warehouse/inventory">Xem hết</Link>}
          >
            {wh?.ton_thap && wh.ton_thap.length > 0 ? (
              <List
                size="small"
                dataSource={wh.ton_thap.slice(0, 5)}
                renderItem={item => (
                  <List.Item style={{ padding: '12px 0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 13 }}>{item.ten_hang}</Text>
                        <Text type="danger" strong>{item.ton_luong} {item.don_vi}</Text>
                      </div>
                      <Progress
                        percent={Math.round((item.ton_luong / item.ton_toi_thieu) * 100)}
                        size="small"
                        status="exception"
                        showInfo={false}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>Tối thiểu: {item.ton_toi_thieu} {item.don_vi}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Mọi thứ đều ổn định" />
            )}
          </Card>
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
