import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Row,
  Select, Space, Statistic, Table, Tag, Typography,
} from 'antd'
import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { cd2Api, PhieuIn, TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '../../api/cd2'

const { Title } = Typography
const { RangePicker } = DatePicker

const TRANG_THAI_OPTIONS = Object.entries(TRANG_THAI_LABELS)
  .filter(([k]) => k !== 'huy')
  .map(([value, label]) => ({ value, label }))

export default function PhieuInHistoryPage() {
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const days = dateRange
    ? Math.max(1, dateRange[1].diff(dateRange[0], 'day') + 1)
    : 30

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['cd2-history-phieu-in', days, search, trangThai],
    queryFn: () =>
      cd2Api.getHistoryPhieuIn({
        days,
        search: search.trim() || undefined,
        trang_thai: trangThai ?? undefined,
      }).then(r => r.data),
  })

  // Lọc thêm nếu có date range
  const filtered = dateRange
    ? rows.filter((r: PhieuIn) => {
        const d = dayjs(r.created_at)
        return (
          d.isAfter(dateRange[0].startOf('day').subtract(1, 'ms')) &&
          d.isBefore(dateRange[1].endOf('day').add(1, 'ms'))
        )
      })
    : rows

  const totalPhoi = filtered.reduce((s: number, r: PhieuIn) => s + (r.so_luong_phoi ?? 0), 0)
  const totalOk = filtered.reduce((s: number, r: PhieuIn) => s + (r.so_luong_in_ok ?? 0), 0)
  const totalSauInOk = filtered.reduce((s: number, r: PhieuIn) => s + (r.so_luong_sau_in_ok ?? 0), 0)

  const columns = [
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YY'),
      sorter: (a: PhieuIn, b: PhieuIn) =>
        dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      defaultSortOrder: 'descend' as const,
    },
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 130 },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: string) => (
        <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] ?? v}</Tag>
      ),
    },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'KH', dataIndex: 'ma_kh', width: 80 },
    {
      title: 'SL phôi',
      dataIndex: 'so_luong_phoi',
      width: 90,
      align: 'right' as const,
      render: (v: number | null) => v != null ? v.toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Ngày in',
      dataIndex: 'ngay_in',
      width: 90,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YY') : '—',
    },
    {
      title: 'SL in OK',
      dataIndex: 'so_luong_in_ok',
      width: 90,
      align: 'right' as const,
      render: (v: number | null) =>
        v != null ? <span style={{ color: '#52c41a' }}>{v.toLocaleString('vi-VN')}</span> : '—',
    },
    {
      title: 'SL lỗi',
      dataIndex: 'so_luong_loi',
      width: 80,
      align: 'right' as const,
      render: (v: number | null) =>
        v != null && v > 0 ? <span style={{ color: '#ff4d4f' }}>{v.toLocaleString('vi-VN')}</span> : (v != null ? '0' : '—'),
    },
    {
      title: 'Ca',
      dataIndex: 'ca',
      width: 60,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Ngày sau in',
      dataIndex: 'ngay_sau_in',
      width: 95,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YY') : '—',
    },
    {
      title: 'SL sau in',
      dataIndex: 'so_luong_sau_in_ok',
      width: 90,
      align: 'right' as const,
      render: (v: number | null) =>
        v != null ? <span style={{ color: '#1677ff' }}>{v.toLocaleString('vi-VN')}</span> : '—',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: (v: string | null) => v ?? '',
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <HistoryOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Lịch sử Phiếu In</Title>
          </Space>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            style={{ width: 220 }}
            placeholder="Tìm số phiếu, tên hàng, KH..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            onSearch={v => setSearch(v)}
          />
          <Select
            style={{ width: 160 }}
            placeholder="Tất cả trạng thái"
            allowClear
            value={trangThai}
            onChange={v => setTrangThai(v ?? null)}
            options={TRANG_THAI_OPTIONS}
          />
          <RangePicker
            value={dateRange}
            onChange={v => setDateRange(v as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
            allowClear
          />
        </Space>
      </Card>

      {/* Thống kê */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8} sm={6}>
          <Card size="small">
            <Statistic
              title="Tổng phiếu"
              value={filtered.length}
            />
          </Card>
        </Col>
        <Col xs={8} sm={6}>
          <Card size="small">
            <Statistic
              title="Tổng SL phôi"
              value={totalPhoi}
              formatter={v => Number(v).toLocaleString('vi-VN')}
            />
          </Card>
        </Col>
        <Col xs={8} sm={6}>
          <Card size="small">
            <Statistic
              title="Tổng SL in OK"
              value={totalOk}
              valueStyle={{ color: '#52c41a' }}
              formatter={v => Number(v).toLocaleString('vi-VN')}
            />
          </Card>
        </Col>
        <Col xs={8} sm={6}>
          <Card size="small">
            <Statistic
              title="Tổng SL sau in"
              value={totalSauInOk}
              valueStyle={{ color: '#1677ff' }}
              formatter={v => Number(v).toLocaleString('vi-VN')}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="small"
          loading={isLoading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: total => `${total} phiếu` }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  )
}
