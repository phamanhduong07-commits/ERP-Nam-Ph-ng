import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Col, DatePicker, Input, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import { GoldOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import client from '../../api/client'
import { warehouseApi } from '../../api/warehouse'
import type { TonKhoTPRow, PhanXuong } from '../../api/warehouse'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'

export default function KhoThanhPhamPage() {
  const [activeXuong, setActiveXuong] = useState<string>('all')
  const [filterPhapNhan, setFilterPhapNhan] = useState<string | null>(null)
  const [filterTonKho, setFilterTonKho] = useState<'co_ton' | null>(null)

  // Server-side filters
  const [filterKhach, setFilterKhach] = useState('')
  const [filterSoLenh, setFilterSoLenh] = useState('')
  const [filterNvId, setFilterNvId] = useState<number | undefined>()
  const [filterDates, setFilterDates] = useState<[string | undefined, string | undefined]>([undefined, undefined])

  const filterParams = {
    ten_khach: filterKhach || undefined,
    so_lenh: filterSoLenh || undefined,
    nv_theo_doi_id: filterNvId,
    tu_ngay: filterDates[0],
    den_ngay: filterDates[1],
  }

  const { data: rawData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ton-kho-tp-lsx', filterParams],
    queryFn: () => warehouseApi.getTonKhoTpLsx(filterParams).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const data: TonKhoTPRow[] = Array.isArray(rawData) ? rawData : []

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: nvList = [] } = useQuery<{ id: number; ho_ten: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => client.get<{ id: number; ho_ten: string }[]>('/users').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const xuongTabItems = useMemo(() => {
    const allTab = { key: 'all', label: `Tất cả (${data.length})` }
    const xuongTabs = phanXuongList.map(x => {
      const count = data.filter(r => r.phan_xuong_id === x.id).length
      return { key: String(x.id), label: `${x.ten_xuong} (${count})` }
    })
    return [allTab, ...xuongTabs]
  }, [phanXuongList, data])

  const phapNhanOptions = useMemo(() => {
    const seen = new Set<string>()
    return data
      .filter(r => r.ten_phap_nhan_sx)
      .filter(r => { const k = r.ten_phap_nhan_sx!; if (seen.has(k)) return false; seen.add(k); return true })
      .map(r => ({ value: r.ten_phap_nhan_sx!, label: r.ten_phap_nhan_sx! }))
  }, [data])

  const filteredData = useMemo(() => {
    const xuongId = activeXuong !== 'all' ? Number(activeXuong) : null
    return data.filter(r => {
      if (xuongId && r.phan_xuong_id !== xuongId) return false
      if (filterPhapNhan && r.ten_phap_nhan_sx !== filterPhapNhan) return false
      if (filterTonKho === 'co_ton' && r.ton_kho <= 0) return false
      return true
    })
  }, [data, filterPhapNhan, activeXuong, filterTonKho])

  const clearAllFilters = () => {
    setFilterKhach('')
    setFilterSoLenh('')
    setFilterNvId(undefined)
    setFilterDates([undefined, undefined])
    setFilterPhapNhan(null)
    setFilterTonKho(null)
  }

  const totalNhap = filteredData.reduce((s, r) => s + r.tong_nhap, 0)
  const totalXuat = filteredData.reduce((s, r) => s + r.tong_xuat, 0)
  const totalTon = filteredData.reduce((s, r) => s + r.ton_kho, 0)

  const showXuongCol = activeXuong === 'all'

  const columns: ColumnsType<TonKhoTPRow> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 130,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string | null) => v
        ? <Text strong style={{ fontSize: 13 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan_sx',
      width: 160,
      ellipsis: true,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontSize: 11, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    ...(showXuongCol ? [{
      title: 'Xưởng SX',
      dataIndex: 'ten_phan_xuong',
      width: 140,
      ellipsis: true,
      render: (v: string | null) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    }] : []),
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 120,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'NV theo dõi',
      dataIndex: 'ten_nv_theo_doi',
      width: 120,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Thùng (KH)',
      dataIndex: 'sl_ke_hoach',
      width: 90,
      align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ fontSize: 12 }}>{fmtN(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nhập (thùng)',
      dataIndex: 'tong_nhap',
      width: 100,
      align: 'right' as const,
      render: (v: number) => fmtN(v),
    },
    {
      title: 'Xuất (thùng)',
      dataIndex: 'tong_xuat',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v > 0 ? fmtN(v) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tồn thùng',
      dataIndex: 'ton_kho',
      width: 90,
      align: 'right' as const,
      sorter: (a: TonKhoTPRow, b: TonKhoTPRow) => a.ton_kho - b.ton_kho,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#389e0d' : '#cf1322', fontSize: 13 }}>
          {fmtN(v)}
        </Text>
      ),
    },
    {
      title: 'Phiếu xuất',
      dataIndex: 'phieu_xuat_gan_nhat',
      width: 150,
      render: (v: TonKhoTPRow['phieu_xuat_gan_nhat']) => v
        ? (
          <Space direction="vertical" size={0}>
            <Text code style={{ fontSize: 11 }}>{v.so_phieu}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {v.ngay_xuat ? dayjs(v.ngay_xuat).format('DD/MM/YYYY') : ''}
            </Text>
          </Space>
        )
        : <Text type="secondary" style={{ fontSize: 11 }}>Chưa xuất</Text>,
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <GoldOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <Title level={4} style={{ margin: 0 }}>Kho Thành Phẩm</Title>
          </Space>
        </Col>
        <Col>
          <Button size="small" onClick={() => refetch()}>Làm mới</Button>
        </Col>
      </Row>

      {/* Sub-tab xưởng */}
      <Tabs
        size="small"
        activeKey={activeXuong}
        onChange={key => setActiveXuong(key)}
        items={xuongTabItems}
        style={{ marginBottom: 4 }}
      />

      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {/* Tổng kết */}
        {isError && (
          <Alert
            type="error"
            showIcon
            message="Không tải được dữ liệu kho thành phẩm"
            description={error instanceof Error ? error.message : 'Vui lòng bấm Làm mới hoặc đăng nhập lại.'}
          />
        )}

        <Row gutter={16}>
          <Col xs={8} sm={4}>
            <Statistic title="Số LSX" value={filteredData.length} valueStyle={{ fontSize: 18 }} />
          </Col>
          <Col xs={8} sm={5}>
            <Statistic
              title="Tổng nhập (thùng)"
              value={totalNhap}
              formatter={v => fmtN(Number(v))}
              valueStyle={{ fontSize: 18 }}
            />
          </Col>
          <Col xs={8} sm={5}>
            <Statistic
              title="Tổng xuất (thùng)"
              value={totalXuat}
              formatter={v => fmtN(Number(v))}
              valueStyle={{ fontSize: 18, color: '#fa8c16' }}
            />
          </Col>
          <Col xs={24} sm={5}>
            <Statistic
              title="Tổng tồn (thùng)"
              value={totalTon}
              formatter={v => fmtN(Number(v))}
              valueStyle={{ fontSize: 18, color: '#389e0d' }}
            />
          </Col>
        </Row>

        {/* Filter bar */}
        <Row gutter={[8, 8]} align="middle">
          <Col>
            <Input
              size="small"
              placeholder="Lệnh SX"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 150 }}
              value={filterSoLenh}
              onChange={e => setFilterSoLenh(e.target.value)}
            />
          </Col>
          <Col>
            <Input
              size="small"
              placeholder="Khách hàng"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 180 }}
              value={filterKhach}
              onChange={e => setFilterKhach(e.target.value)}
            />
          </Col>
          <Col>
            <Select
              size="small"
              style={{ width: 180 }}
              placeholder="Nhân viên theo dõi"
              allowClear
              showSearch
              optionFilterProp="label"
              value={filterNvId}
              onChange={v => setFilterNvId(v)}
              options={nvList.map(u => ({ value: u.id, label: u.ho_ten }))}
            />
          </Col>
          <Col>
            <DatePicker.RangePicker
              size="small"
              format="DD/MM/YYYY"
              placeholder={['Ngày lệnh từ', 'đến ngày']}
              style={{ width: 240 }}
              allowClear
              onChange={dates => setFilterDates([
                dates?.[0]?.format('YYYY-MM-DD'),
                dates?.[1]?.format('YYYY-MM-DD'),
              ])}
            />
          </Col>
          <Col>
            <Select size="small" style={{ width: 120 }} placeholder="Pháp nhân" allowClear
              value={filterPhapNhan}
              onChange={v => setFilterPhapNhan(v ?? null)}
              options={phapNhanOptions}
            />
          </Col>
          <Col>
            <Select size="small" style={{ width: 110 }} placeholder="Tồn kho" allowClear
              value={filterTonKho}
              onChange={v => setFilterTonKho(v ?? null)}
              options={[{ value: 'co_ton', label: 'Còn tồn' }]}
            />
          </Col>
          <Col>
            <Button size="small" onClick={clearAllFilters}>Xoá lọc</Button>
          </Col>
        </Row>

        <Table<TonKhoTPRow>
          rowKey="production_order_id"
          size="small"
          loading={isLoading}
          dataSource={filteredData}
          columns={columns}
          pagination={{
            pageSize: 50,
            showSizeChanger: false,
            showTotal: (t, r) =>
              `${t} lệnh SX${r[0] !== 1 || r[1] !== (data ?? []).length ? ` (lọc từ ${(data ?? []).length})` : ''}`,
          }}
          scroll={{ x: 1000 }}
          rowClassName={(r) => r.ton_kho <= 0 ? 'ant-table-row-disabled' : ''}
          summary={() => {
            if (filteredData.length === 0) return null
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={showXuongCol ? 6 : 5}>
                  <Text strong style={{ fontSize: 12 }}>Tổng cộng</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={showXuongCol ? 6 : 5} />
                <Table.Summary.Cell index={showXuongCol ? 7 : 6} align="right">
                  <Text strong style={{ fontSize: 12 }}>{fmtN(totalNhap)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={showXuongCol ? 8 : 7} align="right">
                  <Text strong style={{ color: '#fa8c16', fontSize: 12 }}>{fmtN(totalXuat)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={showXuongCol ? 9 : 8} align="right">
                  <Text strong style={{ color: '#389e0d', fontSize: 12 }}>{fmtN(totalTon)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={showXuongCol ? 10 : 9} />
              </Table.Summary.Row>
            )
          }}
        />
      </Space>
    </div>
  )
}
