import React from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, Col, Row, Space, Typography } from 'antd'
import {
  AlertOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import {
  DashboardHeader, DashboardStats, KPICard, QuickLink,
  dashboardPageStyle, hoverCardCss, sharedCardStyle, usePrefetchPages,
} from './_shared'

const { Text } = Typography
const ACCENT = '#00695c'

interface Props {
  stats: DashboardStats
  userName: string
}

export default function DashboardPurchase({ stats, userName }: Props) {
  usePrefetchPages([])
  const pur = stats.purchase

  const poChoDuyet = pur?.po_cho_duyet ?? 0
  const poDangVe   = pur?.po_dang_ve   ?? 0
  const grChoDuyet = pur?.gr_cho_duyet ?? 0
  const grHomNay   = pur?.gr_hom_nay   ?? 0
  const hdQuaHan   = pur?.hd_qua_han   ?? 0

  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader userName={userName} subtitle="Tình hình mua hàng hôm nay" />

      {/* Cảnh báo */}
      {(poChoDuyet > 0 || grChoDuyet > 0 || hdQuaHan > 0) && (
        <Row gutter={[10, 10]} style={{ marginBottom: 20 }}>
          {poChoDuyet > 0 && (
            <Col xs={24} sm={8}>
              <Alert
                type="warning" showIcon icon={<ClockCircleOutlined />}
                message={<span><strong>{poChoDuyet}</strong> đơn mua hàng chờ duyệt</span>}
                style={{ padding: '6px 12px' }}
              />
            </Col>
          )}
          {grChoDuyet > 0 && (
            <Col xs={24} sm={8}>
              <Alert
                type="info" showIcon icon={<DownloadOutlined />}
                message={<span><strong>{grChoDuyet}</strong> phiếu nhập kho chờ duyệt</span>}
                style={{ padding: '6px 12px' }}
              />
            </Col>
          )}
          {hdQuaHan > 0 && (
            <Col xs={24} sm={8}>
              <Alert
                type="error" showIcon icon={<DollarOutlined />}
                message={<span><strong>{hdQuaHan}</strong> hóa đơn quá hạn thanh toán</span>}
                style={{ padding: '6px 12px' }}
              />
            </Col>
          )}
        </Row>
      )}

      {/* KPI */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="PO chờ duyệt"
            value={poChoDuyet}
            suffix="đơn"
            icon={<AuditOutlined />}
            gradient={poChoDuyet > 0 ? 'linear-gradient(135deg, #e65100 0%, #ff8f00 100%)' : undefined}
            color={ACCENT}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="PO đang về"
            value={poDangVe}
            suffix="đơn"
            icon={<TruckOutlined />}
            color="#1677ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Nhập kho hôm nay"
            value={grHomNay}
            suffix="phiếu"
            icon={<DownloadOutlined />}
            gradient={grHomNay > 0 ? `linear-gradient(135deg, ${ACCENT} 0%, #26a69a 100%)` : undefined}
            color={ACCENT}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="GR chờ duyệt"
            value={grChoDuyet}
            suffix="phiếu"
            icon={<CheckCircleOutlined />}
            color={grChoDuyet > 0 ? '#fa8c16' : '#52c41a'}
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={14}>
          {/* Hoạt động hôm nay */}
          <Card
            title={<Space><DownloadOutlined style={{ color: ACCENT }} />Hoạt động mua hàng hôm nay</Space>}
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#e8f5e9', borderRadius: 10 }}>
                <Space><AuditOutlined style={{ color: '#e65100' }} /><Text>Đơn mua hàng chờ duyệt</Text></Space>
                <Text strong style={{ color: poChoDuyet > 0 ? '#e65100' : '#52c41a', fontSize: 16 }}>{poChoDuyet}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#e3f2fd', borderRadius: 10 }}>
                <Space><TruckOutlined style={{ color: '#1677ff' }} /><Text>Đơn đang trên đường về</Text></Space>
                <Text strong style={{ color: '#1677ff', fontSize: 16 }}>{poDangVe}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#e0f2f1', borderRadius: 10 }}>
                <Space><DownloadOutlined style={{ color: ACCENT }} /><Text>Phiếu nhập kho hôm nay</Text></Space>
                <Text strong style={{ color: ACCENT, fontSize: 16 }}>{grHomNay}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: grChoDuyet > 0 ? '#fff7e6' : '#f6ffed', borderRadius: 10 }}>
                <Space><CheckCircleOutlined style={{ color: grChoDuyet > 0 ? '#fa8c16' : '#52c41a' }} /><Text>Phiếu nhập kho chờ duyệt</Text></Space>
                <Text strong style={{ color: grChoDuyet > 0 ? '#fa8c16' : '#52c41a', fontSize: 16 }}>{grChoDuyet}</Text>
              </div>
              {hdQuaHan > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#fff1f0', borderRadius: 10 }}>
                  <Space><DollarOutlined style={{ color: '#cf1322' }} /><Text>Hóa đơn quá hạn thanh toán</Text></Space>
                  <Text strong style={{ color: '#cf1322', fontSize: 16 }}>{hdQuaHan}</Text>
                </div>
              )}
            </div>
          </Card>

          {/* Link sang dashboard chi tiết */}
          <Link to="/purchasing/dashboard">
            <Card
              hoverable
              variant="borderless"
              style={{ ...sharedCardStyle, background: `linear-gradient(135deg, ${ACCENT} 0%, #26a69a 100%)` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#fff' }}>
                <AlertOutlined style={{ fontSize: 32 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Báo cáo quản trị mua hàng</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Phân tích KPI, top NCC, công nợ theo pháp nhân →</div>
                </div>
              </div>
            </Card>
          </Link>
        </Col>

        <Col span={10}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} />Lối tắt mua hàng</Space>}
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
          >
            <Row gutter={[12, 12]}>
              <Col span={8}><QuickLink label="Đơn mua hàng" path="/purchasing/orders" icon={<AuditOutlined />} color={ACCENT} /></Col>
              <Col span={8}><QuickLink label="Nhập kho GR" path="/purchasing/goods-receipts" icon={<DownloadOutlined />} color="#1677ff" /></Col>
              <Col span={8}><QuickLink label="Trả hàng NCC" path="/purchasing/returns" icon={<TruckOutlined />} color="#fa8c16" /></Col>
              <Col span={8}><QuickLink label="Nhà cung cấp" path="/purchasing/suppliers" icon={<ShopOutlined />} color="#722ed1" /></Col>
              <Col span={8}><QuickLink label="Vật tư" path="/purchasing/materials" icon={<FileTextOutlined />} color="#13c2c2" /></Col>
              <Col span={8}><QuickLink label="Báo cáo" path="/purchasing/reports" icon={<AlertOutlined />} color="#f5222d" /></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
