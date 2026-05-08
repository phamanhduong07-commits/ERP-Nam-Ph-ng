import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Row, Select, Space, Spin, Switch,
  Table, Tabs, Tag, Typography,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND } from '../../utils/exportUtils'
import { arApi, ARLedgerEntryRow, ARLedgerRow, ARAgingRow } from '../../api/accounting'
import { customersApi, Customer } from '../../api/customers'
import { TRANG_THAI_INVOICE } from '../../api/billing'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ── Tab 1: Sổ chi tiết ──────────────────────────────────────────────────────

function LedgerTab() {
  const navigate = useNavigate()
  const [customerId, setCustomerId] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [quaHanOnly, setQuaHanOnly] = useState(false)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const { data: rows = [], isLoading } = useQuery<ARLedgerRow[]>({
    queryKey: ['ar-ledger', customerId, tuNgay, denNgay, quaHanOnly],
    queryFn: () =>
      arApi.getLedger({ customer_id: customerId, tu_ngay: tuNgay, den_ngay: denNgay, qua_han_only: quaHanOnly }),
  })

  const tongConLai = rows.reduce((s, r) => s + (r.con_lai ?? 0), 0)
  const tongPhatSinh = rows.reduce((s, r) => s + (r.tong_cong ?? 0), 0)

  const handleExcel = () => {
    const data = rows.map(r => ({
      'Số HĐ': r.so_hoa_don ?? '',
      'Ngày HĐ': r.ngay_hoa_don,
      'Hạn TT': r.han_tt ?? '',
      'Khách hàng': r.ten_don_vi ?? '',
      'Tổng cộng': r.tong_cong,
      'Đã TT': r.da_thanh_toan,
      'Còn lại': r.con_lai,
      'Ngày quá hạn': r.so_ngay_qua_han > 0 ? r.so_ngay_qua_han : '',
      'Trạng thái': TRANG_THAI_INVOICE[r.trang_thai]?.label ?? r.trang_thai,
    }))
    exportToExcel(`so-cong-no-phai-thu-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Cong no phai thu',
      headers: Object.keys(data[0] ?? {}),
      rows: data.map(r => Object.values(r)),
    }])
  }

  const handlePrint = () => {
    const headers = ['Số HĐ', 'Ngày HĐ', 'Hạn TT', 'Khách hàng', 'Tổng cộng', 'Đã TT', 'Còn lại', 'Trạng thái']
    const data = rows.map(r => [
      r.so_hoa_don ?? '',
      dayjs(r.ngay_hoa_don).format('DD/MM/YYYY'),
      r.han_tt ? dayjs(r.han_tt).format('DD/MM/YYYY') : '—',
      r.ten_don_vi ?? '',
      fmtVND(r.tong_cong),
      fmtVND(r.da_thanh_toan),
      fmtVND(r.con_lai),
      TRANG_THAI_INVOICE[r.trang_thai]?.label ?? r.trang_thai,
    ])
    printToPdf('Sổ công nợ phải thu', buildHtmlTable(headers.map(header => ({ header })), data))
  }

  const columns: ColumnsType<ARLedgerRow> = [
    {
      title: 'Số hóa đơn',
      dataIndex: 'so_hoa_don',
      width: 140,
      render: (v, r) => (
        <a onClick={() => navigate(`/billing/invoices/${r.invoice_id}`)}>{v ?? `#${r.invoice_id}`}</a>
      ),
    },
    {
      title: 'Ngày HĐ',
      dataIndex: 'ngay_hoa_don',
      width: 100,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Hạn TT',
      dataIndex: 'han_tt',
      width: 100,
      render: (v, r) => {
        if (!v) return '—'
        return (
          <span style={{ color: r.so_ngay_qua_han > 0 ? '#f5222d' : undefined }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        )
      },
    },
    { title: 'Khách hàng', dataIndex: 'ten_don_vi', ellipsis: true },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_cong',
      align: 'right',
      width: 130,
      render: v => fmtVND(v),
    },
    {
      title: 'Đã TT',
      dataIndex: 'da_thanh_toan',
      align: 'right',
      width: 130,
      render: v => fmtVND(v),
    },
    {
      title: 'Còn lại',
      dataIndex: 'con_lai',
      align: 'right',
      width: 130,
      render: (v, r) => (
        <Text strong style={{ color: v > 0 ? (r.so_ngay_qua_han > 0 ? '#f5222d' : '#fa8c16') : '#52c41a' }}>
          {fmtVND(v)}
        </Text>
      ),
    },
    {
      title: 'Quá hạn',
      dataIndex: 'so_ngay_qua_han',
      width: 90,
      align: 'right',
      render: v => v > 0 ? <Text type="danger">{v} ngày</Text> : '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 140,
      render: v => {
        const s = TRANG_THAI_INVOICE[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <Select
              style={{ width: 220 }} allowClear showSearch placeholder="Lọc khách hàng"
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({
                value: c.id,
                label: `${c.ma_kh ? `[${c.ma_kh}] ` : ''}${c.ten_don_vi ?? ''}`,
              }))}
              onChange={v => setCustomerId(v)}
            />
          </Col>
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày HĐ', 'Đến ngày HĐ']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
              }}
            />
          </Col>
          <Col>
            <Space>
              <span style={{ fontSize: 13 }}>Chỉ quá hạn</span>
              <Switch checked={quaHanOnly} onChange={setQuaHanOnly} />
            </Space>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <Space>
              <Button size="small" icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
              <Button size="small" icon={<FilePdfOutlined />} onClick={handlePrint}>In</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      <Row gutter={24} style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tổng phát sinh: </Text>
          <Text strong>{fmtVND(tongPhatSinh)}</Text>
        </Col>
        <Col>
          <Text type="secondary">Tổng còn lại: </Text>
          <Text strong style={{ color: tongConLai > 0 ? '#fa8c16' : '#52c41a' }}>{fmtVND(tongConLai)}</Text>
        </Col>
        <Col>
          <Text type="secondary">Số hóa đơn: </Text>
          <Text strong>{rows.length}</Text>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="invoice_id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showTotal: t => `${t} hóa đơn` }}
        rowClassName={r => r.so_ngay_qua_han > 0 ? 'row-overdue' : ''}
      />
      <style>{`.row-overdue td { background: #fff1f0 !important; }`}</style>
    </>
  )
}

// ── Tab 2: Tuổi nợ (Aging) ──────────────────────────────────────────────────

function AgingTab() {
  const navigate = useNavigate()
  const [asOfDate, setAsOfDate] = useState<string | undefined>()
  const [selectedCustomer, setSelectedCustomer] = useState<ARAgingRow | null>(null)

  const { data: rows = [], isLoading } = useQuery<ARAgingRow[]>({
    queryKey: ['ar-aging', asOfDate],
    queryFn: () => arApi.getAging(asOfDate),
  })

  const { data: detailRows = [], isLoading: isDetailLoading } = useQuery<ARLedgerRow[]>({
    queryKey: ['ar-ledger-customer-detail', selectedCustomer?.customer_id, asOfDate],
    queryFn: () => arApi.getLedger({ customer_id: selectedCustomer?.customer_id, den_ngay: asOfDate }),
    enabled: !!selectedCustomer?.customer_id,
  })
  const unpaidDetailRows = detailRows.filter(r => (r.con_lai ?? 0) > 0)

  const totals = rows.reduce(
    (acc, r) => ({
      tong_con_lai: acc.tong_con_lai + r.tong_con_lai,
      trong_han: acc.trong_han + r.trong_han,
      qua_han_30: acc.qua_han_30 + r.qua_han_30,
      qua_han_60: acc.qua_han_60 + r.qua_han_60,
      qua_han_90: acc.qua_han_90 + r.qua_han_90,
    }),
    { tong_con_lai: 0, trong_han: 0, qua_han_30: 0, qua_han_60: 0, qua_han_90: 0 }
  )

  const handleExcel = () => {
    const data = rows.map(r => ({
      'Khách hàng': r.ten_don_vi ?? '',
      'Tổng còn lại': r.tong_con_lai,
      'Trong hạn': r.trong_han,
      '1–30 ngày': r.qua_han_30,
      '31–60 ngày': r.qua_han_60,
      '>60 ngày': r.qua_han_90,
    }))
    exportToExcel(`tuoi-no-phai-thu-${asOfDate ?? dayjs().format('YYYYMMDD')}`, [{
      name: 'Tuoi no phai thu',
      headers: Object.keys(data[0] ?? {}),
      rows: data.map(r => Object.values(r)),
    }])
  }

  const columns: ColumnsType<ARAgingRow> = [
    {
      title: 'Khách hàng',
      dataIndex: 'ten_don_vi',
      ellipsis: true,
      render: (v, r) => <a onClick={() => setSelectedCustomer(r)}>{v ?? '—'}</a>,
    },
    {
      title: 'Tổng còn lại',
      dataIndex: 'tong_con_lai',
      align: 'right',
      width: 140,
      render: v => <Text strong>{fmtVND(v)}</Text>,
    },
    {
      title: 'Trong hạn',
      dataIndex: 'trong_han',
      align: 'right',
      width: 130,
      render: v => <span style={{ color: '#52c41a' }}>{fmtVND(v)}</span>,
    },
    {
      title: '1–30 ngày',
      dataIndex: 'qua_han_30',
      align: 'right',
      width: 120,
      render: v => v > 0 ? <span style={{ color: '#faad14' }}>{fmtVND(v)}</span> : '—',
    },
    {
      title: '31–60 ngày',
      dataIndex: 'qua_han_60',
      align: 'right',
      width: 120,
      render: v => v > 0 ? <span style={{ color: '#fa8c16' }}>{fmtVND(v)}</span> : '—',
    },
    {
      title: '>60 ngày',
      dataIndex: 'qua_han_90',
      align: 'right',
      width: 120,
      render: v => v > 0 ? <span style={{ color: '#f5222d' }}>{fmtVND(v)}</span> : '—',
    },
    {
      title: 'Thao tác',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => setSelectedCustomer(r)}>Chi tiết</Button>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(`/accounting/receipts/new?customer_id=${r.customer_id}&amount=${r.tong_con_lai}`)}
          />
        </Space>
      ),
    },
  ]

  const detailColumns: ColumnsType<ARLedgerRow> = [
    {
      title: 'Số hóa đơn',
      dataIndex: 'so_hoa_don',
      width: 130,
      render: (v, r) => <a onClick={() => navigate(`/billing/invoices/${r.invoice_id}`)}>{v ?? `#${r.invoice_id}`}</a>,
    },
    { title: 'Ngày HĐ', dataIndex: 'ngay_hoa_don', width: 100, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Hạn TT', dataIndex: 'han_tt', width: 100, render: v => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Tổng cộng', dataIndex: 'tong_cong', width: 120, align: 'right', render: v => fmtVND(v) },
    { title: 'Đã TT', dataIndex: 'da_thanh_toan', width: 120, align: 'right', render: v => fmtVND(v) },
    {
      title: 'Còn lại',
      dataIndex: 'con_lai',
      width: 120,
      align: 'right',
      render: v => <Text strong style={{ color: '#fa8c16' }}>{fmtVND(v)}</Text>,
    },
    {
      title: '',
      width: 110,
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          onClick={() => navigate(`/accounting/receipts/new?customer_id=${r.customer_id}&invoice_id=${r.invoice_id}&amount=${r.con_lai}`)}
        >
          Thu tiền
        </Button>
      ),
    },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <Space>
              <span style={{ fontSize: 13 }}>Tính đến ngày:</span>
              <DatePicker
                format="DD/MM/YYYY"
                placeholder="Hôm nay"
                onChange={v => setAsOfDate(v?.format('YYYY-MM-DD'))}
              />
            </Space>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <Button size="small" icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          </Col>
        </Row>
      </Card>

      {/* Summary buckets */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {[
          { label: 'Tổng dư nợ', value: totals.tong_con_lai, color: '#1677ff' },
          { label: 'Trong hạn', value: totals.trong_han, color: '#52c41a' },
          { label: '1–30 ngày', value: totals.qua_han_30, color: '#faad14' },
          { label: '31–60 ngày', value: totals.qua_han_60, color: '#fa8c16' },
          { label: '>60 ngày', value: totals.qua_han_90, color: '#f5222d' },
        ].map(item => (
          <Col key={item.label}>
            <Card size="small" style={{ minWidth: 150, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#666' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: item.color }}>{fmtVND(item.value)}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="customer_id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showTotal: t => `${t} khách hàng` }}
        summary={() => (
          <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
            <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">{fmtVND(totals.tong_con_lai)}</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">{fmtVND(totals.trong_han)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">{fmtVND(totals.qua_han_30)}</Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">{fmtVND(totals.qua_han_60)}</Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">{fmtVND(totals.qua_han_90)}</Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      <Drawer
        title={selectedCustomer ? `Chi tiết công nợ - ${selectedCustomer.ten_don_vi ?? ''}` : 'Chi tiết công nợ'}
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        width={900}
        extra={selectedCustomer && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(`/accounting/receipts/new?customer_id=${selectedCustomer.customer_id}&amount=${selectedCustomer.tong_con_lai}`)}
          >
            Lập phiếu thu
          </Button>
        )}
      >
        {selectedCustomer && (
          <>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col><Text type="secondary">Tổng còn lại: </Text><Text strong>{fmtVND(selectedCustomer.tong_con_lai)}</Text></Col>
              <Col><Text type="secondary">Trong hạn: </Text><Text strong style={{ color: '#52c41a' }}>{fmtVND(selectedCustomer.trong_han)}</Text></Col>
              <Col>
                <Text type="secondary">Quá hạn: </Text>
                <Text strong style={{ color: '#f5222d' }}>
                  {fmtVND(selectedCustomer.qua_han_30 + selectedCustomer.qua_han_60 + selectedCustomer.qua_han_90)}
                </Text>
              </Col>
            </Row>
            <Table
              rowKey="invoice_id"
              columns={detailColumns}
              dataSource={unpaidDetailRows}
              loading={isDetailLoading}
              size="small"
              pagination={{ pageSize: 20, showTotal: t => `${t} hóa đơn còn nợ` }}
            />
          </>
        )}
      </Drawer>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

function LedgerEntriesTab() {
  const navigate = useNavigate()
  const [customerId, setCustomerId] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ar-ledger-entries', customerId, tuNgay, denNgay],
    queryFn: () => arApi.getLedgerEntries({ customer_id: customerId, tu_ngay: tuNgay, den_ngay: denNgay }),
  })
  const rows = data?.rows ?? []

  const openDocument = (r: ARLedgerEntryRow) => {
    if (r.chung_tu_loai === 'hoa_don_ban' && r.chung_tu_id) navigate(`/billing/invoices/${r.chung_tu_id}`)
    if (r.chung_tu_loai === 'phieu_thu' && r.chung_tu_id) navigate(`/accounting/receipts/${r.chung_tu_id}`)
  }

  const columns: ColumnsType<ARLedgerEntryRow> = [
    { title: 'Ngày', dataIndex: 'ngay', width: 100, render: v => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Chứng từ',
      dataIndex: 'so_chung_tu',
      width: 140,
      render: (v, r) => r.chung_tu_id ? <a onClick={() => openDocument(r)}>{v ?? `#${r.chung_tu_id}`}</a> : (v ?? '—'),
    },
    { title: 'Khách hàng', dataIndex: 'ten_don_vi', width: 220, ellipsis: true },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true },
    { title: 'Nợ', dataIndex: 'phat_sinh_no', width: 130, align: 'right', render: v => v > 0 ? fmtVND(v) : '—' },
    { title: 'Có', dataIndex: 'phat_sinh_co', width: 130, align: 'right', render: v => v > 0 ? <Text style={{ color: '#52c41a' }}>{fmtVND(v)}</Text> : '—' },
    { title: 'Số dư', dataIndex: 'so_du', width: 130, align: 'right', render: v => <Text strong>{fmtVND(v)}</Text> },
  ]

  const handleExcel = () => {
    const excelRows = rows.map(r => ({
      'Ngày': r.ngay,
      'Chứng từ': r.so_chung_tu ?? '',
      'Khách hàng': r.ten_don_vi ?? '',
      'Diễn giải': r.dien_giai ?? '',
      'Nợ': r.phat_sinh_no,
      'Có': r.phat_sinh_co,
      'Số dư': r.so_du,
    }))
    exportToExcel(`so-cong-no-phai-thu-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Cong no phai thu',
      headers: Object.keys(excelRows[0] ?? {}),
      rows: excelRows.map(r => Object.values(r)),
    }])
  }

  const handlePrint = () => {
    const headers = ['Ngày', 'Chứng từ', 'Khách hàng', 'Diễn giải', 'Nợ', 'Có', 'Số dư']
    const printRows = rows.map(r => [
      dayjs(r.ngay).format('DD/MM/YYYY'),
      r.so_chung_tu ?? '',
      r.ten_don_vi ?? '',
      r.dien_giai ?? '',
      fmtVND(r.phat_sinh_no),
      fmtVND(r.phat_sinh_co),
      fmtVND(r.so_du),
    ])
    printToPdf('Sổ công nợ phải thu', buildHtmlTable(headers.map(header => ({ header })), printRows))
  }

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <Select
              style={{ width: 220 }} allowClear showSearch placeholder="Lọc khách hàng"
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({
                value: c.id,
                label: `${c.ma_kh ? `[${c.ma_kh}] ` : ''}${c.ten_don_vi ?? ''}`,
              }))}
              onChange={v => setCustomerId(v)}
            />
          </Col>
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
              }}
            />
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <Space>
              <Button size="small" icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
              <Button size="small" icon={<FilePdfOutlined />} onClick={handlePrint}>In</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={24} style={{ marginBottom: 12 }}>
        <Col><Text type="secondary">Đầu kỳ: </Text><Text strong>{fmtVND(data?.so_du_dau_ky ?? 0)}</Text></Col>
        <Col><Text type="secondary">Nợ: </Text><Text strong>{fmtVND(data?.phat_sinh_no ?? 0)}</Text></Col>
        <Col><Text type="secondary">Có: </Text><Text strong style={{ color: '#52c41a' }}>{fmtVND(data?.phat_sinh_co ?? 0)}</Text></Col>
        <Col><Text type="secondary">Cuối kỳ: </Text><Text strong style={{ color: (data?.so_du_cuoi_ky ?? 0) > 0 ? '#fa8c16' : '#52c41a' }}>{fmtVND(data?.so_du_cuoi_ky ?? 0)}</Text></Col>
      </Row>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showTotal: t => `${t} chứng từ` }}
      />
    </>
  )
}

export default function ARLedgerPage() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Sổ công nợ phải thu</Title>
      <Tabs
        defaultActiveKey="ledger"
        items={[
          { key: 'ledger', label: 'Sổ chi tiết', children: <LedgerEntriesTab /> },
          { key: 'aging',  label: 'Tuổi nợ',     children: <AgingTab /> },
        ]}
      />
    </div>
  )
}
