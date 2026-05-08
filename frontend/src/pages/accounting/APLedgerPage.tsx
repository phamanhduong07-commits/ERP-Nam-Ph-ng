import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Switch,
  Table, Tabs, Tag, Typography,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND } from '../../utils/exportUtils'
import { apApi, APLedgerRow, APAgingRow, SoChiTietRow, SoChiTietResponse, TRANG_THAI_PO_INVOICE } from '../../api/accounting'
import { suppliersApi, Supplier } from '../../api/suppliers'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ── Tab 1: Sổ chi tiết ──────────────────────────────────────────────────────

function LedgerTab() {
  const navigate = useNavigate()
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [quaHanOnly, setQuaHanOnly] = useState(false)

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: rows = [], isLoading } = useQuery<APLedgerRow[]>({
    queryKey: ['ap-ledger', supplierId, tuNgay, denNgay, quaHanOnly],
    queryFn: () =>
      apApi.getLedger({ supplier_id: supplierId, tu_ngay: tuNgay, den_ngay: denNgay, qua_han_only: quaHanOnly }),
  })

  const tongConLai = rows.reduce((s, r) => s + (r.con_lai ?? 0), 0)
  const tongPhatSinh = rows.reduce((s, r) => s + (r.tong_thanh_toan ?? 0), 0)

  const handleExcel = () => {
    const data = rows.map(r => ({
      'Số HĐ': r.so_hoa_don ?? '',
      'Ngày lập': r.ngay_lap,
      'Hạn TT': r.han_tt ?? '',
      'Nhà cung cấp': r.ten_don_vi ?? '',
      'Tổng cộng': r.tong_thanh_toan,
      'Đã TT': r.da_thanh_toan,
      'Còn lại': r.con_lai,
      'Ngày quá hạn': r.so_ngay_qua_han > 0 ? r.so_ngay_qua_han : '',
      'Trạng thái': TRANG_THAI_PO_INVOICE[r.trang_thai]?.label ?? r.trang_thai,
    }))
    exportToExcel(`so-cong-no-phai-tra-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Cong no phai tra',
      headers: Object.keys(data[0] ?? {}),
      rows: data.map(r => Object.values(r)),
    }])
  }

  const handlePrint = () => {
    const headers = ['Số HĐ', 'Ngày lập', 'Hạn TT', 'Nhà cung cấp', 'Tổng cộng', 'Đã TT', 'Còn lại', 'Trạng thái']
    const data = rows.map(r => [
      r.so_hoa_don ?? '',
      dayjs(r.ngay_lap).format('DD/MM/YYYY'),
      r.han_tt ? dayjs(r.han_tt).format('DD/MM/YYYY') : '—',
      r.ten_don_vi ?? '',
      fmtVND(r.tong_thanh_toan),
      fmtVND(r.da_thanh_toan),
      fmtVND(r.con_lai),
      TRANG_THAI_PO_INVOICE[r.trang_thai]?.label ?? r.trang_thai,
    ])
    printToPdf('Sổ công nợ phải trả', buildHtmlTable(headers.map(header => ({ header })), data))
  }

  const columns: ColumnsType<APLedgerRow> = [
    {
      title: 'Số hóa đơn',
      dataIndex: 'so_hoa_don',
      width: 140,
      render: (v, r) => (
        <a onClick={() => navigate(`/accounting/purchase-invoices/${r.invoice_id}`)}>{v ?? `#${r.invoice_id}`}</a>
      ),
    },
    {
      title: 'Ngày lập',
      dataIndex: 'ngay_lap',
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
    { title: 'Nhà cung cấp', dataIndex: 'ten_don_vi', ellipsis: true },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_thanh_toan',
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
        const s = TRANG_THAI_PO_INVOICE[v]
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
              style={{ width: 220 }} allowClear showSearch placeholder="Lọc nhà cung cấp"
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map(s => ({
                value: s.id,
                label: `${s.ma_ncc ? `[${s.ma_ncc}] ` : ''}${s.ten_don_vi ?? ''}`,
              }))}
              onChange={v => setSupplierId(v)}
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

      <Row gutter={24} style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tổng phát sinh: </Text>
          <Text strong>{fmtVND(tongPhatSinh)}</Text>
        </Col>
        <Col>
          <Text type="secondary">Tổng còn nợ: </Text>
          <Text strong style={{ color: tongConLai > 0 ? '#f5222d' : '#52c41a' }}>{fmtVND(tongConLai)}</Text>
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

// ── Tab 2: Tuổi nợ ──────────────────────────────────────────────────────────

function AgingTab() {
  const [asOfDate, setAsOfDate] = useState<string | undefined>()

  const { data: rows = [], isLoading } = useQuery<APAgingRow[]>({
    queryKey: ['ap-aging', asOfDate],
    queryFn: () => apApi.getAging(asOfDate),
  })

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
      'Nhà cung cấp': r.ten_don_vi ?? '',
      'Tổng còn lại': r.tong_con_lai,
      'Trong hạn': r.trong_han,
      '1–30 ngày': r.qua_han_30,
      '31–60 ngày': r.qua_han_60,
      '>60 ngày': r.qua_han_90,
    }))
    exportToExcel(`tuoi-no-phai-tra-${asOfDate ?? dayjs().format('YYYYMMDD')}`, [{
      name: 'Tuoi no phai tra',
      headers: Object.keys(data[0] ?? {}),
      rows: data.map(r => Object.values(r)),
    }])
  }

  const columns: ColumnsType<APAgingRow> = [
    { title: 'Nhà cung cấp', dataIndex: 'ten_don_vi', ellipsis: true, render: v => v ?? '—' },
    {
      title: 'Tổng còn nợ',
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

      <Row gutter={12} style={{ marginBottom: 12 }}>
        {[
          { label: 'Tổng còn nợ', value: totals.tong_con_lai, color: '#1677ff' },
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
        rowKey="supplier_id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showTotal: t => `${t} nhà cung cấp` }}
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
    </>
  )
}

// ── Tab 3: Sổ chi tiết NCC (journal-style) ──────────────────────────────────

function SoChiTietTab() {
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [denNgay, setDenNgay] = useState(dayjs().format('YYYY-MM-DD'))
  const [enabled, setEnabled] = useState(true)

  const { data: suppliers = [] } = useQuery<import('../../api/suppliers').Supplier[]>({
    queryKey: ['suppliers-all'],
    queryFn: () => import('../../api/suppliers').then(m => m.suppliersApi.all()).then(r => r.data),
  })

  const { data, isLoading } = useQuery<SoChiTietResponse>({
    queryKey: ['ap-so-chi-tiet', supplierId, tuNgay, denNgay],
    queryFn: () => apApi.getSoChiTiet({ supplier_id: supplierId, tu_ngay: tuNgay, den_ngay: denNgay }),
    enabled,
  })

  const rows = data?.rows ?? []
  const tongNo = rows.reduce((s, r) => s + r.phat_sinh_no, 0)
  const tongCo = rows.reduce((s, r) => s + r.phat_sinh_co, 0)

  const LOAI_LABEL: Record<string, string> = {
    hoa_don_mua: 'HĐ mua',
    phieu_chi: 'Phiếu chi',
    tra_hang_mua: 'Trả hàng',
    hoa_don_ban: 'HĐ bán',
    phieu_thu: 'Phiếu thu',
  }

  const handleExcel = () => {
    const exRows = rows.map(r => ({
      'Ngày': dayjs(r.ngay).format('DD/MM/YYYY'),
      'Loại chứng từ': LOAI_LABEL[r.chung_tu_loai] ?? r.chung_tu_loai,
      'Nhà cung cấp': r.ten_ncc ?? '',
      'Diễn giải': r.dien_giai ?? '',
      'Phát sinh Nợ': r.phat_sinh_no,
      'Phát sinh Có': r.phat_sinh_co,
      'Số dư': r.so_du,
    }))
    exportToExcel(`so-chi-tiet-ncc-${dayjs().format('YYYYMMDD')}`, [{
      name: 'So chi tiet NCC',
      headers: Object.keys(exRows[0] ?? {}),
      rows: exRows.map(r => Object.values(r)),
    }])
  }

  const columns: ColumnsType<SoChiTietRow> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 100,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Loại chứng từ',
      dataIndex: 'chung_tu_loai',
      width: 110,
      render: v => <Tag>{LOAI_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'ten_ncc',
      width: 180,
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Diễn giải',
      dataIndex: 'dien_giai',
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Phát sinh Nợ',
      dataIndex: 'phat_sinh_no',
      align: 'right',
      width: 140,
      render: v => v > 0 ? <Text style={{ color: '#1677ff' }}>{fmtVND(v)}</Text> : '—',
    },
    {
      title: 'Phát sinh Có',
      dataIndex: 'phat_sinh_co',
      align: 'right',
      width: 140,
      render: v => v > 0 ? <Text style={{ color: '#52c41a' }}>{fmtVND(v)}</Text> : '—',
    },
    {
      title: 'Số dư',
      dataIndex: 'so_du',
      align: 'right',
      width: 140,
      render: v => <Text strong style={{ color: v > 0 ? '#fa8c16' : '#52c41a' }}>{fmtVND(Math.abs(v))}</Text>,
    },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <Select
              style={{ width: 220 }} allowClear showSearch placeholder="Tất cả nhà cung cấp"
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map((s: any) => ({
                value: s.id,
                label: `${s.ma_ncc ? `[${s.ma_ncc}] ` : ''}${s.ten_don_vi ?? ''}`,
              }))}
              onChange={v => { setSupplierId(v); setEnabled(true) }}
            />
          </Col>
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              defaultValue={[dayjs().startOf('month'), dayjs()]}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD') ?? dayjs().startOf('month').format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'))
                setEnabled(true)
              }}
            />
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <Button size="small" icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!rows.length}>Excel</Button>
          </Col>
        </Row>
      </Card>

      {data && (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {[
            { label: 'Số dư đầu kỳ', value: data.so_du_dau_ky, color: '#1677ff' },
            { label: 'Phát sinh Nợ', value: tongNo, color: '#1677ff' },
            { label: 'Phát sinh Có', value: tongCo, color: '#52c41a' },
            { label: 'Số dư cuối kỳ', value: data.so_du_cuoi_ky, color: data.so_du_cuoi_ky > 0 ? '#fa8c16' : '#52c41a' },
          ].map(item => (
            <Col key={item.label}>
              <Card size="small" style={{ minWidth: 160, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: item.color }}>{fmtVND(item.value)}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Table
        columns={columns}
        dataSource={rows}
        rowKey={(r, i) => `${r.ngay}-${r.chung_tu_loai}-${i}`}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 100, showTotal: t => `${t} dòng` }}
        summary={() => rows.length > 0 ? (
          <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
            <Table.Summary.Cell index={0} colSpan={4}>Tổng cộng</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <Text style={{ color: '#1677ff' }}>{fmtVND(tongNo)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              <Text style={{ color: '#52c41a' }}>{fmtVND(tongCo)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <Text strong>{fmtVND(Math.abs(data?.so_du_cuoi_ky ?? 0))}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function APLedgerPage() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Sổ công nợ phải trả</Title>
      <Tabs
        defaultActiveKey="ledger"
        items={[
          { key: 'ledger',      label: 'Sổ chi tiết',    children: <LedgerTab /> },
          { key: 'aging',       label: 'Tuổi nợ',        children: <AgingTab /> },
          { key: 'so-chi-tiet', label: 'Sổ chi tiết NCC', children: <SoChiTietTab /> },
        ]}
      />
    </div>
  )
}
