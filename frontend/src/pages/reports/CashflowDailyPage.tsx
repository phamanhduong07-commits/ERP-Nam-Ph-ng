import React, { useState } from 'react'
import { Card, Table, DatePicker, Button, Typography, Row, Col, Statistic, Tag, Collapse } from 'antd'
import { SearchOutlined, BankOutlined } from '@ant-design/icons'
import { reportsApi } from '../../api/reports'
import PageLayout from '../../components/PageLayout'
import dayjs from 'dayjs'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography

interface TaiKhoan {
  loai: string
  bank_account_id: number | null
  ten: string
  so_tai_khoan: string | null
  so_du_dau: number
  thu: number
  chi: number
  so_du_cuoi: number
}

interface PhapNhanRow {
  phap_nhan_id: number
  ten_viet_tat: string
  so_du_dau: number
  tong_thu: number
  tong_chi: number
  so_du_cuoi: number
  tai_khoan: TaiKhoan[]
}

interface CashflowDailyData {
  ngay: string
  phap_nhan: PhapNhanRow[]
  tong_cong: { so_du_dau: number; tong_thu: number; tong_chi: number; so_du_cuoi: number }
}

const fmt = (v: number) => v?.toLocaleString('vi-VN') ?? '—'

const CashflowDailyPage: React.FC = () => {
  const [ngay, setNgay] = useState(dayjs())
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CashflowDailyData | null>(null)

  const onSearch = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getCashflowDaily(ngay.format('YYYY-MM-DD'))
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const summaryColumns = [
    { title: 'Pháp nhân', dataIndex: 'ten_viet_tat', key: 'ten',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Số dư đầu ngày', dataIndex: 'so_du_dau', key: 'so_du_dau', align: 'right' as const,
      render: (v: number) => fmt(v) },
    { title: 'Tổng thu', dataIndex: 'tong_thu', key: 'thu', align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#3f8600' }}>{fmt(v)}</Text> },
    { title: 'Tổng chi', dataIndex: 'tong_chi', key: 'chi', align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#cf1322' }}>{fmt(v)}</Text> },
    { title: 'Số dư cuối ngày', dataIndex: 'so_du_cuoi', key: 'cuoi', align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1d3557' }}>{fmt(v)}</Text> },
  ]
  const { displayColumns: displaySummaryColumns, settingsButton } = useColumnPrefs('reports-cashflow-daily', summaryColumns)

  const detailColumns = [
    { title: 'Tài khoản', dataIndex: 'ten', key: 'ten',
      render: (v: string, r: TaiKhoan) => (
        <span>
          {r.loai === 'tien_mat'
            ? <Tag color="green">Tiền mặt</Tag>
            : <Tag color="blue"><BankOutlined /> {v}</Tag>}
          {r.so_tai_khoan && <Text type="secondary" style={{ fontSize: 11 }}> {r.so_tai_khoan}</Text>}
        </span>
      ) },
    { title: 'Số dư đầu', dataIndex: 'so_du_dau', align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'Thu', dataIndex: 'thu', align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#3f8600' }}>{fmt(v)}</Text> },
    { title: 'Chi', dataIndex: 'chi', align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#cf1322' }}>{fmt(v)}</Text> },
    { title: 'Số dư cuối', dataIndex: 'so_du_cuoi', align: 'right' as const,
      render: (v: number) => <Text strong>{fmt(v)}</Text> },
  ]

  const tableData = data ? [
    ...data.phap_nhan,
    { ten_viet_tat: 'TỔNG GROUP', ...data.tong_cong, tai_khoan: [] },
  ] : []

  return (
    <PageLayout title="Báo cáo Dòng tiền Group Hàng ngày">
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Text strong>Ngày: </Text>
            <DatePicker value={ngay} onChange={v => v && setNgay(v)} format="DD/MM/YYYY" />
          </Col>
          <Col>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onSearch}>
              Xem báo cáo
            </Button>
          </Col>
        </Row>
      </Card>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card><Statistic title="Số dư đầu ngày (Group)" value={data.tong_cong.so_du_dau}
                formatter={v => fmt(Number(v))} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Tổng thu" value={data.tong_cong.tong_thu}
                valueStyle={{ color: '#3f8600' }} formatter={v => fmt(Number(v))} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Tổng chi" value={data.tong_cong.tong_chi}
                valueStyle={{ color: '#cf1322' }} formatter={v => fmt(Number(v))} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Số dư cuối ngày (Group)" value={data.tong_cong.so_du_cuoi}
                valueStyle={{ color: '#1d3557' }} formatter={v => fmt(Number(v))} /></Card>
            </Col>
          </Row>

          <Card title="Tổng hợp theo Pháp nhân" style={{ marginBottom: 24 }} extra={settingsButton}>
            <Table
              columns={displaySummaryColumns}
              dataSource={tableData}
              rowKey={(r: any) => r.phap_nhan_id ?? 'total'}
              pagination={false}
              bordered
              rowClassName={(r: any) => r.ten_viet_tat === 'TỔNG GROUP' ? 'ant-table-row-total' : ''}
            />
          </Card>

          <Card title="Chi tiết theo Tài khoản">
            <Collapse>
              {data.phap_nhan.map(pn => (
                <Collapse.Panel
                  key={pn.phap_nhan_id}
                  header={
                    <span>
                      <Text strong>{pn.ten_viet_tat}</Text>
                      <Text type="secondary" style={{ marginLeft: 12 }}>
                        Tổng thu: <Text style={{ color: '#3f8600' }}>{fmt(pn.tong_thu)}</Text>
                        &nbsp;|&nbsp;Tổng chi: <Text style={{ color: '#cf1322' }}>{fmt(pn.tong_chi)}</Text>
                        &nbsp;|&nbsp;Số dư cuối: <Text strong>{fmt(pn.so_du_cuoi)}</Text>
                      </Text>
                    </span>
                  }
                >
                  <Table
                    columns={detailColumns}
                    dataSource={pn.tai_khoan}
                    rowKey={(r: TaiKhoan) => r.bank_account_id ?? 'cash'}
                    pagination={false}
                    size="small"
                    bordered
                  />
                </Collapse.Panel>
              ))}
            </Collapse>
          </Card>
        </>
      )}
    </PageLayout>
  )
}

export default CashflowDailyPage
