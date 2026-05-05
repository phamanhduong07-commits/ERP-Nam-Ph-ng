import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Switch, Table, Tag, Typography,
} from 'antd'
import { PlusOutlined, FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import { purchaseInvoiceApi, TRANG_THAI_PO_INVOICE } from '../../api/accounting'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function PurchaseInvoiceListPage() {
  const navigate = useNavigate()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [quaHanOnly, setQuaHanOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoices', tuNgay, denNgay, filterTrangThai, quaHanOnly, page],
    queryFn: () =>
      purchaseInvoiceApi.list({
        tu_ngay: tuNgay, den_ngay: denNgay,
        trang_thai: filterTrangThai,
        qua_han_only: quaHanOnly || undefined,
        page, page_size: 20,
      }),
  })

  const invoices = data?.items ?? data ?? []
  const total: number = data?.total ?? invoices.length
  const tongConLai = invoices.reduce((s: number, i: any) => s + (i.con_lai ?? 0), 0)

  const handleExcel = () => {
    const rows = invoices.map((i: any) => ({
      'Số HĐ': i.so_hoa_don ?? '',
      'Ngày lập': i.ngay_lap,
      'Hạn TT': i.han_tt ?? '',
      'Nhà cung cấp': i.ten_don_vi ?? '',
      'Tổng tiền': i.tong_thanh_toan,
      'Đã TT': i.da_thanh_toan,
      'Còn lại': i.con_lai,
      'Trạng thái': TRANG_THAI_PO_INVOICE[i.trang_thai]?.label ?? i.trang_thai,
    }))
    exportToExcel(`hoa-don-mua-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Hoa don mua',
      headers: Object.keys(rows[0] ?? {}),
      rows: rows.map((r: Record<string, string | number>) => Object.values(r)),
    }])
  }

  const columns: ColumnsType<any> = [
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
        if (!v) return '—'
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
        const s = TRANG_THAI_PO_INVOICE[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Hóa đơn mua hàng</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/accounting/purchase-invoices/new')}>
            Tạo hóa đơn
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
              style={{ width: 180 }} allowClear placeholder="Trạng thái"
              onChange={v => { setFilterTrangThai(v); setPage(1) }}
              options={Object.entries(TRANG_THAI_PO_INVOICE).map(([k, v]) => ({ value: k, label: v.label }))}
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
