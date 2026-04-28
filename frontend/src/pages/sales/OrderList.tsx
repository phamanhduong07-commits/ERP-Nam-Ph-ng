import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, Space, Tag, Card, Typography,
  DatePicker, Row, Col, Tooltip, Popconfirm, message,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CheckOutlined, CloseOutlined, FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '../../api/salesOrders'
import type { SalesOrderListItem } from '../../api/salesOrders'
import { exportToExcel, printToPdf, fmtVND, fmtDate, buildHtmlTable } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface Props {
  selectedId?: number | null
  onSelect?: (id: number) => void
}

export default function OrderList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)

  const isEmbedded = !!onSelect

  const handleExportExcel = () => {
    const items = data?.items ?? []
    exportToExcel(`DonHang_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Đơn hàng',
      headers: ['STT', 'Số đơn hàng', 'Ngày đơn', 'Khách hàng', 'Ngày giao', 'Số dòng', 'Tổng tiền (đ)', 'Trạng thái'],
      rows: items.map((r, i) => [
        i + 1, r.so_don, fmtDate(r.ngay_don), r.ten_khach_hang ?? '',
        fmtDate(r.ngay_giao_hang), r.so_dong, Number(r.tong_tien), TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
      ]),
      colWidths: [5, 18, 12, 30, 12, 8, 16, 14],
    }])
  }

  const handleExportPdf = () => {
    const items = data?.items ?? []
    const cols = [
      { header: 'STT', align: 'center' as const },
      { header: 'Số đơn hàng' }, { header: 'Ngày đơn' }, { header: 'Khách hàng' },
      { header: 'Ngày giao' }, { header: 'Số dòng', align: 'center' as const },
      { header: 'Tổng tiền (đ)', align: 'right' as const }, { header: 'Trạng thái' },
    ]
    const rows = items.map((r, i) => [
      i + 1, r.so_don, fmtDate(r.ngay_don), r.ten_khach_hang ?? '',
      fmtDate(r.ngay_giao_hang), r.so_dong, fmtVND(r.tong_tien), TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
    ])
    const table = buildHtmlTable(cols, rows)
    printToPdf(
      `Danh sách đơn hàng`,
      `<h2>DANH SÁCH ĐƠN HÀNG</h2>
       <p class="meta">Xuất ngày: ${dayjs().format('DD/MM/YYYY HH:mm')} — ${items.length} đơn hàng</p>
       ${table}`,
      true,
    )
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales-orders', search, trangThai, dateRange, page],
    queryFn: () => salesOrdersApi.list({
      search,
      trang_thai: trangThai,
      tu_ngay: dateRange?.[0],
      den_ngay: dateRange?.[1],
      page,
      page_size: 20,
    }).then((r) => r.data),
  })

  const handleApprove = async (id: number, soDon: string) => {
    try {
      await salesOrdersApi.approve(id)
      message.success(`Đã duyệt đơn hàng ${soDon}`)
      refetch()
    } catch {
      message.error('Duyệt đơn thất bại')
    }
  }

  const handleCancel = async (id: number, soDon: string) => {
    try {
      await salesOrdersApi.cancel(id)
      message.success(`Đã huỷ đơn hàng ${soDon}`)
      refetch()
    } catch {
      message.error('Huỷ đơn thất bại')
    }
  }

  const compactColumns: ColumnsType<SalesOrderListItem> = [
    {
      title: 'Số đơn',
      dataIndex: 'so_don',
      render: (v) => <Text style={{ color: '#1677ff', fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_don',
      width: 76,
      render: (v) => dayjs(v).format('DD/MM/YY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 90,
      render: (v) => <Tag color={TRANG_THAI_COLORS[v]} style={{ fontSize: 11 }}>{TRANG_THAI_LABELS[v] || v}</Tag>,
    },
  ]

  const fullColumns: ColumnsType<SalesOrderListItem> = [
    {
      title: 'Số đơn',
      dataIndex: 'so_don',
      width: 140,
      render: (v, r) => (
        <Button type="link" onClick={() => navigate(`/sales/orders/${r.id}`)} style={{ padding: 0 }}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày lập',
      dataIndex: 'created_at',
      width: 130,
      render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Ngày đơn',
      dataIndex: 'ngay_don',
      width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 110,
      render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Số dòng',
      dataIndex: 'so_dong',
      width: 80,
      align: 'center',
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'tong_tien',
      width: 130,
      align: 'right',
      render: (v) => new Intl.NumberFormat('vi-VN').format(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      render: (v) => (
        <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/sales/orders/${r.id}`)} />
          </Tooltip>
          {r.trang_thai === 'moi' && (
            <Tooltip title="Duyệt đơn">
              <Popconfirm
                title={`Duyệt đơn hàng ${r.so_don}?`}
                onConfirm={() => handleApprove(r.id, r.so_don)}
                okText="Duyệt"
              >
                <Button size="small" type="primary" icon={<CheckOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['moi', 'da_duyet'].includes(r.trang_thai) && (
            <Tooltip title="Huỷ đơn">
              <Popconfirm
                title={`Huỷ đơn hàng ${r.so_don}?`}
                onConfirm={() => handleCancel(r.id, r.so_don)}
                okText="Huỷ"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<CloseOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <style>{`.md-selected-row > td { background-color: #e6f4ff !important; }`}</style>

      <Card style={{ marginBottom: 8 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={5} style={{ margin: 0 }}>Đơn hàng</Title>
          </Col>
          <Col>
            <Space size={4}>
              {!isEmbedded && (
                <>
                  <Tooltip title="Xuất Excel">
                    <Button size="small" icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel} />
                  </Tooltip>
                  <Tooltip title="Xuất PDF">
                    <Button size="small" icon={<FilePdfOutlined />} style={{ color: '#e53935', borderColor: '#e53935' }} onClick={handleExportPdf} />
                  </Tooltip>
                </>
              )}
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => navigate('/sales/orders/new')}
              >
                Tạo đơn hàng
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số đơn, khách hàng..."
              prefix={<SearchOutlined />}
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="TT"
              size="small"
              style={{ width: 110 }}
              allowClear
              value={trangThai}
              onChange={(v) => { setTrangThai(v); setPage(1) }}
              options={Object.entries(TRANG_THAI_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Col>
        </Row>

        <Row style={{ marginTop: 8 }}>
          <Col span={24}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder={['Ngày đơn từ', 'Đến ngày']}
              onChange={(_, s) => {
                setDateRange(s[0] && s[1] ? [
                  dayjs(s[0], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                  dayjs(s[1], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                ] : null)
                setPage(1)
              }}
            />
          </Col>
        </Row>
      </Card>

      <Table
        columns={isEmbedded ? compactColumns : fullColumns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        rowClassName={(r) => r.id === selectedId ? 'md-selected-row' : ''}
        onRow={(r) => ({
          onClick: isEmbedded ? () => onSelect!(r.id) : undefined,
          style: isEmbedded ? { cursor: 'pointer' } : undefined,
        })}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
          showTotal: (t) => `${t} đơn hàng`,
          showSizeChanger: false,
          size: 'small',
        }}
        size="small"
        scroll={isEmbedded ? undefined : { x: 900 }}
      />
    </div>
  )
}
