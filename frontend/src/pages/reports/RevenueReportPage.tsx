import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Radio, Row, Select, Space, Statistic,
  Table, Tooltip, Typography,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { reportsApi, RevenueKyRow, RevenueCustomerRow } from '../../api/reports'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 10, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#1b168e', borderRadius: 4 }} />
      </div>
      <Text style={{ fontSize: 12, width: 130, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtVND(value)}</Text>
    </div>
  )
}

export default function RevenueReportPage() {
  const today = dayjs()
  const [tuNgay, setTuNgay] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [denNgay, setDenNgay] = useState(today.format('YYYY-MM-DD'))
  const [nhom, setNhom] = useState<'day' | 'month' | 'quarter'>('month')

  const { data, isLoading } = useQuery({
    queryKey: ['report-revenue', tuNgay, denNgay, nhom],
    queryFn: () => reportsApi.getRevenue({ tu_ngay: tuNgay, den_ngay: denNgay, nhom }),
    enabled: !!(tuNgay && denNgay),
  })

  const maxKy = Math.max(...(data?.theo_ky.map(r => r.doanh_thu) ?? [1]))
  const maxKh = Math.max(...(data?.top_khach_hang.map(r => r.doanh_thu) ?? [1]))

  const kyColumns: ColumnsType<RevenueKyRow> = [
    { title: 'Kỳ', dataIndex: 'ky', width: 120 },
    {
      title: 'Doanh thu',
      dataIndex: 'doanh_thu',
      render: (v: number) => <MiniBar value={v} max={maxKy} />,
    },
  ]

  const khColumns: ColumnsType<RevenueCustomerRow> = [
    { title: '#', render: (_, __, i) => i + 1, width: 40, align: 'center' },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
    { title: 'Số đơn', dataIndex: 'so_don', width: 70, align: 'center' },
    {
      title: 'Doanh thu',
      dataIndex: 'doanh_thu',
      render: (v: number) => <MiniBar value={v} max={maxKh} />,
    },
  ]

  const handleExcel = () => {
    if (!data) return
    exportToExcel(`doanh-thu-${dayjs().format('YYYYMMDD')}`, [
      {
        name: 'Theo kỳ',
        headers: ['Kỳ', 'Doanh thu'],
        rows: data.theo_ky.map(r => [r.ky, r.doanh_thu]),
      },
      {
        name: 'Top khách hàng',
        headers: ['Khách hàng', 'Số đơn', 'Doanh thu'],
        rows: data.top_khach_hang.map(r => [r.ten_khach_hang, r.so_don, r.doanh_thu]),
      },
    ])
  }

  const handlePrint = () => {
    if (!data) return
    const body = buildHtmlTable(
      [{ header: 'Kỳ' }, { header: 'Doanh thu' }],
      data.theo_ky.map(r => [r.ky, fmtVND(r.doanh_thu)]),
    )
    printToPdf(`Báo cáo doanh thu ${tuNgay} → ${denNgay}`, body)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Báo cáo doanh thu</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!data}>Excel</Button>
          <Button icon={<FilePdfOutlined />} onClick={handlePrint} disabled={!data}>In</Button>
        </Space>
      </div>

      {/* Filter */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={[dayjs(tuNgay), dayjs(denNgay)]}
            onChange={v => {
              if (v?.[0] && v?.[1]) {
                setTuNgay(v[0].format('YYYY-MM-DD'))
                setDenNgay(v[1].format('YYYY-MM-DD'))
              }
            }}
          />
          <Radio.Group value={nhom} onChange={e => setNhom(e.target.value)} buttonStyle="solid">
            <Radio.Button value="day">Ngày</Radio.Button>
            <Radio.Button value="month">Tháng</Radio.Button>
            <Radio.Button value="quarter">Quý</Radio.Button>
          </Radio.Group>
        </Space>
      </Card>

      {/* KPI */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Tổng doanh thu"
              value={data?.tong_doanh_thu ?? 0}
              formatter={v => fmtVND(Number(v))}
              valueStyle={{ color: '#1b168e' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Số đơn hàng" value={data?.so_don_hang ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Trung bình/đơn"
              value={data && data.so_don_hang > 0 ? data.tong_doanh_thu / data.so_don_hang : 0}
              formatter={v => fmtVND(Number(v))}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Doanh thu theo kỳ">
            <Table
              columns={kyColumns}
              dataSource={data?.theo_ky ?? []}
              rowKey="ky"
              loading={isLoading}
              size="small"
              pagination={false}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><Text strong>Tổng</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong style={{ float: 'right' }}>{fmtVND(data?.tong_doanh_thu ?? 0)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Top 10 khách hàng">
            <Table
              columns={khColumns}
              dataSource={data?.top_khach_hang ?? []}
              rowKey="customer_id"
              loading={isLoading}
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
