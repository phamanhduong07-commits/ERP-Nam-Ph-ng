import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Dropdown,
  Row, Select, Space, Table, Tabs, Tag, Typography,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  BankOutlined, CarOutlined, DownOutlined, FileExcelOutlined,
  PlusOutlined, SafetyCertificateOutlined, SwapOutlined, TeamOutlined, UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import {
  receiptApi, paymentApi, TRANG_THAI_PHIEU_THU, CashReceipt, CashPayment,
} from '../../api/accounting'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import EmptyState from '../../components/EmptyState'
import PageLayout from '../../components/PageLayout'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography
const { RangePicker } = DatePicker

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  cho_chot: { label: 'Chờ chốt', color: 'default' },
  da_chot: { label: 'Đã chốt', color: 'orange' },
  da_duyet: { label: 'Đã duyệt', color: 'green' },
  huy: { label: 'Đã hủy', color: 'default' },
}

export default function NganHangPage() {
  const navigate = useNavigate()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()
  const [activeTab, setActiveTab] = useState<'thu' | 'chi'>('thu')
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [filterPhanXuong, setFilterPhanXuong] = useState<number | undefined>()
  const [pageReceipt, setPageReceipt] = useState(1)
  const [pagePayment, setPagePayment] = useState(1)

  const { data: receiptData, isLoading: receiptLoading } = useQuery({
    queryKey: ['receipts-ck', tuNgay, denNgay, filterTrangThai, filterPhapNhan, filterPhanXuong, pageReceipt],
    queryFn: () => receiptApi.list({
      tu_ngay: tuNgay, den_ngay: denNgay, trang_thai: filterTrangThai,
      phap_nhan_id: filterPhapNhan, phan_xuong_id: filterPhanXuong,
      hinh_thuc_tt: 'CK', page: pageReceipt, page_size: 20,
    }),
  })

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ['payments-ck', tuNgay, denNgay, filterTrangThai, filterPhapNhan, filterPhanXuong, pagePayment],
    queryFn: () => paymentApi.list({
      tu_ngay: tuNgay, den_ngay: denNgay, trang_thai: filterTrangThai,
      phap_nhan_id: filterPhapNhan, phan_xuong_id: filterPhanXuong,
      hinh_thuc_tt: 'CK', page: pagePayment, page_size: 20,
    }),
  })

  const receipts: CashReceipt[] = receiptData?.items ?? receiptData ?? []
  const totalReceipts: number = receiptData?.total ?? receipts.length
  const tongThu = receipts.reduce((s: number, r: CashReceipt) => s + (r.so_tien ?? 0), 0)

  const payments: CashPayment[] = paymentData?.items ?? paymentData ?? []
  const totalPayments: number = paymentData?.total ?? payments.length
  const tongChi = payments.reduce((s: number, r: CashPayment) => s + (r.so_tien ?? 0), 0)

  useHotkey('ctrl+n', () => {
    if (activeTab === 'thu') navigate('/accounting/receipts/new?hinh_thuc=chuyen_khoan')
    else navigate('/accounting/payments/new?hinh_thuc=chuyen_khoan')
  }, 'Tạo phiếu ngân hàng mới')

  const handleExcel = () => {
    if (activeTab === 'thu') {
      const rows = receipts.map((r: CashReceipt, i: number) => ({
        STT: i + 1,
        'Ngày': r.ngay_phieu,
        'Số chứng từ': r.so_phieu,
        'Đối tượng': r.ten_don_vi ?? `KH#${r.customer_id}`,
        'Diễn giải': r.dien_giai ?? '',
        'Số tiền': r.so_tien,
        'Số TK NH': r.so_tai_khoan ?? '',
        'Số tham chiếu': r.so_tham_chieu ?? '',
        'Pháp nhân': r.ten_phap_nhan ?? '',
      }))
      exportToExcel(`thu-ngan-hang-${dayjs().format('YYYYMMDD')}`, [{
        name: 'Thu ngân hàng',
        headers: Object.keys(rows[0] ?? {}),
        rows: rows.map(r => Object.values(r)),
      }])
    } else {
      const rows = payments.map((r: CashPayment, i: number) => ({
        STT: i + 1,
        'Ngày': r.ngay_phieu,
        'Số chứng từ': r.so_phieu,
        'Đối tượng': r.ten_don_vi ?? `NCC#${r.supplier_id}`,
        'Diễn giải': r.dien_giai ?? '',
        'Số tiền': r.so_tien,
        'Số TK NH': r.so_tai_khoan ?? '',
        'Số tham chiếu': r.so_tham_chieu ?? '',
        'Pháp nhân': r.ten_phap_nhan ?? '',
      }))
      exportToExcel(`chi-ngan-hang-${dayjs().format('YYYYMMDD')}`, [{
        name: 'Chi ngân hàng',
        headers: Object.keys(rows[0] ?? {}),
        rows: rows.map(r => Object.values(r)),
      }])
    }
  }

  const receiptCreateMenu: MenuProps['items'] = [
    { key: 'basic', label: 'Thu chuyển khoản', onClick: () => navigate('/accounting/receipts/new?hinh_thuc=chuyen_khoan') },
    { key: 'by_invoice', label: 'Thu tiền theo hóa đơn', onClick: () => navigate('/accounting/receipts/by-invoice') },
    { key: 'batch', label: 'Thu tiền nhiều khách hàng', onClick: () => navigate('/accounting/receipts/batch') },
    { type: 'divider' },
    { key: 'import', icon: <UploadOutlined />, label: 'Nhập từ Excel', onClick: () => navigate('/accounting/excel-import?type=receipt') },
  ]

  const paymentCreateMenu: MenuProps['items'] = [
    { key: 'basic', label: 'Chi chuyển khoản', onClick: () => navigate('/accounting/payments/new?hinh_thuc=chuyen_khoan') },
    { key: 'by_invoice', icon: <BankOutlined />, label: 'Trả tiền theo hóa đơn', onClick: () => navigate('/accounting/payments/new?mode=by_invoice') },
    { key: 'tax', icon: <SafetyCertificateOutlined />, label: 'Nộp thuế', onClick: () => navigate('/accounting/tax-payments/new') },
    { key: 'insurance', icon: <CarOutlined />, label: 'Nộp bảo hiểm', onClick: () => navigate('/accounting/insurance-payments/new') },
    { key: 'salary', icon: <TeamOutlined />, label: 'Trả lương', onClick: () => navigate('/accounting/salary-payments/new') },
    { type: 'divider' },
    { key: 'transfer', icon: <SwapOutlined />, label: 'Chuyển tiền nội bộ', onClick: () => navigate('/accounting/internal-transfers/new') },
    { key: 'import', icon: <UploadOutlined />, label: 'Nhập từ Excel', onClick: () => navigate('/accounting/excel-import?type=payment') },
  ]

  const receiptColumns: ColumnsType<CashReceipt> = [
    { title: 'STT', width: 52, align: 'center' as const, render: (_v, _r, i) => (pageReceipt - 1) * 20 + i + 1 },
    { title: 'Ngày', dataIndex: 'ngay_phieu', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số chứng từ', dataIndex: 'so_phieu', width: 155, render: (v, r) => <a onClick={() => navigate(`/accounting/receipts/${r.id}`)}>{v}</a> },
    { title: 'Đối tượng', dataIndex: 'ten_don_vi', ellipsis: true, render: (v, r) => v ?? `KH#${r.customer_id}` },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true, render: v => v ?? '—' },
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right' as const, width: 140, render: v => fmtVND(v) },
    { title: 'Số TK NH', dataIndex: 'so_tai_khoan', width: 140, render: v => v ? <a onClick={() => navigate('/master/bank-accounts')}>{v}</a> : '—' },
    { title: 'Số tham chiếu', dataIndex: 'so_tham_chieu', width: 140, render: v => v ?? '—' },
    { title: 'TK Nợ', dataIndex: 'tk_no', width: 80, render: v => v ?? '—' },
    { title: 'TK Có', dataIndex: 'tk_co', width: 80, render: v => v ?? '—' },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 130, ellipsis: true, render: v => v ?? '—' },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 120, ellipsis: true, render: v => v ?? '—' },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => { const s = TRANG_THAI_PHIEU_THU[v]; return <Tag color={s?.color}>{s?.label ?? v}</Tag> },
    },
  ]

  const paymentColumns: ColumnsType<CashPayment> = [
    { title: 'STT', width: 52, align: 'center' as const, render: (_v, _r, i) => (pagePayment - 1) * 20 + i + 1 },
    { title: 'Ngày', dataIndex: 'ngay_phieu', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số chứng từ', dataIndex: 'so_phieu', width: 155, render: (v, r) => <a onClick={() => navigate(`/accounting/payments/${r.id}`)}>{v}</a> },
    { title: 'Đối tượng', dataIndex: 'ten_don_vi', ellipsis: true, render: (v, r) => v ?? `NCC#${r.supplier_id}` },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true, render: v => v ?? '—' },
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right' as const, width: 140, render: v => fmtVND(v) },
    { title: 'Số TK NH', dataIndex: 'so_tai_khoan', width: 140, render: v => v ? <a onClick={() => navigate('/master/bank-accounts')}>{v}</a> : '—' },
    { title: 'Số tham chiếu', dataIndex: 'so_tham_chieu', width: 140, render: v => v ?? '—' },
    { title: 'TK Nợ', dataIndex: 'tk_no', width: 80, render: v => v ?? '—' },
    { title: 'TK Có', dataIndex: 'tk_co', width: 80, render: v => v ?? '—' },
    { title: 'Khoản mục CP', dataIndex: 'ten_khoan_muc', width: 160, ellipsis: true, render: v => v ?? '—' },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 130, ellipsis: true, render: v => v ?? '—' },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 120, ellipsis: true, render: v => v ?? '—' },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => { const s = PAYMENT_STATUS[v]; return <Tag color={s?.color}>{s?.label ?? v}</Tag> },
    },
  ]

  const { displayColumns: displayReceiptCols, settingsButton: receiptSettings } = useColumnPrefs('ck-receipt', receiptColumns, { nonHideable: ['so_phieu'] })
  const { displayColumns: displayPaymentCols, settingsButton: paymentSettings } = useColumnPrefs('ck-payment', paymentColumns, { nonHideable: ['so_phieu'] })

  return (
    <PageLayout
      title="Ngân Hàng"
      actions={
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          {activeTab === 'thu' ? (
            <>
              <Dropdown menu={{ items: receiptCreateMenu }} trigger={['click']}>
                <Button type="primary" icon={<PlusOutlined />}>Thu ngân hàng <DownOutlined /></Button>
              </Dropdown>
              {receiptSettings}
            </>
          ) : (
            <>
              <Dropdown menu={{ items: paymentCreateMenu }} trigger={['click']}>
                <Button type="primary" icon={<PlusOutlined />}>Chi ngân hàng <DownOutlined /></Button>
              </Dropdown>
              {paymentSettings}
            </>
          )}
        </Space>
      }
    >
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
                setPageReceipt(1); setPagePayment(1)
              }}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 160 }} allowClear placeholder="Trạng thái"
              value={filterTrangThai}
              onChange={v => { setFilterTrangThai(v); setPageReceipt(1); setPagePayment(1) }}
              options={Object.entries(TRANG_THAI_PHIEU_THU).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }} allowClear placeholder="Pháp nhân"
              value={filterPhapNhan}
              onChange={v => { setFilterPhapNhan(v); setPageReceipt(1); setPagePayment(1) }}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 160 }} allowClear placeholder="Xưởng"
              value={filterPhanXuong}
              onChange={v => { setFilterPhanXuong(v); setPageReceipt(1); setPagePayment(1) }}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Col>
        </Row>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={k => setActiveTab(k as 'thu' | 'chi')}
        items={[
          {
            key: 'thu',
            label: `Thu ngân hàng${totalReceipts ? ` (${totalReceipts})` : ''}`,
            children: (
              <>
                <Row style={{ marginBottom: 8 }}>
                  <Col>
                    <Text type="secondary">Tổng thu: </Text>
                    <Text strong style={{ color: '#52c41a' }}>{fmtVND(tongThu)}</Text>
                  </Col>
                </Row>
                <Table
                  locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
                  columns={displayReceiptCols}
                  dataSource={receipts}
                  rowKey="id"
                  loading={receiptLoading}
                  size="small"
                  pagination={{
                    current: pageReceipt,
                    total: totalReceipts,
                    pageSize: 20,
                    showTotal: t => `${t} phiếu thu`,
                    onChange: p => setPageReceipt(p),
                  }}
                />
              </>
            ),
          },
          {
            key: 'chi',
            label: `Chi ngân hàng${totalPayments ? ` (${totalPayments})` : ''}`,
            children: (
              <>
                <Row style={{ marginBottom: 8 }}>
                  <Col>
                    <Text type="secondary">Tổng chi: </Text>
                    <Text strong style={{ color: '#f5222d' }}>{fmtVND(tongChi)}</Text>
                  </Col>
                </Row>
                <Table
                  locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
                  columns={displayPaymentCols}
                  dataSource={payments}
                  rowKey="id"
                  loading={paymentLoading}
                  size="small"
                  pagination={{
                    current: pagePayment,
                    total: totalPayments,
                    pageSize: 20,
                    showTotal: t => `${t} phiếu chi`,
                    onChange: p => setPagePayment(p),
                  }}
                />
              </>
            ),
          },
        ]}
      />
    </PageLayout>
  )
}
