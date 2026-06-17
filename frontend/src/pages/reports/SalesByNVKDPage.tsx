import React, { useState } from 'react'
import { Card, Table, DatePicker, Button, Typography, Row, Col, Progress, Modal, Form, InputNumber, message } from 'antd'
import { SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { reportsApi } from '../../api/reports'
import PageLayout from '../../components/PageLayout'
import dayjs from 'dayjs'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography

interface NVKDRow {
  user_id: number; ten: string; username: string | null
  muc_tieu_thang: number; thuc_hien: number; ty_le: number | null
}

interface SalesByNVKDData {
  tu_ngay: string; den_ngay: string
  nvkd: NVKDRow[]
  theo_ngay: Array<{ ngay: string; values: Record<string, number>; total: number }>
}

const fmt = (v: number) => v?.toLocaleString('vi-VN') ?? '—'

const SalesByNVKDPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'), dayjs()
  ])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SalesByNVKDData | null>(null)
  const [targetModal, setTargetModal] = useState(false)
  const [targets, setTargets] = useState<any[]>([])
  const [targetLoading, setTargetLoading] = useState(false)

  const onSearch = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getSalesByNVKD({
        tu_ngay: range[0].format('YYYY-MM-DD'),
        den_ngay: range[1].format('YYYY-MM-DD'),
      })
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const openTargetModal = async () => {
    setTargetLoading(true)
    try {
      const thang = range[0].format('YYYY-MM-01')
      const res = await reportsApi.getSalesTargets({ thang })
      setTargets(res)
      setTargetModal(true)
    } finally {
      setTargetLoading(false)
    }
  }

  const saveTarget = async (userId: number, muc_tieu: number, existingId?: number) => {
    const thang = range[0].format('YYYY-MM-01')
    if (existingId) {
      await reportsApi.updateSalesTarget(existingId, { muc_tieu })
    } else {
      await reportsApi.createSalesTarget({ user_id: userId, thang, muc_tieu })
    }
    message.success('Đã lưu mục tiêu')
  }

  const columns = [
    { title: 'NV Kinh doanh', dataIndex: 'ten', key: 'ten',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Mục tiêu tháng', dataIndex: 'muc_tieu_thang', key: 'mt', align: 'right' as const,
      render: (v: number) => fmt(v) },
    { title: 'Thực hiện', dataIndex: 'thuc_hien', key: 'th', align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#1d3557' }}>{fmt(v)}</Text> },
    { title: '% Đạt', dataIndex: 'ty_le', key: 'tl', width: 200,
      render: (v: number | null) => (
        v != null
          ? <Progress percent={Math.min(Math.round(v * 100), 100)} size="small"
              status={v >= 1 ? 'success' : v >= 0.8 ? 'normal' : 'exception'}
              format={() => `${(v * 100).toFixed(1)}%`} />
          : <Text type="secondary">—</Text>
      ) },
    { title: 'Còn lại', key: 'con_lai', align: 'right' as const,
      render: (_: unknown, r: NVKDRow) => {
        const cl = r.muc_tieu_thang - r.thuc_hien
        return <Text type={cl <= 0 ? 'success' : 'danger'}>{fmt(cl)}</Text>
      } },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('reports-sales-by-nvkd', columns)

  const ngayColumns = data ? [
    { title: 'Ngày', dataIndex: 'ngay', key: 'ngay', width: 90,
      render: (v: string) => dayjs(v).format('DD/MM') },
    ...data.nvkd.map(nv => ({
      title: nv.ten,
      key: `nv_${nv.user_id}`,
      align: 'right' as const,
      render: (_: unknown, r: any) => fmt(r.values[String(nv.user_id)] || 0),
    })),
    { title: 'Tổng', dataIndex: 'total', key: 'total', align: 'right' as const,
      render: (v: number) => <Text strong>{fmt(v)}</Text> },
  ] : []

  return (
    <PageLayout title="Báo cáo Doanh số theo NV Kinh doanh">
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Text strong>Kỳ: </Text>
            <DatePicker.RangePicker
              value={range}
              onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onSearch}>
              Xem doanh số
            </Button>
          </Col>
          <Col>
            <Button icon={<SettingOutlined />} loading={targetLoading} onClick={openTargetModal}>
              Cài mục tiêu tháng
            </Button>
          </Col>
          <Col>{settingsButton}</Col>
        </Row>
      </Card>

      {data && (
        <>
          <Card title="Tổng hợp NV Kinh doanh" style={{ marginBottom: 24 }}>
            <Table
              columns={displayColumns}
              dataSource={data.nvkd}
              rowKey="user_id"
              pagination={false}
              bordered
            />
          </Card>

          <Card title="Doanh số theo Ngày">
            <Table
              columns={ngayColumns}
              dataSource={data.theo_ngay}
              rowKey="ngay"
              pagination={false}
              size="small"
              bordered
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </>
      )}

      <Modal
        title="Cài mục tiêu doanh số tháng"
        open={targetModal}
        onCancel={() => setTargetModal(false)}
        footer={null}
      >
        {data?.nvkd.map(nv => {
          const existing = targets.find(t => t.user_id === nv.user_id && !t.phan_xuong_id)
          return (
            <Row key={nv.user_id} align="middle" gutter={8} style={{ marginBottom: 12 }}>
              <Col span={10}><Text strong>{nv.ten}</Text></Col>
              <Col span={14}>
                <InputNumber
                  defaultValue={existing?.muc_tieu || nv.muc_tieu_thang || 0}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v?.replace(/,/g, '') as any}
                  style={{ width: '100%' }}
                  onBlur={e => {
                    const val = Number(e.target.value.replace(/,/g, ''))
                    if (val > 0) saveTarget(nv.user_id, val, existing?.id)
                  }}
                />
              </Col>
            </Row>
          )
        })}
      </Modal>
    </PageLayout>
  )
}

export default SalesByNVKDPage
