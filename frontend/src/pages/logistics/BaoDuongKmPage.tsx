import { useState } from 'react'
import {
  Button, Card, Col, InputNumber, Modal, Progress, Row, Space, Statistic, Tag, Typography,
} from 'antd'
import { CheckCircleOutlined, ReloadOutlined, ToolOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'

const { Text, Title } = Typography

interface AlertRow {
  xe_id: number
  bien_so: string
  loai_xe: string | null
  km_hien_tai: number
  km_bao_duong_gan_nhat: number
  km_bao_duong_dinh_ky: number
  km_tiep_theo: number
  km_con_lai: number
  alert: 'ok' | 'warning' | 'danger' | 'overdue' | 'no_data'
}

const ALERT_CFG: Record<string, { color: string; text: string; progressColor: string }> = {
  ok: { color: 'green', text: 'Còn xa', progressColor: '#52c41a' },
  warning: { color: 'orange', text: 'Sắp đến', progressColor: '#faad14' },
  danger: { color: 'red', text: 'Gần đến (<500km)', progressColor: '#ff4d4f' },
  overdue: { color: 'red', text: 'Đã quá hạn', progressColor: '#ff4d4f' },
  no_data: { color: 'default', text: 'Chưa có GPS', progressColor: '#d9d9d9' },
}

const fmtKm = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })

export default function BaoDuongKmPage() {
  const qc = useQueryClient()
  const [modalXe, setModalXe] = useState<AlertRow | null>(null)
  const [newKm, setNewKm] = useState<number | null>(null)
  const [newKy, setNewKy] = useState<number | null>(null)

  const { data = [], isFetching, refetch } = useQuery<AlertRow[]>({
    queryKey: ['maintenance-alerts'],
    queryFn: async () => {
      const res = await client.get('/gps/maintenance-alerts')
      return res.data
    },
  })

  const recordMutation = useMutation({
    mutationFn: async ({ xe_id, km, ky }: { xe_id: number; km: number; ky: number | null }) => {
      await client.patch(`/xe/${xe_id}/bao-duong`, {
        km_bao_duong_gan_nhat: km,
        ...(ky ? { km_bao_duong_dinh_ky: ky } : {}),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-alerts'] })
      setModalXe(null)
      setNewKm(null)
      setNewKy(null)
    },
  })

  const overdueCount = data.filter(r => r.alert === 'overdue').length
  const dangerCount = data.filter(r => r.alert === 'danger').length
  const warningCount = data.filter(r => r.alert === 'warning').length
  const noDataCount = data.filter(r => r.alert === 'no_data').length

  const openModal = (xe: AlertRow) => {
    setModalXe(xe)
    setNewKm(xe.km_hien_tai || xe.km_bao_duong_gan_nhat || null)
    setNewKy(xe.km_bao_duong_dinh_ky)
  }

  const renderCard = (xe: AlertRow) => {
    const cfg = ALERT_CFG[xe.alert]
    const pct = xe.km_hien_tai > 0 && xe.km_tiep_theo > 0
      ? Math.min(100, Math.round((xe.km_hien_tai - xe.km_bao_duong_gan_nhat) / xe.km_bao_duong_dinh_ky * 100))
      : 0

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={xe.xe_id}>
        <Card
          size="small"
          style={{
            borderColor: xe.alert === 'overdue' || xe.alert === 'danger' ? '#ff4d4f'
              : xe.alert === 'warning' ? '#faad14' : undefined,
          }}
          title={
            <Space>
              <Text strong style={{ fontSize: 15 }}>{xe.bien_so}</Text>
              <Tag color={cfg.color}>{cfg.text}</Tag>
            </Space>
          }
          extra={
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => openModal(xe)}
              disabled={xe.alert === 'no_data'}
            >
              Đã bảo dưỡng
            </Button>
          }
        >
          {xe.loai_xe && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              {xe.loai_xe}
            </Text>
          )}

          {xe.alert === 'no_data' ? (
            <Text type="secondary">Chưa có dữ liệu km GPS</Text>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <Progress
                  percent={pct}
                  strokeColor={cfg.progressColor}
                  trailColor="#f0f0f0"
                  size="small"
                  format={() => `${pct}%`}
                />
              </div>
              <Row gutter={8}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Km hiện tại</Text>
                  <div><Text strong style={{ color: '#1677ff' }}>{fmtKm(xe.km_hien_tai)} km</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Bảo dưỡng tiếp</Text>
                  <div><Text strong>{fmtKm(xe.km_tiep_theo)} km</Text></div>
                </Col>
              </Row>
              <Row gutter={8} style={{ marginTop: 6 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Lần cuối</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {xe.km_bao_duong_gan_nhat > 0 ? `${fmtKm(xe.km_bao_duong_gan_nhat)} km` : 'Chưa ghi'}
                    </Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Còn lại</Text>
                  <div>
                    <Text
                      strong
                      style={{
                        color: xe.km_con_lai < 0 ? '#ff4d4f' : xe.km_con_lai < 500 ? '#ff4d4f' : xe.km_con_lai < 1000 ? '#faad14' : '#52c41a',
                      }}
                    >
                      {xe.km_con_lai < 0 ? '-' : ''}{fmtKm(Math.abs(xe.km_con_lai))} km
                    </Text>
                  </div>
                </Col>
              </Row>
            </>
          )}
        </Card>
      </Col>
    )
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <ToolOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Cảnh báo bảo dưỡng — Theo km GPS
        </Title>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
          Tải lại
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Quá hạn bảo dưỡng"
              value={overdueCount}
              valueStyle={{ color: overdueCount > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={overdueCount > 0 ? <WarningOutlined /> : undefined}
              suffix="xe"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Sắp đến hạn (<1000km)"
              value={dangerCount + warningCount}
              valueStyle={{ color: (dangerCount + warningCount) > 0 ? '#faad14' : '#52c41a' }}
              suffix="xe"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Còn tốt"
              value={data.length - overdueCount - dangerCount - warningCount - noDataCount}
              valueStyle={{ color: '#52c41a' }}
              suffix="xe"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Chưa có dữ liệu GPS"
              value={noDataCount}
              valueStyle={{ color: '#8c8c8c' }}
              suffix="xe"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        {data.map(xe => renderCard(xe))}
      </Row>

      <Card size="small" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 Km hiện tại lấy từ đồng hồ GPS Bình Minh (km_total). Chu kỳ bảo dưỡng mặc định 5.000 km — chỉnh trong danh mục Xe.
          Nhấn "Đã bảo dưỡng" để ghi nhận km lúc bảo dưỡng và reset đếm.
        </Text>
      </Card>

      <Modal
        title={modalXe ? `Ghi nhận bảo dưỡng — ${modalXe.bien_so}` : ''}
        open={!!modalXe}
        onCancel={() => { setModalXe(null); setNewKm(null); setNewKy(null) }}
        onOk={() => {
          if (modalXe && newKm !== null) {
            recordMutation.mutate({ xe_id: modalXe.xe_id, km: newKm, ky: newKy })
          }
        }}
        confirmLoading={recordMutation.isPending}
        okText="Xác nhận"
        cancelText="Huỷ"
      >
        {modalXe && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Km GPS hiện tại: </Text>
              <Text strong style={{ color: '#1677ff' }}>{fmtKm(modalXe.km_hien_tai)} km</Text>
            </div>
            <div>
              <Text type="secondary">Km lúc bảo dưỡng (để ghi nhận):</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 4 }}
                value={newKm}
                min={0}
                step={100}
                formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => Number(v?.replace(/,/g, '') ?? 0)}
                onChange={v => setNewKm(v)}
                addonAfter="km"
              />
            </div>
            <div>
              <Text type="secondary">Chu kỳ bảo dưỡng (km):</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 4 }}
                value={newKy}
                min={1000}
                step={1000}
                formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => Number(v?.replace(/,/g, '') ?? 5000)}
                onChange={v => setNewKy(v)}
                addonAfter="km"
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}
