import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Space, Tag, Input, Select, DatePicker,
  Popconfirm, message, Card, Row, Col, Typography, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CheckCircleOutlined, StopOutlined, FileAddOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { quotesApi, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../api/quotes'
import type { QuoteListItem } from '../../api/quotes'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function QuoteList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | []>([])
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', search, trangThai, dateRange, page],
    queryFn: () =>
      quotesApi.list({
        search,
        trang_thai: trangThai,
        tu_ngay: dateRange[0],
        den_ngay: dateRange[1],
        page,
        page_size: 20,
      }).then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => quotesApi.approve(id),
    onSuccess: () => {
      message.success('Đã duyệt báo giá')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => quotesApi.cancel(id),
    onSuccess: () => {
      message.success('Đã huỷ báo giá')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi huỷ'),
  })

  const taoDonMutation = useMutation({
    mutationFn: (id: number) => quotesApi.taoDonHang(id),
    onSuccess: (res) => {
      message.success(`Đã tạo ${res.data.so_don}`)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      navigate(`/sales/orders`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo đơn'),
  })

  const columns: ColumnsType<QuoteListItem> = [
    {
      title: 'Số BG',
      dataIndex: 'so_bao_gia',
      width: 140,
      render: (v, row) => (
        <Button type="link" size="small" onClick={() => navigate(`/quotes/${row.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_bao_gia',
      width: 100,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'Ngày HH',
      dataIndex: 'ngay_het_han',
      width: 100,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Số dòng',
      dataIndex: 'so_dong',
      width: 80,
      align: 'center',
    },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_cong',
      width: 140,
      align: 'right',
      render: (v) => v ? v.toLocaleString('vi-VN') + ' ₫' : '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v) => (
        <Tag color={QUOTE_STATUS_COLORS[v] || 'default'}>
          {QUOTE_STATUS_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/quotes/${row.id}`)} />
          </Tooltip>
          {row.trang_thai === 'moi' && (
            <Tooltip title="Duyệt">
              <Popconfirm title="Duyệt báo giá này?" onConfirm={() => approveMutation.mutate(row.id)}>
                <Button size="small" icon={<CheckCircleOutlined />} type="primary" ghost />
              </Popconfirm>
            </Tooltip>
          )}
          {(row.trang_thai === 'moi' || row.trang_thai === 'da_duyet') && (
            <Tooltip title="Lập đơn hàng">
              <Popconfirm title="Tạo đơn hàng từ báo giá này?" onConfirm={() => taoDonMutation.mutate(row.id)}>
                <Button size="small" icon={<FileAddOutlined />} type="primary" />
              </Popconfirm>
            </Tooltip>
          )}
          {row.trang_thai !== 'huy' && (
            <Tooltip title="Huỷ">
              <Popconfirm title="Huỷ báo giá này?" onConfirm={() => cancelMutation.mutate(row.id)}>
                <Button size="small" icon={<StopOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>📋 Báo giá</Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/quotes/new')}
            >
              Thêm báo giá mới
            </Button>
          </Col>
        </Row>

        <Row gutter={12} style={{ marginTop: 16 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số BG, tên khách hàng..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Trạng thái"
              style={{ width: 140 }}
              allowClear
              value={trangThai}
              onChange={(v) => { setTrangThai(v); setPage(1) }}
              options={Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Col>
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={(_, s) => { setDateRange(s[0] && s[1] ? [s[0], s[1]] : []); setPage(1) }}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={data?.items || []}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total || 0,
            onChange: setPage,
            showTotal: (t) => `Tổng ${t} báo giá`,
            showSizeChanger: false,
          }}
          size="small"
        />
      </Card>
    </div>
  )
}
