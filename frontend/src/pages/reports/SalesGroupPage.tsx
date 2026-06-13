import React, { useState } from 'react'
import { Card, Table, DatePicker, Button, Typography, Row, Col, Progress, Statistic } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { reportsApi } from '../../api/reports'
import PageLayout from '../../components/PageLayout'
import dayjs from 'dayjs'

const { Text } = Typography

interface XuongRow {
  phan_xuong_id: number | null
  ten: string
  muc_tieu_thang: number
  thuc_hien: number
  ty_le: number | null
}

interface NgayRow {
  ngay: string
  values: Record<string, number>
  total: number
}

interface SalesGroupData {
  tu_ngay: string
  den_ngay: string
  xuong: XuongRow[]
  theo_ngay: NgayRow[]
}

const fmt = (v: number) => v?.toLocaleString('vi-VN') ?? '—'
const pct = (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : '—'

const SalesGroupPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'), dayjs()
  ])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SalesGroupData | null>(null)

  const onSearch = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getSalesByWorkshop({
        tu_ngay: range[0].format('YYYY-MM-DD'),
        den_ngay: range[1].format('YYYY-MM-DD'),
      })
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const xuongColumns = [
    { title: 'Phân xưởng', dataIndex: 'ten', key: 'ten',
      render: (v: string, r: XuongRow) => <Text strong={r.phan_xuong_id === null}>{v}</Text> },
    { title: 'Mục tiêu tháng', dataIndex: 'muc_tieu_thang', key: 'mt', align: 'right' as const,
      render: (v: number) => fmt(v) },
    { title: 'Thực hiện', dataIndex: 'thuc_hien', key: 'th', align: 'right' as const,
      render: (v: number) => fmt(v) },
    { title: '% Đạt', dataIndex: 'ty_le', key: 'tl', align: 'center' as const, width: 200,
      render: (v: number | null) => (
        v != null
          ? <Progress percent={Math.round(v * 100)} size="small"
              status={v >= 1 ? 'success' : v >= 0.8 ? 'normal' : 'exception'} />
          : '—'
      ) },
    { title: 'Còn lại', key: 'con_lai', align: 'right' as const,
      render: (_: unknown, r: XuongRow) => {
        const cl = r.muc_tieu_thang - r.thuc_hien
        return <Text type={cl <= 0 ? 'success' : 'danger'}>{fmt(cl)}</Text>
      } },
  ]

  const totalRow = data?.xuong.find(x => x.phan_xuong_id === null)

  return (
    <PageLayout title="Báo cáo Doanh số Group theo Phân xưởng">
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Text strong>Kỳ: </Text>
            <DatePicker.RangePicker
              value={range}
              onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
              format="DD/MM/YYYY"
              picker="date"
            />
          </Col>
          <Col>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onSearch}>
              Xem doanh số
            </Button>
          </Col>
        </Row>
      </Card>

      {data && (
        <>
          {totalRow && (
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card>
                  <Statistic title="Mục tiêu tháng (Group)" value={totalRow.muc_tieu_thang}
                    formatter={v => fmt(Number(v))} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title="Thực hiện" value={totalRow.thuc_hien}
                    formatter={v => fmt(Number(v))} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title="% Đạt mục tiêu"
                    value={totalRow.ty_le != null ? totalRow.ty_le * 100 : 0}
                    precision={1} suffix="%" />
                </Card>
              </Col>
            </Row>
          )}

          <Card title="Tổng hợp theo Phân xưởng" style={{ marginBottom: 24 }}>
            <Table
              columns={xuongColumns}
              dataSource={data.xuong}
              rowKey={(r: XuongRow) => String(r.phan_xuong_id)}
              pagination={false}
              bordered
              rowClassName={(r: XuongRow) => r.phan_xuong_id === null ? 'ant-table-row-total' : ''}
            />
          </Card>

          <Card title="Doanh số theo Ngày">
            <Table
              columns={[
                { title: 'Ngày', dataIndex: 'ngay', key: 'ngay', width: 120,
                  render: (v: string) => dayjs(v).format('DD/MM') },
                ...data.xuong.filter(x => x.phan_xuong_id !== null).map(px => ({
                  title: px.ten,
                  key: `px_${px.phan_xuong_id}`,
                  align: 'right' as const,
                  render: (_: unknown, r: NgayRow) => fmt(r.values[String(px.phan_xuong_id)] || 0),
                })),
                { title: 'Tổng', dataIndex: 'total', key: 'total', align: 'right' as const,
                  render: (v: number) => <Text strong>{fmt(v)}</Text> },
              ]}
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
    </PageLayout>
  )
}

export default SalesGroupPage
