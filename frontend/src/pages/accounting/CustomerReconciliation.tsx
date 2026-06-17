import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Table, Typography, Statistic, Alert,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { customersApi, Customer } from '../../api/customers'
import { arApi } from '../../api/accounting'
import { exportToExcel, fmtVND, printDocument } from '../../utils/exportUtils'
import { usePhapNhanForPrint, usePhapNhanList } from '../../hooks/usePhapNhan'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

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

interface ReconciliationPayment {
  id: number
  so_phieu: string
  ngay_phieu: string
  so_tien: number
  ghi_chu: string | null
  dien_giai?: string | null
  hinh_thuc_tt?: string | null
}

interface ReconciliationResult {
  customer_id: number
  tu_ngay: string
  den_ngay: string
  phap_nhan_id: number | null
  items: ReconciliationItem[]
  payments: ReconciliationPayment[]
  total_delivery_amount: number
  total_paid_amount: number
  balance: number
}

const fmtNum = (value: number | null | undefined) =>
  value == null ? '-' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(value))

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))

export default function CustomerReconciliation() {
  const [customerId, setCustomerId] = useState<number | undefined>()
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [submitted, setSubmitted] = useState(false)
  const companyInfo = usePhapNhanForPrint(phapNhanId)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const { data: phapNhanList = [] } = usePhapNhanList()

  const { data: result, isLoading, refetch } = useQuery<ReconciliationResult>({
    queryKey: ['customer-reconciliation', customerId, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), phapNhanId],
    queryFn: () => arApi.getReconciliation(customerId!, {
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
      ...(phapNhanId ? { phap_nhan_id: phapNhanId } : {}),
    }),
    enabled: submitted && !!customerId,
  })

  const customer = customers.find(c => c.id === customerId)

  const handleSearch = () => {
    if (!customerId) return
    setSubmitted(true)
    void refetch()
  }

  const deliveryCols: ColumnsType<ReconciliationItem> = [
    { title: 'Ngày', dataIndex: 'ngay', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 140 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'SL', dataIndex: 'so_luong', width: 90, align: 'right', render: fmtNum },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 130, align: 'right', render: fmtVND },
    { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 150, align: 'right', render: v => <Text strong>{fmtVND(v)}</Text> },
  ]

  const { displayColumns: displayDeliveryCols, settingsButton } = useColumnPrefs('accounting-customer-recon', deliveryCols, { nonHideable: ['so_phieu'] })

  const paymentCols: ColumnsType<ReconciliationPayment> = [
    { title: 'Ngày', dataIndex: 'ngay_phieu', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 140 },
    { title: 'Số tiền', dataIndex: 'so_tien', width: 150, align: 'right', render: v => <Text strong style={{ color: '#389e0d' }}>{fmtVND(v)}</Text> },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true, render: (_, r) => r.dien_giai || r.ghi_chu || '-' },
  ]

  const handleExport = () => {
    if (!result) return
    exportToExcel(`doi_chieu_khach_hang_${customer?.ten_viet_tat ?? customerId}_${dates[0].format('YYYYMMDD')}`, [
      {
        name: 'Giao hang',
        headers: ['Ngày', 'Số phiếu', 'Tên hàng', 'Số lượng', 'ĐVT', 'Đơn giá', 'Thành tiền'],
        rows: result.items.map(r => [r.ngay, r.so_phieu, r.ten_hang, r.so_luong, r.dvt, r.don_gia, r.thanh_tien]),
        colWidths: [12, 16, 34, 12, 8, 14, 16],
      },
      {
        name: 'Thanh toan',
        headers: ['Ngày', 'Số phiếu', 'Số tiền', 'Diễn giải'],
        rows: result.payments.map(r => [r.ngay_phieu, r.so_phieu, r.so_tien, r.dien_giai ?? r.ghi_chu ?? '']),
        colWidths: [12, 16, 16, 40],
      },
    ])
  }

  const handlePrint = () => {
    if (!result) return
    const deliveryRows = result.items.map(it => `
      <tr>
        <td class="text-center">${dayjs(it.ngay).format('DD/MM/YYYY')}</td>
        <td>${esc(it.so_phieu)}</td>
        <td>${esc(it.ten_hang)}</td>
        <td class="text-right">${fmtNum(it.so_luong)}</td>
        <td class="text-center">${esc(it.dvt)}</td>
        <td class="text-right">${fmtVND(it.don_gia)}</td>
        <td class="text-right">${fmtVND(it.thanh_tien)}</td>
      </tr>
    `).join('')

    const paymentRows = result.payments.map(p => `
      <tr>
        <td class="text-center">${dayjs(p.ngay_phieu).format('DD/MM/YYYY')}</td>
        <td>${esc(p.so_phieu)}</td>
        <td>${esc(p.dien_giai || p.ghi_chu || '')}</td>
        <td class="text-right">${fmtVND(p.so_tien)}</td>
      </tr>
    `).join('')

    printDocument({
      title: 'BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ KHÁCH HÀNG',
      subtitle: `Từ ngày ${dates[0].format('DD/MM/YYYY')} đến ngày ${dates[1].format('DD/MM/YYYY')}`,
      documentNumber: `DC-KH-${dayjs().format('YYMMDD')}`,
      documentDate: dayjs().format('DD/MM/YYYY'),
      companyInfo,
      fields: [
        { label: 'Khách hàng', value: customer?.ten_don_vi || customer?.ten_viet_tat || '-' },
        { label: 'Địa chỉ', value: customer?.dia_chi || '-' },
        { label: 'Mã số thuế', value: customer?.ma_so_thue || '-' },
      ],
      bodyHtml: `
        <h3>I. Chi tiết giao hàng</h3>
        <table class="doc-table">
          <thead><tr><th>Ngày</th><th>Số phiếu</th><th>Tên hàng</th><th>SL</th><th>ĐVT</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
          <tbody>${deliveryRows || '<tr><td colspan="7" class="text-center">Không có giao hàng trong kỳ</td></tr>'}</tbody>
          <tfoot><tr><td colspan="6" class="text-right"><b>Tổng tiền hàng</b></td><td class="text-right"><b>${fmtVND(result.total_delivery_amount)}</b></td></tr></tfoot>
        </table>
        <h3 style="margin-top:20px;">II. Chi tiết thanh toán</h3>
        <table class="doc-table">
          <thead><tr><th>Ngày</th><th>Số phiếu</th><th>Diễn giải</th><th>Số tiền</th></tr></thead>
          <tbody>${paymentRows || '<tr><td colspan="4" class="text-center">Không có thanh toán trong kỳ</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3" class="text-right"><b>Tổng đã thu</b></td><td class="text-right"><b>${fmtVND(result.total_paid_amount)}</b></td></tr></tfoot>
        </table>
        <h3 style="margin-top:20px;">Số dư còn phải thu: ${fmtVND(result.balance)}</h3>
      `,
    }, true)
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Đối chiếu công nợ khách hàng</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="bottom">
          <Col xs={24} md={7}>
            <Text type="secondary">Khách hàng</Text>
            <Select
              showSearch
              placeholder="Chọn khách hàng"
              style={{ width: '100%', marginTop: 4 }}
              value={customerId}
              onChange={setCustomerId}
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={customers.map(c => ({ value: c.id, label: c.ten_viet_tat || c.ten_don_vi || `KH-${c.id}` }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <Text type="secondary">Pháp nhân</Text>
            <Select
              allowClear
              placeholder="Tất cả"
              style={{ width: '100%', marginTop: 4 }}
              value={phapNhanId}
              onChange={setPhapNhanId}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <Text type="secondary">Khoảng thời gian</Text>
            <RangePicker
              style={{ width: '100%', marginTop: 4 }}
              value={dates}
              format="DD/MM/YYYY"
              onChange={v => v && setDates(v as [Dayjs, Dayjs])}
            />
          </Col>
          <Col xs={24} md={5}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} loading={isLoading} disabled={!customerId} onClick={handleSearch}>
                Xem
              </Button>
              {result && <Button icon={<FileExcelOutlined />} onClick={handleExport}>Excel</Button>}
              {result && <Button icon={<FilePdfOutlined />} onClick={handlePrint}>Biên bản</Button>}
              {settingsButton}
            </Space>
          </Col>
        </Row>
      </Card>

      {result && !phapNhanId && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Đang đối chiếu tất cả pháp nhân"
          description="Nên lọc một pháp nhân trước khi in biên bản để tránh lẫn công nợ giữa các đơn vị."
        />
      )}

      {result && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}><Card size="small"><Statistic title="Tổng tiền hàng" value={result.total_delivery_amount} formatter={v => fmtVND(Number(v))} /></Card></Col>
            <Col xs={24} md={8}><Card size="small"><Statistic title="Đã thu" value={result.total_paid_amount} formatter={v => fmtVND(Number(v))} valueStyle={{ color: '#389e0d' }} /></Card></Col>
            <Col xs={24} md={8}><Card size="small"><Statistic title="Còn phải thu" value={result.balance} formatter={v => fmtVND(Number(v))} valueStyle={{ color: result.balance > 0 ? '#cf1322' : '#389e0d' }} /></Card></Col>
          </Row>

          <Card title="Chi tiết giao hàng" style={{ marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
            <Table locale={{ emptyText: <EmptyState size="small" preset="document" /> }} rowKey={(r, i) => `${r.so_phieu}-${i}`} size="small" pagination={false} dataSource={result.items} columns={displayDeliveryCols} scroll={{ x: 820 }} />
          </Card>

          <Card title="Chi tiết thanh toán" styles={{ body: { padding: 0 } }}>
            <Table locale={{ emptyText: <EmptyState size="small" preset="document" /> }} rowKey="id" size="small" pagination={false} dataSource={result.payments} columns={paymentCols} scroll={{ x: 620 }} />
          </Card>
        </>
      )}

      {!result && !isLoading && (
        <Card>
          <EmptyState preset="document" title="Chọn khách hàng và khoảng thời gian để xem đối chiếu" />
        </Card>
      )}
    </div>
  )
}
