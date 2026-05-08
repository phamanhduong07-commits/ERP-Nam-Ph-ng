import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Col, DatePicker, Row, Space, Statistic, Table, Tabs, Tag, Typography,
  Button,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { reportsApi, DebtRow, DebtSummaryResponse } from '../../api/reports'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography

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

  return (
    <>
      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <Button size="small" icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!rows.length}>Excel</Button>
      </div>
      <Table
        columns={columns}
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

export default function DebtSummaryPage() {
  const [asOfDate, setAsOfDate] = useState<string>(dayjs().format('YYYY-MM-DD'))

  const { data, isLoading } = useQuery({
    queryKey: ['report-debt-summary', asOfDate],
    queryFn: () => reportsApi.getDebtSummary(asOfDate),
  })

  const ar = data?.ar
  const ap = data?.ap

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
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Báo cáo công nợ tổng hợp</Title>
        <Space>
          <Text type="secondary">Tính đến ngày:</Text>
          <DatePicker
            format="DD/MM/YYYY"
            value={dayjs(asOfDate)}
            onChange={d => d && setAsOfDate(d.format('YYYY-MM-DD'))}
          />
          <Button icon={<FilePdfOutlined />} onClick={handlePrint} disabled={!data}>In / PDF</Button>
        </Space>
      </div>

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
        ]}
      />
    </div>
  )
}
