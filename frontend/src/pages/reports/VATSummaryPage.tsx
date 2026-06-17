import React, { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DownloadOutlined, FileExcelOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import { reportsApi, VATAuditItem, VATAuditResponse } from '../../api/reports'
import { usePhapNhan } from '../../hooks/useMasterData'
import EmptyState from '../../components/EmptyState'
import PageLayout from '../../components/PageLayout'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography

interface VATData {
  doanh_thu_chiu_thue: number
  thue_gtgt_dau_ra: number
  gia_tri_hang_mua: number
  thue_gtgt_dau_vao: number
  thue_gtgt_phai_nop: number
}

interface FormValues {
  thang: { month: () => number; year: () => number }
  phap_nhan_id: number
}

function printVATReport(
  data: VATData,
  thang: number,
  nam: number,
  phapNhanName: string,
) {
  const fmt = (v: number) => v?.toLocaleString('vi-VN') ?? '0'
  const rows = [
    { stt: '1', label: 'Doanh thu bán ra (chưa thuế)', value: data.doanh_thu_chiu_thue },
    { stt: '2', label: 'Thuế GTGT đầu ra', value: data.thue_gtgt_dau_ra },
    { stt: '3', label: 'Giá trị hàng hóa, dịch vụ mua vào', value: data.gia_tri_hang_mua },
    { stt: '4', label: 'Thuế GTGT đầu vào được khấu trừ', value: data.thue_gtgt_dau_vao },
  ]
  const phai_nop = data.thue_gtgt_phai_nop
  const label5 = phai_nop >= 0 ? 'Số thuế phải nộp' : 'Còn được khấu trừ'

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<title>Tờ khai thuế GTGT ${thang}/${nam}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; }
  h2 { text-align: center; font-size: 14pt; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px; }
  .sub { text-align: center; font-size: 10pt; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #1565C0; color: #fff; padding: 6px 8px; text-align: left; font-size: 10pt; }
  td { border: 1px solid #ccc; padding: 5px 8px; font-size: 10.5pt; }
  .num { text-align: right; }
  .total-row td { font-weight: bold; background: #e3f2fd; }
  .highlight { font-size: 12pt; font-weight: bold; color: ${phai_nop >= 0 ? '#c62828' : '#2e7d32'}; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<button onclick="window.print()" style="margin-bottom:12px;padding:6px 16px;cursor:pointer;">In PDF</button>
<h2>Báo cáo tổng hợp thuế GTGT</h2>
<div class="sub">Kỳ tính thuế: Tháng ${thang}/${nam} — ${phapNhanName}</div>
<table>
  <thead>
    <tr>
      <th style="width:40px">STT</th>
      <th>Chỉ tiêu</th>
      <th style="width:200px;text-align:right">Giá trị (đồng)</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map(r => `<tr>
      <td style="text-align:center">${r.stt}</td>
      <td>${r.label}</td>
      <td class="num">${fmt(r.value)}</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td style="text-align:center">5</td>
      <td>${label5} (2 - 4)</td>
      <td class="num highlight">${fmt(Math.abs(phai_nop))}</td>
    </tr>
  </tbody>
</table>
<div style="margin-top:32px;display:flex;justify-content:flex-end;">
  <div style="text-align:center;min-width:180px;">
    <div style="font-style:italic;font-size:9.5pt;color:#555">Ngày lập báo cáo</div>
    <div style="margin-top:48px;font-weight:bold;">Kế toán trưởng</div>
    <div style="font-style:italic;font-size:9pt;color:#888">(Ký, họ tên)</div>
  </div>
</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=850,height=1100')
  if (w) {
    w.document.write(html)
    w.document.close()
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const VATSummaryPage: React.FC = () => {
  const { phapNhanList } = usePhapNhan()
  const [loading, setLoading] = useState(false)
  const [exportingOutput, setExportingOutput] = useState(false)
  const [exportingInput, setExportingInput] = useState(false)
  const [data, setData] = useState<VATData | null>(null)
  const [audit, setAudit] = useState<VATAuditResponse | null>(null)
  const [period, setPeriod] = useState<{ thang: number; nam: number; phap_nhan_id?: number; phapNhanName: string } | null>(null)

  const handleExportOutput = async () => {
    if (!period) return
    setExportingOutput(true)
    try {
      const blob = await reportsApi.exportVatOutput({ thang: period.thang, nam: period.nam, phap_nhan_id: period.phap_nhan_id })
      downloadBlob(blob, `bang_ke_dau_ra_${String(period.thang).padStart(2, '0')}_${period.nam}.xlsx`)
    } catch { /* ignore */ } finally { setExportingOutput(false) }
  }

  const handleExportInput = async () => {
    if (!period) return
    setExportingInput(true)
    try {
      const blob = await reportsApi.exportVatInput({ thang: period.thang, nam: period.nam, phap_nhan_id: period.phap_nhan_id })
      downloadBlob(blob, `bang_ke_dau_vao_${String(period.thang).padStart(2, '0')}_${period.nam}.xlsx`)
    } catch { /* ignore */ } finally { setExportingInput(false) }
  }

  const onFinish = async (values: FormValues) => {
    setLoading(true)
    try {
      const thang = values.thang.month() + 1
      const nam = values.thang.year()
      const phapNhanName = phapNhanList.find(p => p.id === values.phap_nhan_id)?.ten_phap_nhan ?? ''
      const params = { thang, nam, phap_nhan_id: values.phap_nhan_id }
      const [summaryRes, auditRes] = await Promise.all([
        reportsApi.getVATSummary(params),
        reportsApi.getVATAudit({ ...params, limit: 100 }),
      ])
      setData(summaryRes)
      setAudit(auditRes)
      setPeriod({ thang, nam, phap_nhan_id: values.phap_nhan_id, phapNhanName })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const summaryColumns: import('antd/es/table').ColumnsType<{ label: string; value: number }> = [
    { title: 'Chỉ tiêu', dataIndex: 'label', key: 'label' },
    {
      title: 'Giá trị (VNĐ)',
      dataIndex: 'value',
      key: 'value',
      align: 'right' as const,
      render: (val: number) => <Text strong>{val?.toLocaleString('vi-VN')}</Text>,
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('reports-vat-summary', summaryColumns)

  const vatRows = data ? [
    { label: '1. Doanh thu bán ra (chưa thuế)', value: data.doanh_thu_chiu_thue },
    { label: '2. Thuế GTGT đầu ra', value: data.thue_gtgt_dau_ra },
    { label: '3. Giá trị hàng hóa, dịch vụ mua vào', value: data.gia_tri_hang_mua },
    { label: '4. Thuế GTGT đầu vào được khấu trừ', value: data.thue_gtgt_dau_vao },
    { label: `${data.thue_gtgt_phai_nop >= 0 ? 'Số thuế phải nộp' : 'Còn được khấu trừ'} (2 - 4)`, value: Math.abs(data.thue_gtgt_phai_nop) },
  ] : []

  const auditColumns = [
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      width: 90,
      render: (value: string) => <Tag color={value === 'error' ? 'red' : 'orange'}>{value === 'error' ? 'Lỗi' : 'Cảnh báo'}</Tag>,
    },
    {
      title: 'Loại',
      dataIndex: 'direction',
      width: 90,
      render: (value: string) => <Tag color={value === 'output' ? 'blue' : 'green'}>{value === 'output' ? 'Đầu ra' : 'Đầu vào'}</Tag>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 110,
      render: (value: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : '—',
    },
    {
      title: 'Hóa đơn',
      width: 140,
      render: (_: unknown, record: VATAuditItem) => record.record_code || `#${record.record_id}`,
    },
    {
      title: 'Cần xử lý',
      dataIndex: 'message',
      ellipsis: true,
    },
    {
      title: 'Lệch',
      dataIndex: 'difference',
      width: 120,
      align: 'right' as const,
      render: (value: number | null) => value == null ? '—' : value.toLocaleString('vi-VN'),
    },
  ]

  return (
    <PageLayout title="Báo cáo tổng hợp thuế GTGT">

      <Card style={{ marginBottom: 24 }}>
        <Form layout="inline" onFinish={onFinish}>
          <Form.Item name="thang" label="Kỳ tính thuế" rules={[{ required: true }]}>
            <DatePicker picker="month" format="MM/YYYY" placeholder="Chọn tháng" />
          </Form.Item>
          <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true }]}>
            <Select placeholder="Chọn pháp nhân" style={{ width: 250 }}>
              {phapNhanList.map((pn) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>Xem báo cáo</Button>
          </Form.Item>
          {data && period && (
            <>
              <Form.Item>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => printVATReport(data, period.thang, period.nam, period.phapNhanName)}
                >
                  In mẫu kê khai
                </Button>
              </Form.Item>
              <Form.Item>
                <Button
                  icon={<FileExcelOutlined />}
                  loading={exportingOutput}
                  onClick={handleExportOutput}
                  style={{ color: '#1565C0', borderColor: '#1565C0' }}
                >
                  Bảng kê đầu ra
                </Button>
              </Form.Item>
              <Form.Item>
                <Button
                  icon={<DownloadOutlined />}
                  loading={exportingInput}
                  onClick={handleExportInput}
                  style={{ color: '#1B5E20', borderColor: '#1B5E20' }}
                >
                  Bảng kê đầu vào
                </Button>
              </Form.Item>
            </>
          )}
          <Form.Item>{settingsButton}</Form.Item>
        </Form>
      </Card>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic title="Thuế đầu ra" value={data.thue_gtgt_dau_ra} precision={0} suffix="đ" valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="Thuế đầu vào" value={data.thue_gtgt_dau_vao} precision={0} suffix="đ" valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title={data.thue_gtgt_phai_nop >= 0 ? 'Thuế phải nộp' : 'Còn được khấu trừ'}
                  value={Math.abs(data.thue_gtgt_phai_nop)}
                  precision={0}
                  suffix="đ"
                  valueStyle={{ color: data.thue_gtgt_phai_nop >= 0 ? '#cf1322' : '#3f8600' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết kê khai">
            <Table
              columns={displayColumns}
              dataSource={vatRows}
              rowKey="label"
              pagination={false}
              bordered
              rowClassName={(_, idx) => idx === vatRows.length - 1 ? 'ant-table-row-selected' : ''}
            />
          </Card>

          <Card title="Kiểm soát dữ liệu kê khai" style={{ marginTop: 24 }}>
            {audit?.total ? (
              <Alert
                showIcon
                type={(audit.by_severity?.error || 0) > 0 ? 'error' : 'warning'}
                message={`Có ${audit.total} vấn đề cần xử lý trước khi nộp tờ khai.`}
                style={{ marginBottom: 12 }}
              />
            ) : (
              <Alert
                showIcon
                type="success"
                message="Chưa phát hiện lỗi dữ liệu VAT trong kỳ đang chọn."
                style={{ marginBottom: 12 }}
              />
            )}
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col xs={12} md={6}>
                <Statistic title="HĐ bán ra" value={audit?.summary.sales_invoice_count || 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="HĐ mua vào" value={audit?.summary.purchase_invoice_count || 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Lỗi" value={audit?.by_severity?.error || 0} valueStyle={{ color: '#cf1322' }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Cảnh báo" value={audit?.by_severity?.warning || 0} valueStyle={{ color: '#d48806' }} />
              </Col>
            </Row>
            <Table
              columns={auditColumns}
              dataSource={audit?.items || []}
              rowKey={(record) => `${record.direction}-${record.table}-${record.record_id}-${record.category}`}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size="small"
              locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
              scroll={{ x: 780 }}
            />
          </Card>
        </>
      )}
    </PageLayout>
  )
}

export default VATSummaryPage
