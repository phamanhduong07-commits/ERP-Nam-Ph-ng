import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Col, Radio, Row, Select, Spin, Table, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import client from '../../api/client'
import PageLayout from '../../components/PageLayout'
import { usePhapNhan } from '../../hooks/useMasterData'
import { fmtVND } from '../../utils/exportUtils'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography

interface ForecastDay {
  ngay: string
  thu: number
  chi: number
  tra_no: number
  thu_no: number
  net: number
  luy_ke: number
}

const PERIOD_OPTIONS = [
  { label: '7 ngày',  value: 7  },
  { label: '14 ngày', value: 14 },
  { label: '30 ngày', value: 30 },
  { label: '60 ngày', value: 60 },
]

const formatBillion = (v: number) => {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}tỷ`
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}tr`
  return `${(v / 1_000).toFixed(0)}k`
}

export default function DuBaoDongTienPage() {
  const { phapNhanList } = usePhapNhan()
  const [days, setDays] = useState(30)
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow-forecast', days, phapNhanId],
    queryFn: () =>
      client.get('/accounting/cash-flow/forecast', {
        params: { days, phap_nhan_id: phapNhanId },
      }).then(r => r.data),
  })

  const items: ForecastDay[] = data?.items ?? []

  const chartData = items.map(d => ({
    ngay: dayjs(d.ngay).format('DD/MM'),
    thu: Number(d.thu) + Number(d.thu_no),
    chi: -(Number(d.chi) + Number(d.tra_no)),
    luy_ke: Number(d.luy_ke),
  }))

  const tongThu = (Number(data?.tong_thu ?? 0) + Number(data?.tong_thu_no ?? 0))
  const tongChi = (Number(data?.tong_chi ?? 0) + Number(data?.tong_tra_no ?? 0))
  const netTotal = tongThu - tongChi

  const columns: ColumnsType<ForecastDay> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 100,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Thu (PT)',
      dataIndex: 'thu',
      align: 'right',
      render: v => Number(v) > 0 ? <Text type="success">{fmtVND(v)}</Text> : null,
    },
    {
      title: 'Thu nợ (CLV)',
      dataIndex: 'thu_no',
      align: 'right',
      render: v => Number(v) > 0 ? <Text type="success">{fmtVND(v)}</Text> : null,
    },
    {
      title: 'Chi (PC)',
      dataIndex: 'chi',
      align: 'right',
      render: v => Number(v) > 0 ? <Text type="danger">{fmtVND(v)}</Text> : null,
    },
    {
      title: 'Trả nợ (KUV)',
      dataIndex: 'tra_no',
      align: 'right',
      render: v => Number(v) > 0 ? <Text type="danger">{fmtVND(v)}</Text> : null,
    },
    {
      title: 'Net ngày',
      dataIndex: 'net',
      align: 'right',
      render: v => {
        const n = Number(v)
        return n !== 0 ? (
          <Text type={n >= 0 ? 'success' : 'danger'}>{fmtVND(n)}</Text>
        ) : null
      },
    },
    {
      title: 'Lũy kế',
      dataIndex: 'luy_ke',
      align: 'right',
      render: v => {
        const n = Number(v)
        return (
          <Text strong type={n < 0 ? 'danger' : undefined}>
            {fmtVND(n)}
          </Text>
        )
      },
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('accounting-du-bao-dong-tien', columns)

  return (
    <PageLayout title="Dự báo dòng tiền">
      {/* Controls */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={days}
              onChange={e => setDays(e.target.value)}
              options={PERIOD_OPTIONS}
            />
          </Col>
          {phapNhanList.length > 1 && (
            <Col>
              <Select
                style={{ width: 220 }}
                allowClear
                placeholder="Tất cả pháp nhân"
                onChange={v => setPhapNhanId(v)}
                options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
              />
            </Col>
          )}
          <Col style={{ marginLeft: 'auto' }}>{settingsButton}</Col>
        </Row>
      </Card>

      {/* Summary cards */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 12 }}>Tổng thu dự kiến</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#3f8600' }}>{fmtVND(tongThu)}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 12 }}>Tổng chi dự kiến</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#cf1322' }}>{fmtVND(tongChi)}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 12 }}>Net dòng tiền</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: netTotal >= 0 ? '#3f8600' : '#cf1322' }}>
              {fmtVND(netTotal)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 12 }}>Lũy kế cuối kỳ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: Number(items[items.length - 1]?.luy_ke ?? 0) < 0 ? '#cf1322' : '#3f8600' }}>
              {fmtVND(Number(items[items.length - 1]?.luy_ke ?? 0))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Chart */}
      <Card size="small" style={{ marginBottom: 12 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
            Không có dữ liệu dự báo trong kỳ này
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="ngay" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={formatBillion}
                tick={{ fontSize: 11 }}
                width={56}
              />
              <Tooltip
                formatter={(value, name) => [
                  fmtVND(Math.abs(Number(value))),
                  name === 'thu' ? 'Thu' : name === 'chi' ? 'Chi' : 'Lũy kế',
                ]}
                labelFormatter={l => `Ngày ${l}`}
              />
              <Legend
                formatter={v => v === 'thu' ? 'Thu' : v === 'chi' ? 'Chi' : 'Lũy kế'}
              />
              <Bar dataKey="thu" fill="#52c41a" radius={[2, 2, 0, 0]} name="thu" />
              <Bar dataKey="chi" fill="#ff4d4f" radius={[2, 2, 0, 0]} name="chi" />
              <Line
                type="monotone"
                dataKey="luy_ke"
                stroke="#1677ff"
                strokeWidth={2}
                dot={false}
                name="luy_ke"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Table */}
      <Table<ForecastDay>
        columns={displayColumns}
        dataSource={items}
        rowKey="ngay"
        size="small"
        loading={isLoading}
        pagination={false}
        rowClassName={(r: ForecastDay) => Number(r.luy_ke) < 0 ? 'ant-table-row-danger' : ''}
        summary={() => {
          if (!items.length) return null
          return (
            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 700 }}>
              <Table.Summary.Cell index={0}>Tổng</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text type="success">{fmtVND(data?.tong_thu ?? 0)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text type="success">{fmtVND(data?.tong_thu_no ?? 0)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text type="danger">{fmtVND(data?.tong_chi ?? 0)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text type="danger">{fmtVND(data?.tong_tra_no ?? 0)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text type={netTotal >= 0 ? 'success' : 'danger'}>{fmtVND(netTotal)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} />
            </Table.Summary.Row>
          )
        }}
      />

      <style>{`
        .ant-table-row-danger td { background: #fff2f0 !important; }
      `}</style>
    </PageLayout>
  )
}
