import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Table, Typography, Statistic, Divider,
} from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customersApi, Customer } from '../../api/customers'
import { arApi } from '../../api/accounting'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface ReconciliationItem {
  ngay: string
  so_phieu: string
  ten_hang: string
  so_luong: number
  dvt: string
  don_gia: number
  thanh_tien: number
  ghi_chu: string | null
}

interface ReconciliationResult {
  customer_id: number
  tu_ngay: string
  den_ngay: string
  items: ReconciliationItem[]
  payments: { id: number; so_phieu: string; ngay_phieu: string; so_tien: number; ghi_chu: string | null }[]
  total_delivery_amount: number
  total_paid_amount: number
  balance: number
}

export default function CustomerReconciliation() {
  const [customerId, setCustomerId] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [result, setResult] = useState<ReconciliationResult | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const handleSearch = async () => {
    if (!customerId || !dateRange) return
    setLoading(true)
    try {
      const res = await arApi.getLedger({
        customer_id: customerId,
        tu_ngay: dateRange[0],
        den_ngay: dateRange[1],
      }) as unknown as ReconciliationResult
      setResult(res)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const deliveryCols: ColumnsType<ReconciliationItem> = [
    { title: 'Ngày', dataIndex: 'ngay', width: 100, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 130 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'SL', dataIndex: 'so_luong', width: 80, align: 'right', render: v => new Intl.NumberFormat('vi-VN').format(v) },
    { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right', render: v => fmtVND(v) },
    { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right', render: v => <Text strong>{fmtVND(v)}</Text> },
  ]

  const paymentCols = [
    { title: 'Ngày', dataIndex: 'ngay_phieu', width: 100, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 130 },
    { title: 'Số tiền', dataIndex: 'so_tien', width: 150, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#389e0d' }}>{fmtVND(v)}</Text> },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true, render: (v: string | null) => v ?? '—' },
  ]

  const handleExport = () => {
    if (!result) return
    const customer = customers.find(c => c.id === customerId)
    exportToExcel(`doi_chieu_${customer?.ten_viet_tat ?? customerId}_${dateRange?.[0]}`, [
      {
        name: 'Giao hàng',
        headers: ['Ngày', 'Số phiếu', 'Tên hàng', 'Số lượng', 'ĐVT', 'Đơn giá', 'Thành tiền'],
        rows: result.items.map(r => [r.ngay, r.so_phieu, r.ten_hang, r.so_luong, r.dvt, r.don_gia, r.thanh_tien]),
        colWidths: [12, 15, 30, 10, 8, 14, 16],
      },
      {
        name: 'Thanh toán',
        headers: ['Ngày', 'Số phiếu', 'Số tiền', 'Ghi chú'],
        rows: result.payments.map(r => [r.ngay_phieu, r.so_phieu, r.so_tien, r.ghi_chu ?? '']),
        colWidths: [12, 15, 16, 30],
      },
    ])
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Đối chiếu công nợ khách hàng</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8}>
            <Select
              showSearch
              placeholder="Chọn khách hàng"
              style={{ width: '100%' }}
              value={customerId}
              onChange={setCustomerId}
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({ value: c.id, label: c.ten_viet_tat || c.ten_don_vi }))}
            />
          </Col>
          <Col xs={24} sm={10}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              onChange={v =>
                setDateRange(v ? [v[0]!.format('YYYY-MM-DD'), v[1]!.format('YYYY-MM-DD')] : null)
              }
            />
          </Col>
          <Col xs={24} sm={6}>
            <Space>
              <Button
                type="primary"
                loading={loading}
                disabled={!customerId || !dateRange}
                onClick={handleSearch}
              >
                Xem
              </Button>
              {result && (
                <Button icon={<FileExcelOutlined />} onClick={handleExport}>
                  Xuất Excel
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {result && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={8}>
              <Card>
                <Statistic
                  title="Tổng tiền hàng"
                  value={result.total_delivery_amount}
                  formatter={v => fmtVND(Number(v))}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card>
                <Statistic
                  title="Đã thanh toán"
                  value={result.total_paid_amount}
                  formatter={v => fmtVND(Number(v))}
                  valueStyle={{ color: '#389e0d' }}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card>
                <Statistic
                  title="Còn lại"
                  value={result.balance}
                  formatter={v => fmtVND(Number(v))}
                  valueStyle={{ color: result.balance > 0 ? '#cf1322' : '#389e0d' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết giao hàng" style={{ marginBottom: 16 }}>
            <Table
              rowKey={(r, i) => `${r.so_phieu}-${i}`}
              size="small"
              pagination={false}
              dataSource={result.items}
              columns={deliveryCols}
              scroll={{ x: 700 }}
            />
          </Card>

          <Card title="Chi tiết thanh toán">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={result.payments}
              columns={paymentCols}
              scroll={{ x: 500 }}
            />
          </Card>
        </>
      )}

      {!result && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb' }}>
            Chọn khách hàng và khoảng thời gian rồi nhấn Xem
          </div>
        </Card>
      )}
    </div>
  )
}
