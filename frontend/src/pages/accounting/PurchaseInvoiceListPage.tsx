import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Switch, Table, Tag, Typography,
} from 'antd'
import { FileExcelOutlined, WalletOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import { purchaseInvoiceApi, PurchaseInvoice } from '../../api/accounting'
import { usePhapNhan } from '../../hooks/useMasterData'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  nhap: { label: 'Nháp', color: 'default' },
  da_tt_mot_phan: { label: 'TT một phần', color: 'orange' },
  da_tt_du: { label: 'Đã thanh toán đủ', color: 'green' },
  qua_han: { label: 'Quá hạn', color: 'red' },
  huy: { label: 'Đã hủy', color: 'default' },
}

export default function PurchaseInvoiceListPage() {
  const navigate = useNavigate()
  const { phapNhanList } = usePhapNhan()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [quaHanOnly, setQuaHanOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoices', tuNgay, denNgay, filterTrangThai, filterPhapNhan, quaHanOnly, page],
    queryFn: () =>
      purchaseInvoiceApi.list({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        trang_thai: filterTrangThai,
        phap_nhan_id: filterPhapNhan,
        qua_han_only: quaHanOnly || undefined,
        page,
        page_size: 20,
      }),
  })

  const invoices: PurchaseInvoice[] = data?.items ?? data ?? []
  const total: number = data?.total ?? invoices.length
  const tongConLai = invoices.reduce((s: number, i: PurchaseInvoice) => s + (i.con_lai ?? 0), 0)

  const handleExcel = () => {
    const rows = invoices.map((i: PurchaseInvoice) => ({
      'Số HĐ': i.so_hoa_don ?? '',
      'Ngày lập': i.ngay_lap,
      'Hạn TT': i.han_tt ?? '',
      'Nhà cung cấp': i.ten_don_vi ?? '',
      'Tổng tiền': i.tong_thanh_toan,
      'Đã TT': i.da_thanh_toan,
      'Còn lại': i.con_lai,
      'Trạng thái': INVOICE_STATUS[i.trang_thai]?.label ?? i.trang_thai,
    }))
    exportToExcel(`hoa-don-mua-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Hoa don mua',
      headers: Object.keys(rows[0] ?? {}),
      rows: rows.map((r: Record<string, string | number>) => Object.values(r)),
    }])
  }

  const canPayInvoice = (r: PurchaseInvoice) =>
    ['nhap', 'da_tt_mot_phan', 'qua_han'].includes(r.trang_thai) && Number(r.con_lai || 0) > 0

  const columns: ColumnsType<PurchaseInvoice> = [
    {
      title: 'Số hóa đơn',
      dataIndex: 'so_hoa_don',
      width: 150,
      render: (v, r) => (
        <a onClick={() => navigate(`/accounting/purchase-invoices/${r.id}`)}>{v ?? `#${r.id}`}</a>
      ),
    },
    {
      title: 'Ngày lập',
      dataIndex: 'ngay_lap',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Hạn TT',
      dataIndex: 'han_tt',
      width: 110,
      render: (v, r) => {
        if (!v) return '-'
        const overdue = r.trang_thai === 'qua_han'
        return <span style={{ color: overdue ? '#f5222d' : undefined }}>{dayjs(v).format('DD/MM/YYYY')}</span>
      },
    },
    { title: 'Nhà cung cấp', dataIndex: 'ten_don_vi', ellipsis: true },
    {
      title: 'Tổng tiền',
      dataIndex: 'tong_thanh_toan',
      align: 'right',
      width: 130,
      render: v => fmtVND(v),
    },
    {
      title: 'Đã thanh toán',
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
        <Text strong style={{ color: v > 0 ? (r.trang_thai === 'qua_han' ? '#f5222d' : '#fa8c16') : '#52c41a' }}>
          {fmtVND(v)}
        </Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 150,
      render: v => {
        const s = INVOICE_STATUS[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, r) => canPayInvoice(r) ? (
        <Button size="small" icon={<WalletOutlined />} onClick={() => navigate(`/accounting/payments/new?invoice_id=${r.id}`)}>
          Chi tiền
        </Button>
      ) : null,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Hóa đơn mua hàng</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          <Button icon={<WalletOutlined />} onClick={() => navigate('/accounting/payments')}>
            Phiếu chi
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
                setPage(1)
              }}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }}
              allowClear
              placeholder="Trạng thái"
              onChange={v => { setFilterTrangThai(v); setPage(1) }}
              options={Object.entries(INVOICE_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }}
              allowClear
              placeholder="Pháp nhân"
              onChange={v => { setFilterPhapNhan(v); setPage(1) }}
              options={phapNhanList.map((p) => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
          <Col>
            <Space>
              <span style={{ fontSize: 13 }}>Chỉ quá hạn</span>
              <Switch checked={quaHanOnly} onChange={v => { setQuaHanOnly(v); setPage(1) }} />
            </Space>
          </Col>
        </Row>
      </Card>

      <Row style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tổng còn nợ NCC: </Text>
          <Text strong style={{ color: tongConLai > 0 ? '#f5222d' : '#52c41a' }}>{fmtVND(tongConLai)}</Text>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={invoices}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showTotal: t => `${t} hóa đơn`,
          onChange: p => setPage(p),
        }}
        rowClassName={r => r.trang_thai === 'qua_han' ? 'row-overdue' : ''}
      />
      <style>{`.row-overdue td { background: #fff1f0 !important; }`}</style>
    </div>
  )
}
