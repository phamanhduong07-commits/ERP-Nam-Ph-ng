import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Typography,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined, SearchOutlined, ShopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { apApi } from '../../api/accounting'
import { Supplier, suppliersApi } from '../../api/suppliers'
import { exportToExcel, fmtVND, printDocument } from '../../utils/exportUtils'
import { usePhapNhanForPrint, usePhapNhanList } from '../../hooks/usePhapNhan'
import EmptyState from '../../components/EmptyState'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface ReconItem {
  ngay: string
  so_phieu: string
  ten_hang: string
  so_luong: number
  dvt: string
  don_gia: number
  thanh_tien: number
  ghi_chu?: string | null
}

interface ReconPayment {
  id: number
  ngay_phieu: string
  so_phieu: string
  dien_giai?: string | null
  hinh_thuc_tt?: string | null
  so_tien: number
}

interface ReconResult {
  supplier_id: number
  tu_ngay: string
  den_ngay: string
  phap_nhan_id: number | null
  items: ReconItem[]
  payments: ReconPayment[]
  total_purchase_amount: number
  total_paid_amount: number
  balance: number
}

const fmtNum = (value: number | null | undefined) =>
  value == null ? '-' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(value))

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))

export default function SupplierReconciliation() {
  const [supplierId, setSupplierId] = useState<number | undefined>()
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [submitted, setSubmitted] = useState(false)
  const companyInfo = usePhapNhanForPrint(phapNhanId)

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.list({ page_size: 1000 }).then(r => r.data.items),
  })

  const { data: phapNhanList = [] } = usePhapNhanList()

  const { data: recon, isLoading, refetch } = useQuery<ReconResult>({
    queryKey: ['supplier-reconciliation', supplierId, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), phapNhanId],
    queryFn: () => apApi.getReconciliation(supplierId!, {
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
      ...(phapNhanId ? { phap_nhan_id: phapNhanId } : {}),
    }),
    enabled: submitted && !!supplierId,
  })

  const supplier = suppliers.find(s => s.id === supplierId)

  const columns: ColumnsType<ReconItem> = [
    { title: 'Ngày nhập', dataIndex: 'ngay', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Phiếu nhập', dataIndex: 'so_phieu', width: 140 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'SL nhập', dataIndex: 'so_luong', width: 100, align: 'right', render: fmtNum },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 130, align: 'right', render: fmtVND },
    { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 150, align: 'right', render: v => <Text strong>{fmtVND(v)}</Text> },
  ]

  const paymentColumns: ColumnsType<ReconPayment> = [
    { title: 'Ngày', dataIndex: 'ngay_phieu', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số phiếu chi', dataIndex: 'so_phieu', width: 140 },
    { title: 'Hình thức', dataIndex: 'hinh_thuc_tt', width: 120, render: v => v || '-' },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true, render: v => v || '-' },
    { title: 'Số tiền', dataIndex: 'so_tien', width: 150, align: 'right', render: v => <Text strong style={{ color: '#389e0d' }}>{fmtVND(v)}</Text> },
  ]

  const handleSearch = () => {
    if (!supplierId) return
    setSubmitted(true)
    void refetch()
  }

  const handleExport = () => {
    if (!recon) return
    exportToExcel(`doi_chieu_ncc_${supplier?.ten_viet_tat ?? supplierId}_${dates[0].format('YYYYMMDD')}`, [
      {
        name: 'Nhap kho',
        headers: ['Ngày', 'Số phiếu', 'Tên hàng', 'Số lượng', 'ĐVT', 'Đơn giá', 'Thành tiền'],
        rows: recon.items.map(r => [r.ngay, r.so_phieu, r.ten_hang, r.so_luong, r.dvt, r.don_gia, r.thanh_tien]),
        colWidths: [12, 16, 34, 12, 8, 14, 16],
      },
      {
        name: 'Thanh toan',
        headers: ['Ngày', 'Số phiếu', 'Hình thức', 'Diễn giải', 'Số tiền'],
        rows: recon.payments.map(r => [r.ngay_phieu, r.so_phieu, r.hinh_thuc_tt ?? '', r.dien_giai ?? '', r.so_tien]),
        colWidths: [12, 16, 14, 40, 16],
      },
    ])
  }

  const handlePrint = () => {
    if (!recon) return
    const itemRows = recon.items.map(it => `
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

    const paymentRows = recon.payments.map(p => `
      <tr>
        <td class="text-center">${dayjs(p.ngay_phieu).format('DD/MM/YYYY')}</td>
        <td>${esc(p.so_phieu)}</td>
        <td>${esc(p.dien_giai || '')}</td>
        <td class="text-right">${fmtVND(p.so_tien)}</td>
      </tr>
    `).join('')

    printDocument({
      title: 'BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ NHÀ CUNG CẤP',
      subtitle: `Từ ngày ${dates[0].format('DD/MM/YYYY')} đến ngày ${dates[1].format('DD/MM/YYYY')}`,
      documentNumber: `DC-NCC-${dayjs().format('YYMMDD')}`,
      documentDate: dayjs().format('DD/MM/YYYY'),
      companyInfo,
      fields: [
        { label: 'Nhà cung cấp', value: supplier?.ten_don_vi || supplier?.ten_viet_tat || '-' },
        { label: 'Địa chỉ', value: supplier?.dia_chi || '-' },
        { label: 'Mã số thuế', value: supplier?.ma_so_thue || '-' },
      ],
      bodyHtml: `
        <h3>I. Chi tiết nhập kho</h3>
        <table class="doc-table">
          <thead><tr><th>Ngày</th><th>Số phiếu</th><th>Tên hàng</th><th>SL</th><th>ĐVT</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
          <tbody>${itemRows || '<tr><td colspan="7" class="text-center">Không có nhập kho trong kỳ</td></tr>'}</tbody>
          <tfoot><tr><td colspan="6" class="text-right"><b>Tổng giá trị nhập</b></td><td class="text-right"><b>${fmtVND(recon.total_purchase_amount)}</b></td></tr></tfoot>
        </table>
        <h3 style="margin-top:20px;">II. Chi tiết thanh toán</h3>
        <table class="doc-table">
          <thead><tr><th>Ngày</th><th>Số phiếu</th><th>Diễn giải</th><th>Số tiền</th></tr></thead>
          <tbody>${paymentRows || '<tr><td colspan="4" class="text-center">Không có thanh toán trong kỳ</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3" class="text-right"><b>Tổng đã chi</b></td><td class="text-right"><b>${fmtVND(recon.total_paid_amount)}</b></td></tr></tfoot>
        </table>
        <h3 style="margin-top:20px;">Số dư còn phải trả: ${fmtVND(recon.balance)}</h3>
      `,
    }, true)
  }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <ShopOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>Đối chiếu công nợ nhà cung cấp</Title>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="bottom">
          <Col xs={24} md={7}>
            <Text type="secondary">Nhà cung cấp</Text>
            <Select
              showSearch
              placeholder="Chọn nhà cung cấp"
              style={{ width: '100%', marginTop: 4 }}
              value={supplierId}
              onChange={setSupplierId}
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={suppliers.map(s => ({ value: s.id, label: `${s.ma_ncc || s.id} - ${s.ten_viet_tat || s.ten_don_vi || ''}` }))}
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
              onChange={v => v && setDates(v as [Dayjs, Dayjs])}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} md={5}>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={isLoading} disabled={!supplierId}>
                Xem
              </Button>
              {recon && <Button icon={<FileExcelOutlined />} onClick={handleExport}>Excel</Button>}
              {recon && <Button icon={<FilePdfOutlined />} onClick={handlePrint}>Biên bản</Button>}
            </Space>
          </Col>
        </Row>
      </Card>

      {recon && !phapNhanId && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Đang đối chiếu tất cả pháp nhân"
          description="Nên lọc một pháp nhân trước khi in biên bản để tránh lẫn công nợ giữa các đơn vị."
        />
      )}

      {recon && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}><Card size="small"><Statistic title="Tổng giá trị nhập" value={recon.total_purchase_amount} formatter={v => fmtVND(Number(v))} /></Card></Col>
            <Col xs={24} md={8}><Card size="small"><Statistic title="Đã chi trả" value={recon.total_paid_amount} formatter={v => fmtVND(Number(v))} valueStyle={{ color: '#389e0d' }} /></Card></Col>
            <Col xs={24} md={8}><Card size="small"><Statistic title="Còn phải trả" value={recon.balance} formatter={v => fmtVND(Number(v))} valueStyle={{ color: recon.balance > 0 ? '#cf1322' : '#389e0d' }} /></Card></Col>
          </Row>

          <Card title="Chi tiết nhập kho" styles={{ body: { padding: 0 } }}>
            <Table locale={{ emptyText: <EmptyState size="small" preset="document" /> }} size="small" dataSource={recon.items} columns={columns} pagination={false} rowKey={(r, i) => `${r.so_phieu}-${i}`} scroll={{ x: 820 }} />
          </Card>

          <Card title="Chi tiết thanh toán" style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
            <Table locale={{ emptyText: <EmptyState size="small" preset="document" /> }} size="small" dataSource={recon.payments} columns={paymentColumns} pagination={false} rowKey="id" scroll={{ x: 720 }} />
          </Card>
        </>
      )}

      {!recon && !isLoading && (
        <Card>
          <EmptyState preset="document" title="Chọn nhà cung cấp và khoảng thời gian để xem đối chiếu" />
        </Card>
      )}
    </div>
  )
}
