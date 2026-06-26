import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography,
  Button,
} from 'antd'
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, PrinterOutlined, WarningOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { reportsApi, DebtRow, DebtSummaryResponse, type ApLedgerRow, type ApLedgerTotals } from '../../api/reports'
import { debtAlertsApi, type DebtOverdueAlertItem } from '../../api/accounting'
import { phapNhanApi } from '../../api/phap_nhan'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND, downloadBlob } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"
import PageLayout from '../../components/PageLayout'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'
import { useAuthStore } from '../../store/auth'

const _SALE_STAFF_ROLES = ['SALE_ADMIN', 'KINH_DOANH_NHAN_VIEN']

const { Text } = Typography

function fmtM(v?: number) {
  return fmtVND(v ?? 0)
}

function SummaryCards({ summary, label }: {
  summary: { tong_phat_sinh: number; da_thanh_toan: number; con_lai: number; qua_han: number; trong_han: number }
  label: string
}) {
  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title={`Tổng ${label}`} value={summary.tong_phat_sinh} formatter={v => fmtM(Number(v))} valueStyle={{ fontSize: 16 }} />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title="Đã thanh toán" value={summary.da_thanh_toan} formatter={v => fmtM(Number(v))} valueStyle={{ fontSize: 16, color: '#52c41a' }} />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title="Còn lại" value={summary.con_lai} formatter={v => fmtM(Number(v))} valueStyle={{ fontSize: 16, color: '#fa8c16' }} />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title="Quá hạn" value={summary.qua_han} formatter={v => fmtM(Number(v))} valueStyle={{ fontSize: 16, color: summary.qua_han > 0 ? '#f5222d' : '#52c41a' }} />
        </Card>
      </Col>
    </Row>
  )
}

function DebtTable({ rows, type, loading }: { rows: DebtRow[]; type: 'ar' | 'ap'; loading: boolean }) {
  const handleExcel = () => {
    const data = rows.map(r => ({
      'Đối tượng': r.ten_doi_tuong,
      'Số HĐ': r.so_hoa_don,
      'Tổng phát sinh': r.tong_phat_sinh,
      'Đã TT': r.da_thanh_toan,
      'Còn lại': r.con_lai,
      'Trong hạn': r.trong_han,
      'Quá hạn': r.qua_han,
    }))
    exportToExcel(`cong-no-${type}-${dayjs().format('YYYYMMDD')}`, [{
      name: type === 'ar' ? 'Phải thu' : 'Phải trả',
      headers: Object.keys(data[0] ?? {}),
      rows: data.map(r => Object.values(r)),
    }])
  }

  const columns: ColumnsType<DebtRow> = [
    { title: 'Đối tượng', dataIndex: 'ten_doi_tuong', ellipsis: true },
    { title: 'Số HĐ', dataIndex: 'so_hoa_don', width: 80, align: 'center' },
    {
      title: 'Tổng phát sinh', dataIndex: 'tong_phat_sinh', align: 'right', width: 140,
      render: v => fmtM(v),
    },
    {
      title: 'Đã thanh toán', dataIndex: 'da_thanh_toan', align: 'right', width: 140,
      render: v => <Text style={{ color: '#52c41a' }}>{fmtM(v)}</Text>,
    },
    {
      title: 'Còn lại', dataIndex: 'con_lai', align: 'right', width: 140,
      render: v => <Text strong style={{ color: v > 0 ? '#fa8c16' : '#52c41a' }}>{fmtM(v)}</Text>,
    },
    {
      title: 'Trong hạn', dataIndex: 'trong_han', align: 'right', width: 130,
      render: v => <Text style={{ color: '#1b168e' }}>{fmtM(v)}</Text>,
    },
    {
      title: 'Quá hạn', dataIndex: 'qua_han', align: 'right', width: 130,
      render: v => v > 0
        ? <Tag color="red">{fmtM(v)}</Tag>
        : <Text type="secondary">—</Text>,
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs(`reports-debt-summary-${type}`, columns)

  return (
    <>
      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <Button size="small" icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!rows.length}>Excel</Button>
        {settingsButton}
      </div>
      <Table
                locale={{ emptyText: <EmptyState size="small" preset="report" /> }}
                columns={displayColumns}
        dataSource={rows}
        rowKey={(r, i) => `${r.customer_id ?? r.supplier_id ?? i}`}
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showTotal: t => `${t} đối tượng` }}
        rowClassName={r => r.qua_han > 0 ? 'row-overdue' : ''}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={2}><Text strong>Tổng cộng ({rows.length})</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right"><Text strong>{fmtM(rows.reduce((s, r) => s + r.tong_phat_sinh, 0))}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><Text strong>{fmtM(rows.reduce((s, r) => s + r.da_thanh_toan, 0))}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><Text strong style={{ color: '#fa8c16' }}>{fmtM(rows.reduce((s, r) => s + r.con_lai, 0))}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right"><Text strong>{fmtM(rows.reduce((s, r) => s + r.trong_han, 0))}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right"><Text strong style={{ color: '#f5222d' }}>{fmtM(rows.reduce((s, r) => s + r.qua_han, 0))}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
      <style>{`.row-overdue td { background: #fff1f0 !important; }`}</style>
    </>
  )
}

function OverdueAlertsPanel({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['debt-overdue-alerts', asOfDate],
    queryFn: () => debtAlertsApi.getOverdue({ as_of_date: asOfDate, limit: 10 }),
  })

  const columns: ColumnsType<DebtOverdueAlertItem> = [
    { title: 'Đối tượng', dataIndex: 'ten_don_vi', ellipsis: true, render: v => v || '—' },
    {
      title: 'Quá hạn',
      dataIndex: 'qua_han',
      align: 'right',
      width: 120,
      render: v => <Text strong style={{ color: v > 0 ? '#cf1322' : undefined }}>{fmtM(v)}</Text>,
    },
    { title: '1-30', dataIndex: 'qua_han_30', align: 'right', width: 100, render: v => v > 0 ? fmtM(v) : '—' },
    { title: '31-60', dataIndex: 'qua_han_60', align: 'right', width: 100, render: v => v > 0 ? fmtM(v) : '—' },
    { title: '>60', dataIndex: 'qua_han_90', align: 'right', width: 100, render: v => v > 0 ? fmtM(v) : '—' },
  ]

  const arItems = data?.ar.items ?? []
  const apItems = data?.ap.items ?? []
  const totalOverdue = Number(data?.ar.total_overdue ?? 0) + Number(data?.ap.total_overdue ?? 0)

  if (!isLoading && totalOverdue <= 0) {
    return (
      <Alert
        showIcon
        type="success"
        message="Không có công nợ quá hạn"
        description={`Tính đến ${dayjs(asOfDate).format('DD/MM/YYYY')}, AR/AP không có khoản quá hạn cần cảnh báo.`}
        style={{ marginBottom: 12 }}
      />
    )
  }

  return (
    <Card
      size="small"
      title={<Space><WarningOutlined style={{ color: '#cf1322' }} />Cảnh báo quá hạn thanh toán</Space>}
      extra={<Tag color={totalOverdue > 0 ? 'red' : 'default'}>{fmtM(totalOverdue)}</Tag>}
      style={{ marginBottom: 12 }}
    >
      <Row gutter={[16, 12]}>
        <Col xs={24} lg={12}>
          <Text strong>Phải thu quá hạn</Text>
          <Table<DebtOverdueAlertItem>
            locale={{ emptyText: <EmptyState size="small" preset="report" /> }}
            rowKey={r => `ar-${r.doi_tuong_id}`}
            size="small"
            loading={isLoading}
            columns={columns}
            dataSource={arItems}
            pagination={false}
            scroll={{ x: 620 }}
            style={{ marginTop: 8 }}
          />
        </Col>
        <Col xs={24} lg={12}>
          <Text strong>Phải trả quá hạn</Text>
          <Table<DebtOverdueAlertItem>
            locale={{ emptyText: <EmptyState size="small" preset="report" /> }}
            rowKey={r => `ap-${r.doi_tuong_id}`}
            size="small"
            loading={isLoading}
            columns={columns}
            dataSource={apItems}
            pagination={false}
            scroll={{ x: 620 }}
            style={{ marginTop: 8 }}
          />
        </Col>
      </Row>
    </Card>
  )
}

// ─── Helper: in mẫu tổng hợp NCC ────────────────────────────────────────────

function printApLedger(rows: ApLedgerRow[], totals: ApLedgerTotals, tuNgay: string, denNgay: string, phapNhanName: string) {
  const fmt = (v: number) => v > 0 ? fmtVND(v) : ''
  const rowsHtml = rows.map(r => `
    <tr>
      <td>${r.ma_ncc}</td>
      <td>${r.ten_ncc}</td>
      <td style="text-align:center">${r.tk_cong_no}</td>
      <td style="text-align:right">${fmt(r.so_du_dau_ky_no)}</td>
      <td style="text-align:right">${fmt(r.so_du_dau_ky_co)}</td>
      <td style="text-align:right">${fmt(r.phat_sinh_no)}</td>
      <td style="text-align:right">${fmt(r.phat_sinh_co)}</td>
      <td style="text-align:right">${fmt(r.so_du_cuoi_ky_no)}</td>
      <td style="text-align:right">${fmt(r.so_du_cuoi_ky_co)}</td>
    </tr>`).join('')

  const from = dayjs(tuNgay)
  const to = dayjs(denNgay)
  const kyLabel = from.month() === to.month() && from.year() === to.year()
    ? `Tháng ${from.month() + 1} năm ${from.year()}`
    : `${from.format('DD/MM/YYYY')} – ${to.format('DD/MM/YYYY')}`

  const html = `
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 11pt; margin: 10mm 15mm; }
      h2 { text-align: center; font-size: 14pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
      .subtitle { text-align: center; font-style: italic; font-size: 10pt; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 10pt; }
      th, td { border: 1px solid #bbb; padding: 4px 6px; }
      th { background: #e8f4e8; text-align: center; font-weight: bold; }
      .total-row td { font-weight: bold; background: #f5f5f5; }
      @media print { @page { size: A4 landscape; margin: 10mm 12mm; } }
    </style>
    <h2>Tổng hợp công nợ phải trả nhà cung cấp</h2>
    <p class="subtitle">
      Chi nhánh: ${phapNhanName}, Tài khoản: 331, Loại tiền: &lt;&lt;Tổng hợp&gt;&gt;, ${kyLabel}
    </p>
    <table>
      <thead>
        <tr>
          <th rowspan="2">Mã nhà cung cấp</th>
          <th rowspan="2">Tên nhà cung cấp</th>
          <th rowspan="2">TK Công nợ</th>
          <th colspan="2">Số dư đầu kỳ</th>
          <th colspan="2">Phát sinh</th>
          <th colspan="2">Số dư cuối kỳ</th>
        </tr>
        <tr>
          <th>Nợ</th><th>Có</th>
          <th>Nợ</th><th>Có</th>
          <th>Nợ</th><th>Có</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="3">Tổng cộng</td>
          <td style="text-align:right">${fmt(totals.so_du_dau_ky_no)}</td>
          <td style="text-align:right">${fmt(totals.so_du_dau_ky_co)}</td>
          <td style="text-align:right">${fmt(totals.phat_sinh_no)}</td>
          <td style="text-align:right">${fmt(totals.phat_sinh_co)}</td>
          <td style="text-align:right">${fmt(totals.so_du_cuoi_ky_no)}</td>
          <td style="text-align:right">${fmt(totals.so_du_cuoi_ky_co)}</td>
        </tr>
      </tbody>
    </table>`

  const w = window.open('', '_blank', 'width=1100,height=700')!
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Công nợ NCC</title></head><body>${html}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

// ─── Tab: Tổng hợp công nợ phải trả NCC ────────────────────────────────────

function ApLedgerTab() {
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs(),
  ])
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()

  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ap-ledger-summary', dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), phapNhanId],
    queryFn: () => reportsApi.getApLedgerSummary({
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
    }),
    staleTime: 60_000,
  })

  const phapNhanName = phapNhanId
    ? (listPhapNhan.find(p => p.id === phapNhanId)?.ten_phap_nhan ?? 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI NAM PHƯƠNG')
    : 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI NAM PHƯƠNG'

  const fmtCell = (v: number) => v > 0 ? <span>{fmtM(v)}</span> : <Text type="secondary">—</Text>

  const columns = [
    { title: 'Mã NCC', dataIndex: 'ma_ncc', width: 100 },
    { title: 'Tên nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true },
    { title: 'TK Công nợ', dataIndex: 'tk_cong_no', width: 110, align: 'center' as const },
    {
      title: 'Số dư đầu kỳ',
      children: [
        { title: 'Nợ', dataIndex: 'so_du_dau_ky_no', align: 'right' as const, width: 140, render: (v: number) => fmtCell(v) },
        { title: 'Có', dataIndex: 'so_du_dau_ky_co', align: 'right' as const, width: 140, render: (v: number) => fmtCell(v) },
      ],
    },
    {
      title: 'Phát sinh',
      children: [
        { title: 'Nợ', dataIndex: 'phat_sinh_no', align: 'right' as const, width: 140, render: (v: number) => fmtCell(v) },
        { title: 'Có', dataIndex: 'phat_sinh_co', align: 'right' as const, width: 140, render: (v: number) => fmtCell(v) },
      ],
    },
    {
      title: 'Số dư cuối kỳ',
      children: [
        { title: 'Nợ', dataIndex: 'so_du_cuoi_ky_no', align: 'right' as const, width: 140, render: (v: number) => fmtCell(v) },
        { title: 'Có', dataIndex: 'so_du_cuoi_ky_co', align: 'right' as const, width: 140, render: (v: number) => fmtCell(v) },
      ],
    },
  ]

  const t = data?.totals

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Row gutter={[8, 8]} align="middle">
        <Col>
          <DatePicker.RangePicker
            value={[dates[0], dates[1]]}
            format="DD/MM/YYYY"
            picker="date"
            onChange={ds => ds && setDates([ds[0]!, ds[1]!])}
          />
        </Col>
        <Col>
          <Select
            style={{ width: 200 }}
            placeholder="Tất cả pháp nhân"
            allowClear
            value={phapNhanId}
            onChange={v => setPhapNhanId(v)}
            options={listPhapNhan.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
          />
        </Col>
        <Col>
          <Button
            icon={<FileExcelOutlined />}
            style={{ color: '#217346', borderColor: '#217346' }}
            disabled={!data?.rows.length}
            onClick={() => {
              if (!data) return
              exportToExcel(`TongHopCongNoNCC_${dates[0].format('DDMMYYYY')}_${dates[1].format('DDMMYYYY')}`, [{
                name: 'Tổng hợp NCC',
                headers: ['Mã NCC', 'Tên NCC', 'TK CN', 'Dư đầu Nợ', 'Dư đầu Có', 'PS Nợ', 'PS Có', 'Dư cuối Nợ', 'Dư cuối Có'],
                rows: data.rows.map(r => [
                  r.ma_ncc, r.ten_ncc, r.tk_cong_no,
                  r.so_du_dau_ky_no || '', r.so_du_dau_ky_co || '',
                  r.phat_sinh_no || '', r.phat_sinh_co || '',
                  r.so_du_cuoi_ky_no || '', r.so_du_cuoi_ky_co || '',
                ]),
                colWidths: [12, 28, 8, 16, 16, 16, 16, 16, 16],
              }])
            }}
          >
            Xuất Excel
          </Button>
        </Col>
        <Col>
          <Button
            icon={<PrinterOutlined />}
            disabled={!data}
            onClick={() => data && printApLedger(data.rows, data.totals, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), phapNhanName)}
          >
            In mẫu
          </Button>
        </Col>
      </Row>

      <Table<ApLedgerRow>
        locale={{ emptyText: <EmptyState size="small" preset="report" /> }}
        rowKey="supplier_id"
        size="small"
        loading={isLoading}
        dataSource={data?.rows ?? []}
        columns={columns}
        pagination={{ pageSize: 50, showTotal: t => `${t} nhà cung cấp` }}
        scroll={{ x: 1100 }}
        summary={() => t && (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><Text strong>{t.so_du_dau_ky_no > 0 ? fmtM(t.so_du_dau_ky_no) : '—'}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><Text strong>{t.so_du_dau_ky_co > 0 ? fmtM(t.so_du_dau_ky_co) : '—'}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right"><Text strong>{t.phat_sinh_no > 0 ? fmtM(t.phat_sinh_no) : '—'}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right"><Text strong>{t.phat_sinh_co > 0 ? fmtM(t.phat_sinh_co) : '—'}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right"><Text strong style={{ color: '#fa541c' }}>{t.so_du_cuoi_ky_no > 0 ? fmtM(t.so_du_cuoi_ky_no) : '—'}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right"><Text strong style={{ color: '#389e0d' }}>{t.so_du_cuoi_ky_co > 0 ? fmtM(t.so_du_cuoi_ky_co) : '—'}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Space>
  )
}

export default function DebtSummaryPage() {
  const user = useAuthStore(s => s.user)
  const isSaleStaff = _SALE_STAFF_ROLES.includes(user?.role ?? '')
  const [asOfDate, setAsOfDate] = useState<string>(dayjs().format('YYYY-MM-DD'))

  const { data, isLoading } = useQuery({
    queryKey: ['report-debt-summary', asOfDate],
    queryFn: () => reportsApi.getDebtSummary(asOfDate),
  })

  const ar = data?.ar
  const ap = data?.ap

  const handleExportServer = async () => {
    const blob = await reportsApi.exportDebtSummary({ as_of_date: asOfDate })
    downloadBlob(blob, `cong_no_${asOfDate.replace(/-/g, '')}.xlsx`)
  }

  const handlePrint = () => {
    if (!data) return
    const cols = [
      { header: 'Đối tượng' }, { header: 'Số HĐ', align: 'center' as const },
      { header: 'Tổng phát sinh', align: 'right' as const },
      { header: 'Đã TT', align: 'right' as const },
      { header: 'Còn lại', align: 'right' as const },
      { header: 'Trong hạn', align: 'right' as const },
      { header: 'Quá hạn', align: 'right' as const },
    ]
    const toRows = (rows: DebtRow[]) => rows.map(r => [
      r.ten_doi_tuong, r.so_hoa_don,
      fmtVND(r.tong_phat_sinh), fmtVND(r.da_thanh_toan),
      fmtVND(r.con_lai), fmtVND(r.trong_han), fmtVND(r.qua_han),
    ])
    const arTable = buildHtmlTable(cols, toRows(data.ar.rows))
    const apTable = buildHtmlTable(cols, toRows(data.ap.rows))
    const html = `
      <h3 style="margin:0 0 4px">Báo cáo công nợ tổng hợp — Tính đến ${dayjs(asOfDate).format('DD/MM/YYYY')}</h3>
      <h4 style="color:#1565C0;margin:12px 0 4px">A. Công nợ phải thu (${data.ar.rows.length} khách hàng)</h4>
      ${arTable}
      <div style="font-size:11pt;font-weight:700;margin:4px 0 12px;text-align:right">
        Tổng còn lại: ${fmtVND(data.ar.summary.con_lai)} &nbsp;|&nbsp; Quá hạn: ${fmtVND(data.ar.summary.qua_han)}
      </div>
      <h4 style="color:#B71C1C;margin:12px 0 4px">B. Công nợ phải trả (${data.ap.rows.length} nhà cung cấp)</h4>
      ${apTable}
      <div style="font-size:11pt;font-weight:700;margin:4px 0;text-align:right">
        Tổng còn lại: ${fmtVND(data.ap.summary.con_lai)} &nbsp;|&nbsp; Quá hạn: ${fmtVND(data.ap.summary.qua_han)}
      </div>`
    printToPdf(`Báo cáo công nợ tổng hợp ${asOfDate}`, html, true)
  }

  return (
    <PageLayout
      title="Báo cáo công nợ tổng hợp"
      actions={
        <Space>
          <Text type="secondary">Tính đến ngày:</Text>
          <DatePicker
            format="DD/MM/YYYY"
            value={dayjs(asOfDate)}
            onChange={d => d && setAsOfDate(d.format('YYYY-MM-DD'))}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExportServer} disabled={!data}
            style={{ color: '#217346', borderColor: '#217346' }}>Xuất Excel</Button>
          <Button icon={<FilePdfOutlined />} onClick={handlePrint} disabled={!data}>In / PDF</Button>
        </Space>
      }
    >

      <OverdueAlertsPanel asOfDate={asOfDate} />

      <Tabs
        items={[
          {
            key: 'ar',
            label: `Phải thu (${ar?.rows.length ?? 0} KH)`,
            children: (
              <>
                {ar && <SummaryCards summary={ar.summary} label="phải thu" />}
                <DebtTable rows={ar?.rows ?? []} type="ar" loading={isLoading} />
              </>
            ),
          },
          ...(!isSaleStaff ? [
            {
              key: 'ap',
              label: `Phải trả (${ap?.rows.length ?? 0} NCC)`,
              children: (
                <>
                  {ap && <SummaryCards summary={ap.summary} label="phải trả" />}
                  <DebtTable rows={ap?.rows ?? []} type="ap" loading={isLoading} />
                </>
              ),
            },
            {
              key: 'ap-ledger',
              label: 'Tổng hợp NCC',
              children: <ApLedgerTab />,
            },
          ] : []),
        ]}
      />
    </PageLayout>
  )
}
