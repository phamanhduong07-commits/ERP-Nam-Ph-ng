import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Col, Input, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import { GoldOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { warehouseApi } from '../../api/warehouse'
import type { TonKho, PhanXuong, PhanXuongWithWarehouses } from '../../api/warehouse'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtCurrency = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + ' đ' : '—'

export default function KhoThanhPhamPage() {
  const [activeXuong, setActiveXuong] = useState<string>('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterTonKho, setFilterTonKho] = useState<'co_ton' | null>(null)

  // Danh sách xưởng + warehouse_id của kho THANH_PHAM từng xưởng
  const { data: theoPhanXuong = [] } = useQuery<PhanXuongWithWarehouses[]>({
    queryKey: ['theo-phan-xuong'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  // Map phan_xuong_id → THANH_PHAM warehouse_id
  const thanhPhamWhMap = useMemo(() => {
    const map: Record<number, number | null> = {}
    theoPhanXuong.forEach(x => {
      const slot = x.warehouses.THANH_PHAM
      map[x.id] = slot && !('not_applicable' in slot) ? slot.id : null
    })
    return map
  }, [theoPhanXuong])

  // Active workshop's THANH_PHAM warehouse_id (null = "Tất cả")
  const activeWhId = useMemo(() => {
    if (activeXuong === 'all') return undefined
    return thanhPhamWhMap[Number(activeXuong)] ?? undefined
  }, [activeXuong, thanhPhamWhMap])

  // Fetch tồn kho thành phẩm — theo warehouse_id nếu chọn xưởng, hoặc loai="tp" cho tất cả
  const { data, isLoading, refetch } = useQuery<TonKho[]>({
    queryKey: ['ton-kho-tp', activeXuong, activeWhId],
    queryFn: () =>
      activeXuong === 'all'
        ? warehouseApi.getTonKho({ loai: 'tp' }).then(r => r.data)
        : activeWhId
          ? warehouseApi.getTonKho({ warehouse_id: activeWhId }).then(r => r.data)
          : Promise.resolve([]),
    staleTime: 30_000,
  })

  // Sub-tab items: Tất cả + từng xưởng (chỉ xưởng có kho THANH_PHAM)
  const xuongTabItems = useMemo(() => {
    const allCount = (data ?? []).length
    const allTab = { key: 'all', label: `Tất cả (${allCount})` }
    const xuongTabs = phanXuongList
      .filter(x => thanhPhamWhMap[x.id] !== undefined) // chỉ xưởng có kho TP
      .map(x => ({ key: String(x.id), label: x.ten_xuong }))
    return [allTab, ...xuongTabs]
  }, [phanXuongList, thanhPhamWhMap, data])

  const filteredData = useMemo(() => {
    const q = filterSearch.toLowerCase()
    return (data ?? []).filter(r => {
      if (q && !r.ten_hang.toLowerCase().includes(q) && !r.ten_kho.toLowerCase().includes(q)) return false
      if (filterTonKho === 'co_ton' && r.ton_luong <= 0) return false
      return true
    })
  }, [data, filterSearch, filterTonKho])

  // Tổng kết
  const totalTonLuong = filteredData.reduce((s, r) => s + r.ton_luong, 0)
  const totalGiaTri = filteredData.reduce((s, r) => s + (r.gia_tri_ton ?? 0), 0)

  const showKhoCol = activeXuong === 'all'

  const columns: ColumnsType<TonKho> = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
    },
    ...(showKhoCol ? [{
      title: 'Kho / Xưởng',
      dataIndex: 'ten_kho',
      width: 180,
      render: (v: string, r: TonKho) => {
        const xuong = phanXuongList.find(x => x.id === r.phan_xuong_id)
        return (
          <Space direction="vertical" size={2}>
            <Text style={{ fontSize: 12 }}>{v}</Text>
            {xuong && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{xuong.ten_xuong}</Tag>}
          </Space>
        )
      },
    }] : []),
    {
      title: 'Tồn kho',
      dataIndex: 'ton_luong',
      width: 110,
      align: 'right' as const,
      sorter: (a: TonKho, b: TonKho) => a.ton_luong - b.ton_luong,
      render: (v: number, r: TonKho) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: v > 0 ? '#389e0d' : '#cf1322', fontSize: 13 }}>
            {fmtN(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.don_vi}</Text>
        </Space>
      ),
    },
    {
      title: 'Tồn tối thiểu',
      dataIndex: 'ton_toi_thieu',
      width: 110,
      align: 'right' as const,
      render: (v: number, r: TonKho) => {
        if (!v || v <= 0) return <Text type="secondary">—</Text>
        const low = r.ton_luong < v
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ color: low ? '#cf1322' : '#8c8c8c', fontSize: 12 }}>
              {fmtN(v)}
            </Text>
            {low && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>Dưới mức</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Đơn giá BQ',
      dataIndex: 'don_gia_binh_quan',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ fontSize: 12 }}>{fmtCurrency(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Giá trị tồn',
      dataIndex: 'gia_tri_ton',
      width: 130,
      align: 'right' as const,
      sorter: (a: TonKho, b: TonKho) => (a.gia_tri_ton ?? 0) - (b.gia_tri_ton ?? 0),
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#1677ff' : '#aaa', fontSize: 12 }}>
          {v > 0 ? fmtCurrency(v) : '—'}
        </Text>
      ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'cap_nhat_luc',
      width: 110,
      render: (v: string | null) => v
        ? <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('DD/MM HH:mm')}</Text>
        : <Text type="secondary">—</Text>,
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
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Statistic
              title="Số mặt hàng"
              value={filteredData.length}
              valueStyle={{ fontSize: 18 }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Tổng tồn kho"
              value={totalTonLuong}
              formatter={v => fmtN(Number(v))}
              valueStyle={{ fontSize: 18, color: '#389e0d' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title="Tổng giá trị tồn"
              value={totalGiaTri}
              formatter={v => fmtCurrency(Number(v))}
              valueStyle={{ fontSize: 18, color: '#1677ff' }}
            />
          </Col>
        </Row>

        {/* Filter bar */}
        <Row gutter={[8, 8]} align="middle">
          <Col xs={24} sm={10}>
            <Input.Search
              size="small"
              placeholder="Tìm tên hàng / tên kho..."
              allowClear
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
          </Col>
          <Col xs={12} sm={5}>
            <Select
              size="small"
              style={{ width: '100%' }}
              placeholder="Tồn kho"
              allowClear
              value={filterTonKho}
              onChange={v => setFilterTonKho(v ?? null)}
              options={[{ value: 'co_ton', label: 'Còn tồn' }]}
            />
          </Col>
          <Col xs={12} sm={4}>
            <Button size="small" style={{ width: '100%' }} onClick={() => {
              setFilterSearch(''); setFilterTonKho(null)
            }}>Xoá lọc</Button>
          </Col>
        </Row>

        <Table<TonKho>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={filteredData}
          columns={columns}
          pagination={{
            pageSize: 50,
            showSizeChanger: false,
            showTotal: t => `${t} mặt hàng`,
          }}
          scroll={{ x: 900 }}
          rowClassName={(r) => r.ton_luong <= 0 ? 'ant-table-row-disabled' : ''}
          summary={filteredData.length > 0 ? () => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={showKhoCol ? 2 : 1}>
                <Text strong style={{ fontSize: 12 }}>Tổng cộng</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={showKhoCol ? 2 : 1} align="right">
                <Text strong style={{ color: '#389e0d', fontSize: 12 }}>{fmtN(totalTonLuong)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={showKhoCol ? 3 : 2} />
              <Table.Summary.Cell index={showKhoCol ? 4 : 3} />
              <Table.Summary.Cell index={showKhoCol ? 5 : 4} align="right">
                <Text strong style={{ color: '#1677ff', fontSize: 12 }}>{fmtCurrency(totalGiaTri)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={showKhoCol ? 6 : 5} />
            </Table.Summary.Row>
          ) : undefined}
        />
      </Space>
    </div>
  )
}
