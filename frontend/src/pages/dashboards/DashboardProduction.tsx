import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Col, Progress, Row, Space, Tag, Typography } from 'antd'
import {
  AlertOutlined, BuildOutlined, CheckCircleOutlined,
  ClockCircleOutlined, DatabaseOutlined, InboxOutlined,
  ThunderboltOutlined, ToolOutlined,
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

export default function DashboardProduction({ stats, userName }: Props) {
  usePrefetchPages(['production', 'warehouse'])
  const prod = stats.production
  const kpi = stats.kpi

  const dangSanXuat = prod?.dang_san_xuat || 0
  const lenhTre = prod?.lenh_sx_tre || 0
  const hoanThanhHomNay = prod?.lenh_sx_hoan_thanh_hom_nay || 0
  const lenhMoi = prod?.lenh_sx_moi || 0
  const backlogLsx = kpi?.backlog_lsx || 0

  const tongLenhHienTai = lenhMoi + dangSanXuat
  const pctHoanThanh = tongLenhHienTai > 0
    ? Math.round((hoanThanhHomNay / tongLenhHienTai) * 100)
    : 0

  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader userName={userName} subtitle="Tình hình sản xuất hôm nay" />

      {/* KPI sản xuất */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Đang sản xuất"
            value={dangSanXuat}
            suffix="LSX"
            icon={<ToolOutlined />}
            gradient="linear-gradient(135deg, #1b168e 0%, #3a32cc 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Lệnh mới chờ chạy"
            value={lenhMoi}
            suffix="LSX"
            icon={<ClockCircleOutlined />}
            color="#1890ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Lệnh trễ hạn"
            value={lenhTre}
            suffix="LSX"
            icon={<AlertOutlined />}
            color={lenhTre > 0 ? '#f5222d' : '#52c41a'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Hoàn thành hôm nay"
            value={hoanThanhHomNay}
            suffix="LSX"
            icon={<CheckCircleOutlined />}
            color="#52c41a"
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={16}>
          {/* Tiến độ tổng quan */}
          <Card
            title={<Space><ToolOutlined style={{ color: '#1b168e' }} />Tiến độ sản xuất hôm nay</Space>}
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
            extra={<Link to="/production/orders">Xem tất cả LSX</Link>}
          >
            <Row gutter={32} align="middle">
              <Col span={8} style={{ textAlign: 'center' }}>
                <Progress
                  type="dashboard"
                  percent={pctHoanThanh}
                  strokeColor={pctHoanThanh >= 80 ? '#52c41a' : pctHoanThanh >= 50 ? '#fa8c16' : '#f5222d'}
                  size={140}
                  format={p => <><div style={{ fontSize: 22, fontWeight: 800 }}>{p}%</div><div style={{ fontSize: 11, color: '#8c8c8c' }}>Hoàn thành</div></>}
                />
              </Col>
              <Col span={16}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f0f2f5', borderRadius: 10 }}>
                    <Space><ClockCircleOutlined style={{ color: '#1890ff' }} /><Text>Lệnh mới cần chạy</Text></Space>
                    <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>{lenhMoi}</Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f0f2f5', borderRadius: 10 }}>
                    <Space><ToolOutlined style={{ color: '#1b168e' }} /><Text>Đang chạy</Text></Space>
                    <Tag color="processing" style={{ fontSize: 14, padding: '2px 12px' }}>{dangSanXuat}</Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f0f2f5', borderRadius: 10 }}>
                    <Space><AlertOutlined style={{ color: lenhTre > 0 ? '#f5222d' : '#8c8c8c' }} /><Text>Lệnh trễ hạn</Text></Space>
                    <Tag color={lenhTre > 0 ? 'error' : 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>{lenhTre}</Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f6ffed', borderRadius: 10 }}>
                    <Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><Text>Hoàn thành hôm nay</Text></Space>
                    <Tag color="success" style={{ fontSize: 14, padding: '2px 12px' }}>{hoanThanhHomNay}</Tag>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Backlog KPIs */}
          <Row gutter={16}>
            <Col span={12}>
              <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text style={{ color: '#8c8c8c', fontSize: 13 }}>Backlog toàn bộ</Text>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontSize: 28, fontWeight: 800, color: backlogLsx > 50 ? '#cf1322' : '#1b168e' }}>
                        {backlogLsx.toLocaleString()}
                      </Text>
                      <Text style={{ color: '#8c8c8c', fontSize: 12 }}>lệnh</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{(kpi?.backlog_so_luong || 0).toLocaleString()} thùng tồn đọng</Text>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fa8c1615', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fa8c16', fontSize: 20 }}>
                    <BuildOutlined />
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text style={{ color: '#8c8c8c', fontSize: 13 }}>Tồn kho phôi</Text>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontSize: 28, fontWeight: 800, color: '#1b168e' }}>
                        {(kpi?.ton_kho_phoi_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Text>
                      <Text style={{ color: '#8c8c8c', fontSize: 12 }}>kg</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Kho PHOI</Text>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#13c2c215', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#13c2c2', fontSize: 20 }}>
                    <DatabaseOutlined />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </Col>

        <Col span={8}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /> Lối tắt sản xuất</Space>}
            variant="borderless"
            style={sharedCardStyle}
          >
            <Row gutter={[12, 12]}>
              <Col span={8}><QuickLink label="Danh sách LSX" path="/production/orders" icon={<ToolOutlined />} color="#1b168e" /></Col>
              <Col span={8}><QuickLink label="Kế hoạch SX" path="/production/plans" icon={<BuildOutlined />} color="#1890ff" /></Col>
              <Col span={8}><QuickLink label="Xuất NVL" path="/warehouse/material-issues" icon={<InboxOutlined />} color="#52c41a" /></Col>
              <Col span={8}><QuickLink label="Tồn kho phôi" path="/warehouse/inventory" icon={<DatabaseOutlined />} color="#13c2c2" /></Col>
              <Col span={8}><QuickLink label="Giao hàng" path="/sales/giao-hang" icon={<CheckCircleOutlined />} color="#722ed1" /></Col>
              <Col span={8}><QuickLink label="Trễ hạn" path="/production/orders?trang_thai=tre" icon={<AlertOutlined />} color="#f5222d" /></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
