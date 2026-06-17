import React, { useState, useMemo } from 'react'
import { Card, Table, DatePicker, Button, Typography, Row, Col, Space } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { reportsApi } from '../../api/reports'
import PageLayout from '../../components/PageLayout'
import dayjs from 'dayjs'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text, Title } = Typography

interface PNLColumn { phap_nhan_id: number | null; ten: string }
interface PNLRow { chi_tieu: string; ma_so: number; key: string; values: number[] }
interface GroupPNLData {
  tu_ngay: string; den_ngay: string
  columns: PNLColumn[]; rows: PNLRow[]
}

const fmt = (v: number) => v?.toLocaleString('vi-VN') ?? '—'
const HIGHLIGHT_ROWS = ['loi_nhuan_gop', 'loi_nhuan_truoc_thue', 'doanh_thu_thuan']
const NEGATIVE_ROWS = ['gia_von_hang_ban', 'chi_phi_tai_chinh', 'chi_phi_ban_hang', 'chi_phi_quan_ly', 'chi_phi_khac', 'giam_tru_doanh_thu']

const GroupPNLPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'), dayjs()
  ])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<GroupPNLData | null>(null)

  const onSearch = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getGroupPNL({
        tu_ngay: range[0].format('YYYY-MM-DD'),
        den_ngay: range[1].format('YYYY-MM-DD'),
      })
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const pnlColumns = useMemo(() => {
    const cols = data?.columns ?? []
    return [
      {
        title: 'Chỉ tiêu', dataIndex: 'chi_tieu', key: 'chi_tieu', width: 240,
        render: (v: string, r: PNLRow) => (
          <Text strong={HIGHLIGHT_ROWS.includes(r.key)} style={{ color: HIGHLIGHT_ROWS.includes(r.key) ? '#1d3557' : undefined }}>
            {v}
          </Text>
        ),
      },
      { title: 'MS', dataIndex: 'ma_so', key: 'ma_so', width: 48, align: 'center' as const },
      ...cols.map((col, idx) => ({
        title: <Text strong>{col.ten}</Text>,
        key: `col_${idx}`,
        align: 'right' as const,
        render: (_: unknown, r: PNLRow) => {
          const v = r.values[idx]
          const isNeg = NEGATIVE_ROWS.includes(r.key)
          const isHL = HIGHLIGHT_ROWS.includes(r.key)
          return (
            <Text strong={isHL} style={{ color: isNeg ? '#cf1322' : (isHL ? '#1d3557' : undefined) }}>
              {fmt(v)}
            </Text>
          )
        },
      })),
    ]
  }, [data?.columns])

  const { displayColumns: pnlDisplayColumns, settingsButton: pnlSettingsButton } = useColumnPrefs('reports-group-pnl', pnlColumns)

  return (
    <PageLayout title="Báo cáo P&L Group — Tổng hợp 3 Pháp nhân">
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
              Xem P&L Group
            </Button>
          </Col>
        </Row>
      </Card>

      {data && (
        <Card
          title={<Title level={5}>Kết quả Kinh doanh — {data.tu_ngay} đến {data.den_ngay}</Title>}
          extra={pnlSettingsButton}
        >
          <Table
            columns={pnlDisplayColumns}
            dataSource={data.rows}
            rowKey="key"
            pagination={false}
            bordered
            size="small"
            rowClassName={(r: PNLRow) => HIGHLIGHT_ROWS.includes(r.key) ? 'ant-table-row-highlight' : ''}
            summary={() => null}
          />
        </Card>
      )}
    </PageLayout>
  )
}

export default GroupPNLPage
