import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, Space, Tag, Card, Typography,
  DatePicker, Row, Col, Tooltip, Popconfirm, message,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  PlayCircleOutlined, CheckCircleOutlined, CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionOrdersApi,
  TRANG_THAI_LABELS,
  TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type { ProductionOrderListItem } from '../../api/productionOrders'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface Props {
  selectedId?: number | null
  onSelect?: (id: number) => void
}

export default function ProductionOrderList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)

  const isEmbedded = !!onSelect

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['production-orders', search, trangThai, dateRange, page],
    queryFn: () =>
      productionOrdersApi
        .list({
          search,
          trang_thai: trangThai,
          tu_ngay: dateRange?.[0],
          den_ngay: dateRange?.[1],
          page,
          page_size: 20,
        })
        .then((r) => r.data),
  })

  const handleStart = async (id: number, soLenh: string) => {
    try {
      await productionOrdersApi.start(id)
      message.success(`Đã bắt đầu sản xuất lệnh ${soLenh}`)
      refetch()
    } catch {
      message.error('Thất bại')
    }
  }

  const handleComplete = async (id: number, soLenh: string) => {
    try {
      await productionOrdersApi.complete(id)
      message.success(`Lệnh ${soLenh} hoàn thành`)
      refetch()
    } catch {
      message.error('Thất bại')
    }
  }

  const handleCancel = async (id: number, soLenh: string) => {
    try {
      await productionOrdersApi.cancel(id)
      message.success(`Đã huỷ lệnh ${soLenh}`)
      refetch()
    } catch {
      message.error('Thất bại')
    }
  }

  const compactColumns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Số lệnh',
      dataIndex: 'so_lenh',
      render: (v) => <Text style={{ color: '#1677ff', fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_lenh',
      width: 76,
      render: (v) => dayjs(v).format('DD/MM/YY'),
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'so_don',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 86,
      render: (v) => <Tag color={TRANG_THAI_COLORS[v]} style={{ fontSize: 11 }}>{TRANG_THAI_LABELS[v] || v}</Tag>,
    },
  ]

  const fullColumns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Số lệnh',
      dataIndex: 'so_lenh',
      width: 160,
      render: (v, r) => (
        <Button type="link" onClick={() => navigate(`/production/orders/${r.id}`)} style={{ padding: 0 }}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày lệnh',
      dataIndex: 'ngay_lenh',
      width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'so_don',
      width: 140,
      render: (v) => v || '—',
    },
    {
      title: 'Hoàn thành dự kiến',
      dataIndex: 'ngay_hoan_thanh_ke_hoach',
      width: 150,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Số dòng',
      dataIndex: 'so_dong',
      width: 80,
      align: 'center',
    },
    {
      title: 'SL kế hoạch',
      dataIndex: 'tong_sl_ke_hoach',
      width: 120,
      align: 'right',
      render: (v) => new Intl.NumberFormat('vi-VN').format(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v) => <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Thao tác',
      width: 140,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/production/orders/${r.id}`)} />
          </Tooltip>
          {r.trang_thai === 'moi' && (
            <Tooltip title="Bắt đầu SX">
              <Popconfirm
                title={`Bắt đầu sản xuất lệnh ${r.so_lenh}?`}
                onConfirm={() => handleStart(r.id, r.so_lenh)}
                okText="Bắt đầu"
              >
                <Button size="small" type="primary" icon={<PlayCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['moi', 'dang_chay'].includes(r.trang_thai) && (
            <Tooltip title="Hoàn thành">
              <Popconfirm
                title={`Đánh dấu hoàn thành lệnh ${r.so_lenh}?`}
                onConfirm={() => handleComplete(r.id, r.so_lenh)}
                okText="Hoàn thành"
              >
                <Button size="small" icon={<CheckCircleOutlined />} style={{ color: 'green', borderColor: 'green' }} />
              </Popconfirm>
            </Tooltip>
          )}
          {['moi', 'dang_chay'].includes(r.trang_thai) && (
            <Tooltip title="Huỷ lệnh">
              <Popconfirm
                title={`Huỷ lệnh ${r.so_lenh}?`}
                onConfirm={() => handleCancel(r.id, r.so_lenh)}
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
            <Title level={5} style={{ margin: 0 }}>Lệnh sản xuất</Title>
          </Col>
          <Col>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => navigate('/production/orders/new')}
            >
              Tạo lệnh SX
            </Button>
          </Col>
        </Row>

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số lệnh..."
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

        {!isEmbedded && (
          <Row style={{ marginTop: 8 }}>
            <Col span={24}>
              <RangePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder={['Từ ngày', 'Đến ngày']}
                onChange={(_, s) => {
                  setDateRange(
                    s[0] && s[1]
                      ? [
                          dayjs(s[0], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                          dayjs(s[1], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                        ]
                      : null
                  )
                  setPage(1)
                }}
              />
            </Col>
          </Row>
        )}
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
          showTotal: (t) => `${t} lệnh`,
          showSizeChanger: false,
          size: 'small',
        }}
        size="small"
        scroll={isEmbedded ? undefined : { x: 950 }}
      />
    </div>
  )
}
