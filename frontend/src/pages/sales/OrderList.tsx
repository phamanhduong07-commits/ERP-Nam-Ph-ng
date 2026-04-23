import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, Space, Tag, Card, Typography,
  DatePicker, Row, Col, Tooltip, Popconfirm, message,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CheckOutlined, CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '../../api/salesOrders'
import type { SalesOrderListItem } from '../../api/salesOrders'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function OrderList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)

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

  const columns: ColumnsType<SalesOrderListItem> = [
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
    <Card>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Danh sách đơn hàng</Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/sales/orders/new')}
          >
            Tạo đơn hàng
          </Button>
        </Col>
      </Row>

      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Input
            placeholder="Tìm số đơn, khách hàng..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
        </Col>
        <Col xs={24} sm={6}>
          <Select
            placeholder="Trạng thái"
            style={{ width: '100%' }}
            allowClear
            value={trangThai}
            onChange={(v) => { setTrangThai(v); setPage(1) }}
            options={Object.entries(TRANG_THAI_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
        </Col>
        <Col xs={24} sm={10}>
          <RangePicker
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
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

      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
          showTotal: (t) => `Tổng ${t} đơn hàng`,
          showSizeChanger: false,
        }}
        size="middle"
        scroll={{ x: 900 }}
      />
    </Card>
  )
}
