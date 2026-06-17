import React, { useState, useMemo } from 'react'
import { Card, Table, DatePicker, Button, Typography, Row, Col, Tabs, Statistic, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { reportsApi } from '../../api/reports'
import PageLayout from '../../components/PageLayout'
import dayjs from 'dayjs'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography

interface ARData {
  tong: number; chua_den_han: number; trong_han: number; sap_den_han_10: number
  qua_han_14: number; qua_han_30: number; qua_han_60: number; kho_doi: number
}
interface APData {
  tong: number; qua_han: number; den_han_30: number; den_han_60: number; chua_den_han: number
}
interface PNDebt { phap_nhan_id: number; ten: string; ar: ARData; ap: APData }
interface GroupDebtData {
  as_of_date: string
  phap_nhan: PNDebt[]
  tong_group: { ar: ARData; ap: APData }
}

const fmt = (v: number) => v?.toLocaleString('vi-VN') ?? '—'
const B = (v: number) => `${(v / 1e9).toFixed(3)} tỷ`

const AR_BUCKETS: { key: keyof ARData; label: string; color: string }[] = [
  { key: 'chua_den_han', label: 'Chưa đến hạn', color: '#8c8c8c' },
  { key: 'trong_han', label: 'Trong hạn', color: '#52c41a' },
  { key: 'sap_den_han_10', label: 'Sắp đến hạn (10N)', color: '#faad14' },
  { key: 'qua_han_14', label: 'Quá hạn 2 tuần', color: '#fa8c16' },
  { key: 'qua_han_30', label: 'Quá hạn 1 tháng', color: '#f5222d' },
  { key: 'qua_han_60', label: 'Quá hạn 2 tháng', color: '#a8071a' },
  { key: 'kho_doi', label: 'Khó đòi (>60N)', color: '#820014' },
]

const AP_BUCKETS: { key: keyof APData; label: string; color: string }[] = [
  { key: 'qua_han', label: 'Quá hạn', color: '#f5222d' },
  { key: 'den_han_30', label: 'Đến hạn trong 30N', color: '#faad14' },
  { key: 'den_han_60', label: 'Đến hạn trong 60N', color: '#1677ff' },
  { key: 'chua_den_han', label: 'Chưa đến hạn', color: '#8c8c8c' },
]

const GroupDebtPage: React.FC = () => {
  const [asOfDate, setAsOfDate] = useState(dayjs())
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<GroupDebtData | null>(null)

  const onSearch = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getGroupDebt(asOfDate.format('YYYY-MM-DD'))
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const arColumns = useMemo(() => [
    { title: 'Pháp nhân', dataIndex: 'ten', key: 'ten',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Tổng AR', key: 'tong', align: 'right' as const,
      render: (_: unknown, r: PNDebt) => <Text strong>{fmt(r.ar.tong)}</Text> },
    ...AR_BUCKETS.map(b => ({
      title: <Tag color={b.color}>{b.label}</Tag>,
      key: b.key,
      align: 'right' as const,
      render: (_: unknown, r: PNDebt) => {
        const v = r.ar[b.key]
        return v > 0 ? <Text style={{ color: b.color }}>{fmt(v)}</Text> : <Text type="secondary">—</Text>
      },
    })),
  ], [])

  const apColumns = useMemo(() => [
    { title: 'Pháp nhân', dataIndex: 'ten', key: 'ten',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Tổng AP', key: 'tong', align: 'right' as const,
      render: (_: unknown, r: PNDebt) => <Text strong>{fmt(r.ap.tong)}</Text> },
    ...AP_BUCKETS.map(b => ({
      title: <Tag color={b.color}>{b.label}</Tag>,
      key: b.key,
      align: 'right' as const,
      render: (_: unknown, r: PNDebt) => {
        const v = r.ap[b.key]
        return v > 0 ? <Text style={{ color: b.color }}>{fmt(v)}</Text> : <Text type="secondary">—</Text>
      },
    })),
  ], [])

  const { displayColumns: arDisplayColumns, settingsButton: arSettingsButton } = useColumnPrefs('reports-group-debt-ar', arColumns)
  const { displayColumns: apDisplayColumns, settingsButton: apSettingsButton } = useColumnPrefs('reports-group-debt-ap', apColumns)

  const tableData = data ? [
    ...data.phap_nhan,
    { phap_nhan_id: -1, ten: 'TỔNG GROUP', ar: data.tong_group.ar, ap: data.tong_group.ap },
  ] : []

  return (
    <PageLayout title="Báo cáo Công nợ Group">
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Text strong>Ngày: </Text>
            <DatePicker value={asOfDate} onChange={v => v && setAsOfDate(v)} format="DD/MM/YYYY" />
          </Col>
          <Col>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onSearch}>
              Xem công nợ
            </Button>
          </Col>
        </Row>
      </Card>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card><Statistic title="Tổng Phải Thu (Group)" value={data.tong_group.ar.tong}
                formatter={v => fmt(Number(v))} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Khó đòi" value={data.tong_group.ar.kho_doi}
                valueStyle={{ color: '#820014' }} formatter={v => fmt(Number(v))} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Tổng Phải Trả (Group)" value={data.tong_group.ap.tong}
                formatter={v => fmt(Number(v))} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="AP Quá hạn" value={data.tong_group.ap.qua_han}
                valueStyle={{ color: '#f5222d' }} formatter={v => fmt(Number(v))} /></Card>
            </Col>
          </Row>

          <Card>
            <Tabs items={[
              {
                key: 'ar',
                label: `Phải thu (AR) — ${B(data.tong_group.ar.tong)}`,
                children: (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{arSettingsButton}</div>
                    <Table
                      columns={arDisplayColumns}
                      dataSource={tableData}
                      rowKey={(r: any) => r.phap_nhan_id}
                      pagination={false}
                      bordered
                      scroll={{ x: 'max-content' }}
                      size="small"
                      rowClassName={(r: any) => r.phap_nhan_id === -1 ? 'ant-table-row-total' : ''}
                    />
                  </>
                ),
              },
              {
                key: 'ap',
                label: `Phải trả (AP) — ${B(data.tong_group.ap.tong)}`,
                children: (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{apSettingsButton}</div>
                    <Table
                      columns={apDisplayColumns}
                      dataSource={tableData}
                      rowKey={(r: any) => r.phap_nhan_id}
                      pagination={false}
                      bordered
                      size="small"
                      rowClassName={(r: any) => r.phap_nhan_id === -1 ? 'ant-table-row-total' : ''}
                    />
                  </>
                ),
              },
            ]} />
          </Card>
        </>
      )}
    </PageLayout>
  )
}

export default GroupDebtPage
