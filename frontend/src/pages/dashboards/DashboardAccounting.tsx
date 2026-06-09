import React from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, Col, List, Row, Space, Tag, Typography } from 'antd'
import {
  AlertOutlined, AuditOutlined, BankOutlined, CheckCircleOutlined,
  DollarOutlined, ExclamationCircleOutlined, FileTextOutlined,
  ThunderboltOutlined, WalletOutlined,
} from '@ant-design/icons'
import {
  DashboardHeader, DashboardStats, KPICard, QuickLink,
  dashboardPageStyle, hoverCardCss, sharedCardStyle, usePrefetchPages,
} from './_shared'

const { Text } = Typography

interface Props {
  stats: DashboardStats
  userName: string
}

export default function DashboardAccounting({ stats, userName }: Props) {
  usePrefetchPages(['accounting', 'sales'])
  const acc = stats.accounting

  const arTien = acc?.ar_tien_qua_han || 0
  const arSoHD = acc?.ar_so_hoa_don_qua_han || 0
  const apTien = acc?.ap_tien_qua_han || 0
  const phieuThuChoduyet = acc?.phieu_thu_cho_duyet || 0
  const phieuChiChoduyet = acc?.phieu_chi_cho_duyet || 0
  const doanhThuThangTruoc = acc?.doanh_thu_thang_truoc || 0

  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader userName={userName} subtitle="Tổng quan tài chính — Phòng Kế Toán" />

      {/* Cảnh báo nếu có công nợ quá hạn */}
      {arTien > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={`Có ${arSoHD} hóa đơn công nợ quá hạn — tổng ${(arTien / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} triệu VND`}
          style={{ marginBottom: 24, borderRadius: 10 }}
          action={<Link to="/reports/debt-summary">Xem chi tiết</Link>}
        />
      )}

      {/* KPI tài chính */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Công nợ phải thu quá hạn"
            value={(arTien / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            suffix="triệu VND"
            icon={<AlertOutlined />}
            gradient={arTien > 0 ? 'linear-gradient(135deg, #cf1322 0%, #ff4d4f 100%)' : undefined}
            color={arTien > 0 ? '#f5222d' : '#52c41a'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Phiếu thu chờ duyệt"
            value={phieuThuChoduyet}
            suffix="phiếu"
            icon={<DollarOutlined />}
            color={phieuThuChoduyet > 0 ? '#1890ff' : '#52c41a'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Phiếu chi chờ chốt"
            value={phieuChiChoduyet}
            suffix="phiếu"
            icon={<WalletOutlined />}
            color={phieuChiChoduyet > 0 ? '#fa8c16' : '#52c41a'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Doanh thu tháng trước"
            value={(doanhThuThangTruoc / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            suffix="triệu VND"
            icon={<BankOutlined />}
            color="#722ed1"
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={16}>
          {/* Phê duyệt phiếu */}
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: phieuThuChoduyet + phieuChiChoduyet > 0 ? '#fa8c16' : '#52c41a' }} />
                Cần xử lý
              </Space>
            }
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
          >
            <List size="small">
              <List.Item
                extra={
                  <Space>
                    <Tag color={phieuThuChoduyet > 0 ? 'blue' : 'default'}>{phieuThuChoduyet}</Tag>
                    <Link to="/accounting/receipts"><Tag color="blue" style={{ cursor: 'pointer' }}>Xem →</Tag></Link>
                  </Space>
                }
              >
                <Space><DollarOutlined style={{ color: '#1890ff' }} />Phiếu thu chờ duyệt</Space>
              </List.Item>
              <List.Item
                extra={
                  <Space>
                    <Tag color={phieuChiChoduyet > 0 ? 'orange' : 'default'}>{phieuChiChoduyet}</Tag>
                    <Link to="/accounting/payments"><Tag color="orange" style={{ cursor: 'pointer' }}>Xem →</Tag></Link>
                  </Space>
                }
              >
                <Space><WalletOutlined style={{ color: '#fa8c16' }} />Phiếu chi chờ chốt</Space>
              </List.Item>
              <List.Item
                extra={
                  <Space>
                    <Tag color={stats.purchase?.po_cho_duyet ?? 0 > 0 ? 'purple' : 'default'}>{stats.purchase?.po_cho_duyet ?? 0}</Tag>
                    <Link to="/purchase/orders?trang_thai=moi"><Tag color="purple" style={{ cursor: 'pointer' }}>Xem →</Tag></Link>
                  </Space>
                }
              >
                <Space><FileTextOutlined style={{ color: '#722ed1' }} />PO mua hàng chờ duyệt</Space>
              </List.Item>
            </List>
          </Card>

          {/* Công nợ phải trả */}
          {apTien > 0 && (
            <Card
              title={<Space><ExclamationCircleOutlined style={{ color: '#f5222d' }} />Công nợ phải trả quá hạn</Space>}
              variant="borderless"
              style={{ ...sharedCardStyle, marginBottom: 24 }}
              extra={<Link to="/purchase/invoices">Xem chi tiết</Link>}
            >
              <div style={{ padding: '16px', background: '#fff2f0', borderRadius: 10 }}>
                <Text strong style={{ fontSize: 20, color: '#f5222d' }}>
                  {(apTien / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} triệu VND
                </Text>
                <br />
                <Text type="secondary">{acc?.ap_so_hoa_don_qua_han || 0} hóa đơn mua hàng quá hạn</Text>
              </div>
            </Card>
          )}
        </Col>

        <Col span={8}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /> Lối tắt kế toán</Space>}
            variant="borderless"
            style={sharedCardStyle}
          >
            <Row gutter={[12, 12]}>
              <Col span={8}><QuickLink label="Phiếu thu" path="/accounting/receipts" icon={<DollarOutlined />} color="#1890ff" /></Col>
              <Col span={8}><QuickLink label="Phiếu chi" path="/accounting/payments" icon={<WalletOutlined />} color="#fa8c16" /></Col>
              <Col span={8}><QuickLink label="Công nợ KH" path="/reports/debt-summary" icon={<AuditOutlined />} color="#f5222d" /></Col>
              <Col span={8}><QuickLink label="HĐ bán hàng" path="/billing/invoices" icon={<FileTextOutlined />} color="#722ed1" /></Col>
              <Col span={8}><QuickLink label="HĐ mua hàng" path="/purchase/invoices" icon={<BankOutlined />} color="#52c41a" /></Col>
              <Col span={8}><QuickLink label="Báo cáo" path="/reports/hub" icon={<AuditOutlined />} color="#1b168e" /></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
