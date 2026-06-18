import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Dropdown, Input, Modal, message,
  Row, Select, Space, Statistic, Table, Tabs, Tag,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  CarOutlined, CheckCircleOutlined, DownOutlined, FileExcelOutlined,
  PrinterOutlined, PlusOutlined, SafetyCertificateOutlined,
  SwapOutlined, TeamOutlined, UploadOutlined,
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

const { RangePicker } = DatePicker

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  cho_chot: { label: 'Chờ chốt', color: 'default' },
  da_chot: { label: 'Đã chốt', color: 'orange' },
  da_duyet: { label: 'Đã duyệt', color: 'green' },
  huy: { label: 'Đã hủy', color: 'default' },
}

export default function TienMatPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
  const [selectedReceiptKeys, setSelectedReceiptKeys] = useState<number[]>([])
  const [selectedPaymentKeys, setSelectedPaymentKeys] = useState<number[]>([])
  const [searchQ, setSearchQ] = useState<string>('')

  const { data: receiptData, isLoading: receiptLoading } = useQuery({
    queryKey: ['receipts-tm', tuNgay, denNgay, filterTrangThai, filterPhapNhan, filterPhanXuong, pageReceipt, searchQ],
    queryFn: () => receiptApi.list({
      tu_ngay: tuNgay, den_ngay: denNgay, trang_thai: filterTrangThai,
      phap_nhan_id: filterPhapNhan, phan_xuong_id: filterPhanXuong,
      hinh_thuc_tt: 'TM', page: pageReceipt, page_size: 20,
      q: searchQ || undefined,
    }),
  })

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ['payments-tm', tuNgay, denNgay, filterTrangThai, filterPhapNhan, filterPhanXuong, pagePayment, searchQ],
    queryFn: () => paymentApi.list({
      tu_ngay: tuNgay, den_ngay: denNgay, trang_thai: filterTrangThai,
      phap_nhan_id: filterPhapNhan, phan_xuong_id: filterPhanXuong,
      hinh_thuc_tt: 'TM', page: pagePayment, page_size: 20,
      q: searchQ || undefined,
    }),
  })

  const receipts: CashReceipt[] = receiptData?.items ?? receiptData ?? []
  const totalReceipts: number = receiptData?.total ?? receipts.length
  const tongThu = receipts.reduce((s: number, r: CashReceipt) => s + (r.so_tien ?? 0), 0)

  const payments: CashPayment[] = paymentData?.items ?? paymentData ?? []
  const totalPayments: number = paymentData?.total ?? payments.length
  const tongChi = payments.reduce((s: number, r: CashPayment) => s + (r.so_tien ?? 0), 0)

  useHotkey('ctrl+n', () => {
    if (activeTab === 'thu') navigate('/accounting/receipts/new?hinh_thuc=tien_mat')
    else navigate('/accounting/payments/new?hinh_thuc=tien_mat')
  }, 'Tạo phiếu tiền mặt mới')

  const handleDuyet = () => {
    const ids = activeTab === 'thu' ? selectedReceiptKeys : selectedPaymentKeys
    if (!ids.length) return
    Modal.confirm({
      title: `Duyệt ${ids.length} chứng từ?`,
      content: 'Chứng từ sẽ được hạch toán và không thể sửa sau khi duyệt.',
      okText: 'Duyệt', cancelText: 'Huỷ',
      onOk: async () => {
        try {
          if (activeTab === 'thu') {
            await Promise.all(ids.map(id => receiptApi.approve(id)))
            setSelectedReceiptKeys([])
            queryClient.invalidateQueries({ queryKey: ['receipts-tm'] })
          } else {
            await Promise.all(ids.map(id => paymentApi.approve(id)))
            setSelectedPaymentKeys([])
            queryClient.invalidateQueries({ queryKey: ['payments-tm'] })
          }
          message.success(`Đã duyệt ${ids.length} chứng từ`)
        } catch {
          message.error('Có lỗi khi duyệt')
        }
      },
    })
  }

  const handleInPhieu = () => {
    const ids = activeTab === 'thu' ? selectedReceiptKeys : selectedPaymentKeys
    if (ids.length !== 1) return
    const url = activeTab === 'thu'
      ? receiptApi.printUrl(ids[0])
      : paymentApi.printUrl(ids[0])
    window.open(url, '_blank')
  }

  const handleBoGhi = () => {
    const ids = activeTab === 'thu' ? selectedReceiptKeys : selectedPaymentKeys
    if (!ids.length) return
    Modal.confirm({
      title: `Bỏ ghi ${ids.length} chứng từ?`,
      content: 'Trạng thái sẽ chuyển thành Đã hủy.',
      okText: 'Bỏ ghi', okType: 'danger', cancelText: 'Huỷ',
      onOk: async () => {
        try {
          if (activeTab === 'thu') {
            await Promise.all(ids.map(id => receiptApi.cancel(id)))
            setSelectedReceiptKeys([])
            queryClient.invalidateQueries({ queryKey: ['receipts-tm'] })
          } else {
            await Promise.all(ids.map(id => paymentApi.cancel(id)))
            setSelectedPaymentKeys([])
            queryClient.invalidateQueries({ queryKey: ['payments-tm'] })
          }
          message.success(`Đã bỏ ghi ${ids.length} chứng từ`)
        } catch {
          message.error('Có lỗi khi bỏ ghi')
        }
      },
    })
  }

  const handleNhanBan = () => {
    const ids = activeTab === 'thu' ? selectedReceiptKeys : selectedPaymentKeys
    if (ids.length !== 1) return
    const id = ids[0]
    const label = activeTab === 'thu'
      ? receipts.find(r => r.id === id)?.so_phieu
      : payments.find(r => r.id === id)?.so_phieu
    Modal.confirm({
      title: 'Nhân bản chứng từ?',
      content: `Tạo bản sao của ${label ?? `#${id}`} với trạng thái chờ duyệt.`,
      okText: 'Nhân bản', cancelText: 'Huỷ',
      onOk: async () => {
        try {
          if (activeTab === 'thu') {
            const cloned = await receiptApi.clone(id)
            setSelectedReceiptKeys([])
            message.success(`Đã tạo: ${cloned.so_phieu}`)
            navigate(`/accounting/receipts/${cloned.id}`)
          } else {
            const cloned = await paymentApi.clone(id)
            setSelectedPaymentKeys([])
            message.success(`Đã tạo: ${cloned.so_phieu}`)
            navigate(`/accounting/payments/${cloned.id}`)
          }
        } catch {
          message.error('Có lỗi khi nhân bản')
        }
      },
    })
  }

  const handleQuickDuyetReceipt = (id: number) => {
    Modal.confirm({
      title: 'Duyệt phiếu thu?',
      content: 'Phiếu sẽ được hạch toán và không thể sửa sau khi duyệt.',
      okText: 'Duyệt', cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await receiptApi.approve(id)
          queryClient.invalidateQueries({ queryKey: ['receipts-tm'] })
          message.success('Đã duyệt')
        } catch { message.error('Có lỗi khi duyệt') }
      },
    })
  }

  const handleQuickActionPayment = (id: number, trang_thai: string) => {
    const label = trang_thai === 'cho_chot' ? 'Chốt' : 'Duyệt'
    Modal.confirm({
      title: `${label} phiếu chi?`,
      okText: label, cancelText: 'Huỷ',
      onOk: async () => {
        try {
          await paymentApi.approve(id)
          queryClient.invalidateQueries({ queryKey: ['payments-tm'] })
          message.success(`Đã ${label.toLowerCase()}`)
        } catch { message.error(`Có lỗi khi ${label.toLowerCase()}`) }
      },
    })
  }

  const handleExcel = () => {
    if (activeTab === 'thu') {
      const rows = receipts.map((r: CashReceipt, i: number) => ({
        STT: i + 1,
        'Ngày': r.ngay_phieu,
        'Số chứng từ': r.so_phieu,
        'Đối tượng': r.ten_don_vi ?? `KH#${r.customer_id}`,
        'Diễn giải': r.dien_giai ?? '',
        'Số tiền': r.so_tien,
        'TK Nợ': r.tk_no ?? '',
        'TK Có': r.tk_co ?? '',
        'Trạng thái': TRANG_THAI_PHIEU_THU[r.trang_thai]?.label ?? r.trang_thai,
        'Pháp nhân': r.ten_phap_nhan ?? '',
      }))
      exportToExcel(`thu-tien-mat-${dayjs().format('YYYYMMDD')}`, [{
        name: 'Thu tiền mặt',
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
        'TK Nợ': r.tk_no ?? '',
        'TK Có': r.tk_co ?? '',
        'Trạng thái': PAYMENT_STATUS[r.trang_thai]?.label ?? r.trang_thai,
        'Pháp nhân': r.ten_phap_nhan ?? '',
      }))
      exportToExcel(`chi-tien-mat-${dayjs().format('YYYYMMDD')}`, [{
        name: 'Chi tiền mặt',
        headers: Object.keys(rows[0] ?? {}),
        rows: rows.map(r => Object.values(r)),
      }])
    }
  }

  const selectedCount = activeTab === 'thu' ? selectedReceiptKeys.length : selectedPaymentKeys.length

  const bulkMenu: MenuProps['items'] = [
    {
      key: 'duyet',
      label: 'Duyệt',
      icon: <CheckCircleOutlined />,
      disabled: selectedCount === 0,
      onClick: handleDuyet,
    },
    {
      key: 'in_phieu',
      label: 'In phiếu',
      icon: <PrinterOutlined />,
      disabled: selectedCount !== 1,
      onClick: handleInPhieu,
    },
    {
      key: 'nhan_ban',
      label: 'Nhân bản',
      disabled: selectedCount !== 1,
      onClick: handleNhanBan,
    },
    { type: 'divider' },
    {
      key: 'bo_ghi',
      label: 'Bỏ ghi',
      danger: true,
      disabled: selectedCount === 0,
      onClick: handleBoGhi,
    },
  ]

  const receiptCreateMenu: MenuProps['items'] = [
    { key: 'basic', label: 'Thu tiền mặt', onClick: () => navigate('/accounting/receipts/new?hinh_thuc=tien_mat') },
    { key: 'by_invoice', label: 'Thu tiền theo hóa đơn', onClick: () => navigate('/accounting/receipts/by-invoice') },
    { key: 'batch', label: 'Thu tiền nhiều khách hàng', onClick: () => navigate('/accounting/receipts/batch') },
    { type: 'divider' },
    { key: 'import', icon: <UploadOutlined />, label: 'Nhập từ Excel', onClick: () => navigate('/accounting/excel-import?type=receipt') },
  ]

  const paymentCreateMenu: MenuProps['items'] = [
    { key: 'basic', label: 'Chi tiền mặt', onClick: () => navigate('/accounting/payments/new?hinh_thuc=tien_mat') },
    { key: 'by_invoice', label: 'Trả tiền theo hóa đơn', onClick: () => navigate('/accounting/payments/new?mode=by_invoice&hinh_thuc=tien_mat') },
    { key: 'tax', icon: <SafetyCertificateOutlined />, label: 'Nộp thuế', onClick: () => navigate('/accounting/tax-payments/new') },
    { key: 'insurance', icon: <CarOutlined />, label: 'Nộp bảo hiểm', onClick: () => navigate('/accounting/insurance-payments/new') },
    { key: 'salary', icon: <TeamOutlined />, label: 'Trả lương', onClick: () => navigate('/accounting/salary-payments/new') },
    { type: 'divider' },
    { key: 'transfer', icon: <SwapOutlined />, label: 'Chuyển tiền nội bộ', onClick: () => navigate('/accounting/internal-transfers/new') },
    { key: 'import', icon: <UploadOutlined />, label: 'Nhập từ Excel', onClick: () => navigate('/accounting/excel-import?type=payment') },
  ]

  const expandedReceiptRender = (r: CashReceipt) => (
    <div style={{ padding: '4px 48px', background: '#fafafa' }}>
      <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 12px 2px 0', color: '#1677ff', fontWeight: 500, width: 28 }}>Nợ</td>
            <td style={{ padding: '2px 8px 2px 0', width: 64 }}><Tag color="blue" style={{ marginRight: 0 }}>{r.tk_no}</Tag></td>
            <td style={{ padding: '2px 0', color: '#555' }}>{Number(r.so_tien).toLocaleString('vi-VN')} đ</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 12px 2px 0', color: '#722ed1', fontWeight: 500 }}>Có</td>
            <td style={{ padding: '2px 8px 2px 0' }}><Tag color="purple" style={{ marginRight: 0 }}>{r.tk_co}</Tag></td>
            <td style={{ padding: '2px 0', color: '#555' }}>{Number(r.so_tien).toLocaleString('vi-VN')} đ</td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  const expandedPaymentRender = (r: CashPayment) => (
    <div style={{ padding: '4px 48px', background: '#fafafa' }}>
      <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 12px 2px 0', color: '#1677ff', fontWeight: 500, width: 28 }}>Nợ</td>
            <td style={{ padding: '2px 8px 2px 0', width: 64 }}><Tag color="blue" style={{ marginRight: 0 }}>{r.tk_no}</Tag></td>
            <td style={{ padding: '2px 0', color: '#555' }}>{Number(r.so_tien).toLocaleString('vi-VN')} đ</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 12px 2px 0', color: '#722ed1', fontWeight: 500 }}>Có</td>
            <td style={{ padding: '2px 8px 2px 0' }}><Tag color="purple" style={{ marginRight: 0 }}>{r.tk_co}</Tag></td>
            <td style={{ padding: '2px 0', color: '#555' }}>{Number(r.so_tien).toLocaleString('vi-VN')} đ</td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  const receiptColumns: ColumnsType<CashReceipt> = [
    { title: 'STT', width: 52, align: 'center' as const, render: (_v, _r, i) => (pageReceipt - 1) * 20 + i + 1 },
    { title: 'Ngày', dataIndex: 'ngay_phieu', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số chứng từ', dataIndex: 'so_phieu', width: 155, render: (v, r) => <a onClick={() => navigate(`/accounting/receipts/${r.id}`)}>{v}</a> },
    { title: 'Đối tượng', dataIndex: 'ten_don_vi', ellipsis: true, render: (v, r) => v ?? `KH#${r.customer_id}` },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true, render: v => v ?? '—' },
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right' as const, width: 140, render: v => fmtVND(v) },
    { title: 'TK Nợ', dataIndex: 'tk_no', width: 80, render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: 'TK Có', dataIndex: 'tk_co', width: 80, render: v => v ? <Tag color="purple">{v}</Tag> : '—' },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 130, ellipsis: true, render: v => v ?? '—' },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 120, ellipsis: true, render: v => v ?? '—' },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => { const s = TRANG_THAI_PHIEU_THU[v]; return <Tag color={s?.color}>{s?.label ?? v}</Tag> },
    },
    {
      title: '', key: 'action', width: 72, fixed: 'right' as const,
      render: (_v, r: CashReceipt) => r.trang_thai === 'cho_duyet' ? (
        <Button size="small" type="primary" ghost onClick={e => { e.stopPropagation(); handleQuickDuyetReceipt(r.id) }}>
          Duyệt
        </Button>
      ) : null,
    },
  ]

  const paymentColumns: ColumnsType<CashPayment> = [
    { title: 'STT', width: 52, align: 'center' as const, render: (_v, _r, i) => (pagePayment - 1) * 20 + i + 1 },
    { title: 'Ngày', dataIndex: 'ngay_phieu', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số chứng từ', dataIndex: 'so_phieu', width: 155, render: (v, r) => <a onClick={() => navigate(`/accounting/payments/${r.id}`)}>{v}</a> },
    { title: 'Đối tượng', dataIndex: 'ten_don_vi', ellipsis: true, render: (v, r) => v ?? `NCC#${r.supplier_id}` },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true, render: v => v ?? '—' },
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right' as const, width: 140, render: v => fmtVND(v) },
    { title: 'TK Nợ', dataIndex: 'tk_no', width: 80, render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: 'TK Có', dataIndex: 'tk_co', width: 80, render: v => v ? <Tag color="purple">{v}</Tag> : '—' },
    { title: 'Khoản mục CP', dataIndex: 'ten_khoan_muc', width: 160, ellipsis: true, render: v => v ?? '—' },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 130, ellipsis: true, render: v => v ?? '—' },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 120, ellipsis: true, render: v => v ?? '—' },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => { const s = PAYMENT_STATUS[v]; return <Tag color={s?.color}>{s?.label ?? v}</Tag> },
    },
    {
      title: '', key: 'action', width: 72, fixed: 'right' as const,
      render: (_v, r: CashPayment) => {
        if (r.trang_thai === 'cho_chot') return <Button size="small" onClick={e => { e.stopPropagation(); handleQuickActionPayment(r.id, r.trang_thai) }}>Chốt</Button>
        if (r.trang_thai === 'da_chot') return <Button size="small" type="primary" ghost onClick={e => { e.stopPropagation(); handleQuickActionPayment(r.id, r.trang_thai) }}>Duyệt</Button>
        return null
      },
    },
  ]

  const { displayColumns: displayReceiptCols, settingsButton: receiptSettings } = useColumnPrefs('tm-receipt', receiptColumns, { nonHideable: ['so_phieu'] })
  const { displayColumns: displayPaymentCols, settingsButton: paymentSettings } = useColumnPrefs('tm-payment', paymentColumns, { nonHideable: ['so_phieu'] })

  return (
    <PageLayout
      title="Quỹ Tiền Mặt"
      actions={
        <Space>
          <Dropdown menu={{ items: bulkMenu }} trigger={['click']}>
            <Button>
              Thực hiện hàng loạt{selectedCount > 0 ? ` (${selectedCount})` : ''} <DownOutlined />
            </Button>
          </Dropdown>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          {activeTab === 'thu' ? (
            <>
              <Dropdown menu={{ items: receiptCreateMenu }} trigger={['click']}>
                <Button type="primary" icon={<PlusOutlined />}>Thu tiền mặt <DownOutlined /></Button>
              </Dropdown>
              {receiptSettings}
            </>
          ) : (
            <>
              <Dropdown menu={{ items: paymentCreateMenu }} trigger={['click']}>
                <Button type="primary" icon={<PlusOutlined />}>Chi tiền mặt <DownOutlined /></Button>
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
          <Col>
            <Input.Search
              style={{ width: 220 }}
              placeholder="Tìm tên khách / NCC..."
              allowClear
              onSearch={v => { setSearchQ(v); setPageReceipt(1); setPagePayment(1) }}
              onChange={e => { if (!e.target.value) { setSearchQ(''); setPageReceipt(1); setPagePayment(1) } }}
            />
          </Col>
        </Row>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={k => {
          setActiveTab(k as 'thu' | 'chi')
          setSelectedReceiptKeys([])
          setSelectedPaymentKeys([])
        }}
        items={[
          {
            key: 'thu',
            label: `Thu tiền mặt${totalReceipts ? ` (${totalReceipts})` : ''}`,
            children: (
              <>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col>
                    <Statistic
                      title="Tổng thu kỳ này"
                      value={tongThu}
                      suffix="đ"
                      valueStyle={{ color: '#52c41a', fontSize: 16 }}
                      formatter={v => Number(v).toLocaleString('vi-VN')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Tổng chi kỳ này"
                      value={tongChi}
                      suffix="đ"
                      valueStyle={{ color: '#ff4d4f', fontSize: 16 }}
                      formatter={v => Number(v).toLocaleString('vi-VN')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Chênh lệch (Thu − Chi)"
                      value={tongThu - tongChi}
                      suffix="đ"
                      valueStyle={{ color: tongThu - tongChi >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 16, fontWeight: 700 }}
                      formatter={v => Number(v).toLocaleString('vi-VN')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Số phiếu thu"
                      value={totalReceipts}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                </Row>
                <Table
                  locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
                  rowSelection={{
                    type: 'checkbox',
                    selectedRowKeys: selectedReceiptKeys,
                    onChange: keys => setSelectedReceiptKeys(keys as number[]),
                  }}
                  columns={displayReceiptCols}
                  dataSource={receipts}
                  rowKey="id"
                  loading={receiptLoading}
                  size="small"
                  expandable={{ expandedRowRender: expandedReceiptRender }}
                  pagination={{
                    current: pageReceipt,
                    total: totalReceipts,
                    pageSize: 20,
                    showTotal: t => `${t} phiếu thu`,
                    onChange: p => { setPageReceipt(p); setSelectedReceiptKeys([]) },
                  }}
                />
              </>
            ),
          },
          {
            key: 'chi',
            label: `Chi tiền mặt${totalPayments ? ` (${totalPayments})` : ''}`,
            children: (
              <>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col>
                    <Statistic
                      title="Tổng chi kỳ này"
                      value={tongChi}
                      suffix="đ"
                      valueStyle={{ color: '#ff4d4f', fontSize: 16 }}
                      formatter={v => Number(v).toLocaleString('vi-VN')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Tổng thu kỳ này"
                      value={tongThu}
                      suffix="đ"
                      valueStyle={{ color: '#52c41a', fontSize: 16 }}
                      formatter={v => Number(v).toLocaleString('vi-VN')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Chênh lệch (Thu − Chi)"
                      value={tongThu - tongChi}
                      suffix="đ"
                      valueStyle={{ color: tongThu - tongChi >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 16, fontWeight: 700 }}
                      formatter={v => Number(v).toLocaleString('vi-VN')}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title="Số phiếu chi"
                      value={totalPayments}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                </Row>
                <Table
                  locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
                  rowSelection={{
                    type: 'checkbox',
                    selectedRowKeys: selectedPaymentKeys,
                    onChange: keys => setSelectedPaymentKeys(keys as number[]),
                  }}
                  columns={displayPaymentCols}
                  dataSource={payments}
                  rowKey="id"
                  loading={paymentLoading}
                  size="small"
                  expandable={{ expandedRowRender: expandedPaymentRender }}
                  pagination={{
                    current: pagePayment,
                    total: totalPayments,
                    pageSize: 20,
                    showTotal: t => `${t} phiếu chi`,
                    onChange: p => { setPagePayment(p); setSelectedPaymentKeys([]) },
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
