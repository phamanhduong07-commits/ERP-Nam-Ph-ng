import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Col, Empty, List, Progress, Row, Space, Typography } from 'antd'
import {
  AlertOutlined, DatabaseOutlined, DownloadOutlined,
  InboxOutlined, ThunderboltOutlined, TruckOutlined, UploadOutlined,
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

export default function DashboardWarehouse({ stats, userName }: Props) {
  usePrefetchPages(['warehouse'])
  const wh = stats.warehouse

  const phieuNhap = wh?.phieu_nhap_hom_nay || 0
  const phieuXuatNVL = wh?.phieu_xuat_nvl_hom_nay || 0
  const phieuGiao = wh?.phieu_giao_hom_nay || 0
  const choXuat = wh?.giao_hang_cho_xuat || 0
  const tonThap = wh?.ton_thap || []

  return (
    <div style={dashboardPageStyle}>
      <DashboardHeader userName={userName} subtitle="Tình hình kho hàng hôm nay" />

      {/* KPI kho */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Phiếu nhập kho hôm nay"
            value={phieuNhap}
            suffix="phiếu"
            icon={<DownloadOutlined />}
            gradient="linear-gradient(135deg, #1b168e 0%, #3a32cc 100%)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Xuất NVL sản xuất"
            value={phieuXuatNVL}
            suffix="phiếu"
            icon={<UploadOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Giao hàng hôm nay"
            value={phieuGiao}
            suffix="phiếu"
            icon={<TruckOutlined />}
            color="#722ed1"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Chờ xuất kho giao"
            value={choXuat}
            suffix="phiếu"
            icon={<InboxOutlined />}
            color={choXuat > 0 ? '#fa8c16' : '#52c41a'}
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={14}>
          {/* Cảnh báo tồn kho thấp — ĐÂY LÀ PRIMARY */}
          <Card
            title={<Space><AlertOutlined style={{ color: '#f5222d' }} />Cảnh báo tồn kho thấp</Space>}
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
            extra={<Link to="/warehouse/inventory">Xem toàn bộ</Link>}
          >
            {tonThap.length > 0 ? (
              <List
                dataSource={tonThap}
                renderItem={item => (
                  <List.Item style={{ padding: '14px 0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <Text strong style={{ fontSize: 14 }}>{item.ten_hang}</Text>
                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>({item.ten_kho})</Text>
                        </div>
                        <Text type="danger" strong style={{ fontSize: 14 }}>
                          {item.ton_luong} / {item.ton_toi_thieu} {item.don_vi}
                        </Text>
                      </div>
                      <Progress
                        percent={Math.min(100, Math.round((item.ton_luong / item.ton_toi_thieu) * 100))}
                        size="small"
                        status="exception"
                        showInfo={false}
                        strokeColor="#f5222d"
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Còn {Math.round((item.ton_luong / item.ton_toi_thieu) * 100)}% so với tồn tối thiểu
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tất cả hàng hóa đều đủ tồn kho" />
            )}
          </Card>

          {/* Hoạt động hôm nay */}
          <Card
            title={<Space><InboxOutlined style={{ color: '#1b168e' }} />Hoạt động kho hôm nay</Space>}
            variant="borderless"
            style={sharedCardStyle}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f0f9ff', borderRadius: 10 }}>
                <Space><DownloadOutlined style={{ color: '#1890ff' }} /><Text>Nhập kho nguyên liệu</Text></Space>
                <Text strong style={{ color: '#1890ff', fontSize: 16 }}>{phieuNhap}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f6ffed', borderRadius: 10 }}>
                <Space><UploadOutlined style={{ color: '#52c41a' }} /><Text>Xuất NVL cho sản xuất</Text></Space>
                <Text strong style={{ color: '#52c41a', fontSize: 16 }}>{phieuXuatNVL}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f9f0ff', borderRadius: 10 }}>
                <Space><TruckOutlined style={{ color: '#722ed1' }} /><Text>Giao thành phẩm</Text></Space>
                <Text strong style={{ color: '#722ed1', fontSize: 16 }}>{phieuGiao}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: choXuat > 0 ? '#fff7e6' : '#f6ffed', borderRadius: 10 }}>
                <Space><InboxOutlined style={{ color: choXuat > 0 ? '#fa8c16' : '#52c41a' }} /><Text>Chờ xuất kho giao khách</Text></Space>
                <Text strong style={{ color: choXuat > 0 ? '#fa8c16' : '#52c41a', fontSize: 16 }}>{choXuat}</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} />Lối tắt kho</Space>}
            variant="borderless"
            style={{ ...sharedCardStyle, marginBottom: 24 }}
          >
            <Row gutter={[12, 12]}>
              <Col span={8}><QuickLink label="Tồn kho" path="/warehouse/inventory" icon={<InboxOutlined />} color="#1890ff" /></Col>
              <Col span={8}><QuickLink label="Nhập NVL" path="/warehouse/receipts" icon={<DownloadOutlined />} color="#52c41a" /></Col>
              <Col span={8}><QuickLink label="Xuất NVL" path="/warehouse/material-issues" icon={<UploadOutlined />} color="#fa8c16" /></Col>
              <Col span={8}><QuickLink label="Giao hàng" path="/sales/giao-hang" icon={<TruckOutlined />} color="#722ed1" /></Col>
              <Col span={8}><QuickLink label="Nhập giấy" path="/warehouse/goods-receipts" icon={<DatabaseOutlined />} color="#13c2c2" /></Col>
              <Col span={8}><QuickLink label="Cảnh báo" path="/warehouse/inventory" icon={<AlertOutlined />} color="#f5222d" /></Col>
            </Row>
          </Card>

          {/* Tổng giá trị kho */}
          <Card variant="borderless" style={sharedCardStyle}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <DatabaseOutlined style={{ fontSize: 36, color: '#1b168e', marginBottom: 12 }} />
              <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>Tổng giá trị tồn kho</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1b168e' }}>
                {((wh?.tong_gia_tri_ton || 0) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                <span style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 400 }}> triệu VND</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <style>{hoverCardCss}</style>
    </div>
  )
}
