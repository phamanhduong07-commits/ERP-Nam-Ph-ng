import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Modal, Row, Select, Space, Table, Tag, Typography,
  message, Switch, Tooltip,
} from 'antd'
import {
  PlusOutlined, FileExcelOutlined, FilePdfOutlined, EyeOutlined, ImportOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND } from '../../utils/exportUtils'
import {
  billingApi, SalesInvoiceListItem,
  TRANG_THAI_INVOICE, HINH_THUC_TT,
} from '../../api/billing'
import { salesOrdersApi, SalesOrderListItem, TRANG_THAI_COLORS as SO_STATUS_COLORS } from '../../api/salesOrders'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function SalesInvoiceListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [quaHanOnly, setQuaHanOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [showFromSOModal, setShowFromSOModal] = useState(false)
  const [soSearch, setSoSearch] = useState('')
  const [selectedSOId, setSelectedSOId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['billing-invoices', tuNgay, denNgay, filterTrangThai, quaHanOnly, page],
    queryFn: () =>
      billingApi.listInvoices({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        trang_thai: filterTrangThai,
        qua_han_only: quaHanOnly || undefined,
        page,
        page_size: 20,
      }),
  })

  const invoices: SalesInvoiceListItem[] = data?.items ?? []
  const total: number = data?.total ?? 0

  const { data: soData, isLoading: soLoading } = useQuery({
    queryKey: ['so-for-invoice', soSearch],
    queryFn: () =>
      salesOrdersApi.list({
        trang_thai: 'da_duyet',
        search: soSearch || undefined,
        page_size: 50,
      }).then(r => r.data.items ?? []),
    enabled: showFromSOModal,
  })
  const soList: SalesOrderListItem[] = soData ?? []

  const fromSOmut = useMutation({
    mutationFn: (orderId: number) => billingApi.createFromOrder(orderId),
    onSuccess: (inv: any) => {
      message.success('Đã tạo hóa đơn từ đơn hàng')
      qc.invalidateQueries({ queryKey: ['billing-invoices'] })
      setShowFromSOModal(false)
      setSelectedSOId(null)
      navigate(`/billing/invoices/${inv.id}`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi tạo hóa đơn'),
  })

  const tongConLai = invoices.reduce((s, i) => s + (i.con_lai ?? 0), 0)
  const tongDaTT = invoices.reduce((s, i) => s + (i.da_thanh_toan ?? 0), 0)

  const handleExcel = () => {
    const rows = invoices.map(i => ({
      'Số HĐ': i.so_hoa_don ?? '',
      'Ngày HĐ': i.ngay_hoa_don,
      'Hạn TT': i.han_tt ?? '',
      'Khách hàng': i.ten_don_vi ?? '',
      'Tổng tiền': i.tong_cong,
      'Đã TT': i.da_thanh_toan,
      'Còn lại': i.con_lai,
      'Trạng thái': TRANG_THAI_INVOICE[i.trang_thai]?.label ?? i.trang_thai,
    }))
    exportToExcel(`hoa-don-ban-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Hoa don ban',
      headers: Object.keys(rows[0] ?? {}),
      rows: rows.map(r => Object.values(r)),
    }])
  }

  const handlePrint = () => {
    const headers = ['Số HĐ', 'Ngày HĐ', 'Hạn TT', 'Khách hàng', 'Tổng tiền', 'Đã TT', 'Còn lại', 'Trạng thái']
    const rows = invoices.map(i => [
      i.so_hoa_don ?? '',
      i.ngay_hoa_don,
      i.han_tt ?? '',
      i.ten_don_vi ?? '',
      fmtVND(i.tong_cong),
      fmtVND(i.da_thanh_toan),
      fmtVND(i.con_lai),
      TRANG_THAI_INVOICE[i.trang_thai]?.label ?? i.trang_thai,
    ])
    printToPdf('Danh sách hóa đơn bán hàng', buildHtmlTable(headers.map(header => ({ header })), rows))
  }

  const columns: ColumnsType<SalesInvoiceListItem> = [
    {
      title: 'Số hóa đơn',
      dataIndex: 'so_hoa_don',
      width: 150,
      render: (v, r) => (
        <a onClick={() => navigate(`/billing/invoices/${r.id}`)}>{v ?? `#${r.id}`}</a>
      ),
    },
    {
      title: 'Ngày HĐ',
      dataIndex: 'ngay_hoa_don',
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
    {
      title: 'Khách hàng',
      dataIndex: 'ten_don_vi',
      ellipsis: true,
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'tong_cong',
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
        const s = TRANG_THAI_INVOICE[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
    {
      title: '',
      width: 50,
      render: (_, r) => (
        <Tooltip title="Xem chi tiết">
          <Button
            type="text" size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/billing/invoices/${r.id}`)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Hóa đơn bán hàng</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          <Button icon={<FilePdfOutlined />} onClick={handlePrint}>In</Button>
          <Button
            icon={<ImportOutlined />}
            onClick={() => { setShowFromSOModal(true); setSoSearch('') }}
          >
            Từ đơn hàng
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/billing/invoices/new')}>
            Tạo hóa đơn
          </Button>
        </Space>
      </div>

      {/* Filter bar */}
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
              options={Object.entries(TRANG_THAI_INVOICE).map(([k, v]) => ({
                value: k, label: v.label,
              }))}
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

      {/* Tóm tắt */}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tổng còn lại: </Text>
          <Text strong style={{ color: tongConLai > 0 ? '#fa8c16' : '#52c41a' }}>
            {fmtVND(tongConLai)}
          </Text>
        </Col>
        <Col>
          <Text type="secondary">Đã thu: </Text>
          <Text strong>{fmtVND(tongDaTT)}</Text>
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

      <Modal
        open={showFromSOModal}
        title="Tạo hóa đơn từ đơn hàng"
        onCancel={() => { setShowFromSOModal(false); setSelectedSOId(null) }}
        onOk={() => selectedSOId && fromSOmut.mutate(selectedSOId)}
        okText="Tạo hóa đơn"
        okButtonProps={{ disabled: !selectedSOId, loading: fromSOmut.isPending }}
        width={700}
      >
        <Input.Search
          placeholder="Tìm đơn hàng (số đơn, khách hàng)..."
          style={{ marginBottom: 12 }}
          allowClear
          onSearch={v => setSoSearch(v)}
          onChange={e => !e.target.value && setSoSearch('')}
        />
        <Table<SalesOrderListItem>
          size="small"
          loading={soLoading}
          dataSource={soList}
          rowKey="id"
          pagination={{ pageSize: 8, showTotal: t => `${t} đơn hàng` }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedSOId ? [selectedSOId] : [],
            onChange: keys => setSelectedSOId(keys[0] as number),
          }}
          onRow={r => ({ onClick: () => setSelectedSOId(r.id) })}
          columns={[
            { title: 'Số đơn', dataIndex: 'so_don', width: 130 },
            { title: 'Ngày', dataIndex: 'ngay_don', width: 100, render: v => dayjs(v).format('DD/MM/YYYY') },
            { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
            {
              title: 'Tổng tiền', dataIndex: 'tong_tien', align: 'right', width: 130,
              render: v => fmtVND(v ?? 0),
            },
            {
              title: 'Trạng thái', dataIndex: 'trang_thai', width: 120,
              render: v => <Tag color={SO_STATUS_COLORS[v]}>{v}</Tag>,
            },
          ]}
        />
      </Modal>
    </div>
  )
}
