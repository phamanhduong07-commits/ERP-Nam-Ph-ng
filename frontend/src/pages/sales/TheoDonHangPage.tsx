import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Row, Select, Space, Table, Tag, Typography,
} from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import client from '../../api/client'
import { theoDoiApi, STAGE_COLORS } from '../../api/theoDoi'
import type { DonHangTheoDoiRow, PhanXuongItem } from '../../api/theoDoi'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtDate = (v: string | null | undefined) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—'

export default function TheoDonHangPage() {
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [nvTheodoiId, setNvTheodoiId] = useState<number | undefined>()
  const [includeHoanThanh, setIncludeHoanThanh] = useState(false)
  const [search, setSearch] = useState('')
  const [filterKhach, setFilterKhach] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([undefined, undefined])

  const { data: phanXuongs = [] } = useQuery<PhanXuongItem[]>({
    queryKey: ['theo-doi-phan-xuong'],
    queryFn: () => theoDoiApi.listPhanXuong().then(r => r.data),
  })

  const { data: users = [] } = useQuery<{ id: number; ho_ten: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => client.get<{ id: number; ho_ten: string }[]>('/users').then(r => r.data),
  })

  const { data: rows = [], isLoading, refetch } = useQuery<DonHangTheoDoiRow[]>({
    queryKey: ['theo-doi-don-hang', phanXuongId, nvTheodoiId, includeHoanThanh, dateRange],
    queryFn: () =>
      theoDoiApi.getDonHang({
        phan_xuong_id: phanXuongId,
        nv_theo_doi_id: nvTheodoiId,
        include_hoan_thanh: includeHoanThanh,
        tu_ngay: dateRange[0],
        den_ngay: dateRange[1],
      }).then(r => r.data),
  })

  const khachOptions = useMemo(() => {
    const seen = new Set<string>()
    return rows
      .map(r => r.ten_khach_hang)
      .filter((v): v is string => !!v && !seen.has(v) && !!seen.add(v))
      .sort()
      .map(v => ({ label: v, value: v }))
  }, [rows])

  const filtered = useMemo(() => {
    let data = rows
    if (filterKhach) data = data.filter(r => r.ten_khach_hang === filterKhach)
    if (!search.trim()) return data
    const s = search.toLowerCase()
    return data.filter(r =>
      (r.so_lenh ?? '').toLowerCase().includes(s) ||
      (r.ten_khach_hang ?? '').toLowerCase().includes(s) ||
      (r.so_don ?? '').toLowerCase().includes(s) ||
      (r.ten_hang ?? '').toLowerCase().includes(s)
    )
  }, [rows, search, filterKhach])

  const today = dayjs().format('YYYY-MM-DD')

  const columns: ColumnsType<DonHangTheoDoiRow> = [
    {
      title: 'LSX', dataIndex: 'so_lenh', width: 130, fixed: 'left',
      render: (v, r) => (
        <div>
          <Text strong>{v}</Text>
          {r.so_don && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.so_don}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 140, ellipsis: true,
      render: v => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Hàng', dataIndex: 'ten_hang', width: 180, ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 100,
      render: v => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'NV theo dõi', dataIndex: 'ten_nv_theo_doi', width: 120,
      render: v => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Số thùng', dataIndex: 'so_luong_ke_hoach', width: 90, align: 'right' as const,
      render: v => <Text strong style={{ color: '#1677ff' }}>{fmtN(v)}</Text>,
    },
    {
      title: 'Nhập phôi (tấm)', width: 120,
      render: (_, r) =>
        r.tong_nhap_phoi > 0 ? (
          <div>
            <Text strong style={{ color: '#389e0d' }}>{fmtN(r.tong_nhap_phoi)} tấm</Text>
            {r.ngay_nhap_cuoi && <div><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.ngay_nhap_cuoi)}</Text></div>}
          </div>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tồn kho phôi', dataIndex: 'ton_kho_phoi', width: 110,
      render: v =>
        v > 0 ? <Tag color="lime">{fmtN(v)}</Tag>
        : v < 0 ? <Tag color="red">{fmtN(v)}</Tag>
        : <Text type="secondary">0</Text>,
    },
    {
      title: 'Chuyển phôi', dataIndex: 'tong_chuyen_phoi', width: 100,
      render: v =>
        v > 0 ? <Tag color="purple">{fmtN(v)}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Giai đoạn', width: 160,
      render: (_, r) => (
        <div>
          <Tag color={STAGE_COLORS[r.stage] ?? 'default'}>{r.stage_label}</Tag>
          {r.ten_may_in && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.ten_may_in}</Text></div>}
          {r.so_phieu_in && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.so_phieu_in}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Giao hàng', dataIndex: 'ngay_giao_hang', width: 100,
      render: v => {
        if (!v) return <Text type="secondary">—</Text>
        const late = v < today
        return <Text style={{ color: late ? '#ff4d4f' : undefined, fontWeight: late ? 600 : undefined }}>{fmtDate(v)}</Text>
      },
      sorter: (a, b) => (a.ngay_giao_hang ?? '9999') < (b.ngay_giao_hang ?? '9999') ? -1 : 1,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Theo dõi đơn hàng</Title>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={[8, 8]} align="middle">
            <Col>
              <Select
                placeholder="Tất cả xưởng"
                allowClear
                style={{ width: 160 }}
                options={phanXuongs.map(p => ({ label: p.ten_xuong, value: p.id }))}
                onChange={v => setPhanXuongId(v)}
              />
            </Col>
            <Col>
              <Select
                placeholder="Tất cả khách hàng"
                allowClear
                style={{ width: 180 }}
                showSearch
                optionFilterProp="label"
                options={khachOptions}
                value={filterKhach}
                onChange={v => setFilterKhach(v)}
              />
            </Col>
            <Col>
              <Select
                placeholder="Tất cả nhân viên"
                allowClear
                style={{ width: 180 }}
                showSearch
                optionFilterProp="label"
                options={users.map(u => ({ label: u.ho_ten, value: u.id }))}
                onChange={v => setNvTheodoiId(v)}
              />
            </Col>
            <Col>
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                placeholder={['Từ ngày', 'Đến ngày']}
                style={{ width: 240 }}
                allowClear
                onChange={dates => setDateRange([
                  dates?.[0]?.format('YYYY-MM-DD'),
                  dates?.[1]?.format('YYYY-MM-DD'),
                ])}
              />
            </Col>
            <Col>
              <Input
                placeholder="Tìm LSX / khách / hàng..."
                prefix={<SearchOutlined />}
                style={{ width: 220 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col>
              <Button
                type={includeHoanThanh ? 'primary' : 'default'}
                size="small"
                onClick={() => setIncludeHoanThanh(v => !v)}
              >
                {includeHoanThanh ? 'Ẩn hoàn thành' : 'Hiện hoàn thành'}
              </Button>
            </Col>
            <Col>
              <Button size="small" onClick={() => refetch()}>Làm mới</Button>
            </Col>
            <Col flex="auto" />
            <Col>
              <Text type="secondary" style={{ fontSize: 12 }}>{filtered.length} lệnh SX</Text>
            </Col>
          </Row>

          <Table<DonHangTheoDoiRow>
            rowKey={r => r.production_order_id != null ? r.production_order_id : `so-${r.sales_order_id}`}
            size="small"
            loading={isLoading}
            dataSource={filtered}
            columns={columns}
            pagination={{ pageSize: 50, showSizeChanger: false }}
            scroll={{ x: 1340 }}
            rowClassName={r => r.ngay_giao_hang && r.ngay_giao_hang < today && r.stage !== 'hoan_thanh' ? 'ant-table-row-danger' : ''}
          />
        </Space>
      </Card>
    </div>
  )
}
