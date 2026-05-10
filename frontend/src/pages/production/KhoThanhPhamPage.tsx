import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Col, DatePicker, Empty, Input, Row, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import { EyeOutlined, GoldOutlined, InfoCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { warehouseApi } from '../../api/warehouse'
import type { TonKhoTPRow, PhanXuong } from '../../api/warehouse'
import {
  salesReturnsApi,
  SALES_RETURN_TRANG_THAI_COLORS,
  SALES_RETURN_TRANG_THAI_LABELS,
  type SalesReturnListItem,
} from '../../api/salesReturns'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'

export default function KhoThanhPhamPage() {
  const navigate = useNavigate()
  const [activeMainTab, setActiveMainTab] = useState<'stock' | 'returns'>('stock')
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

  const { data: returnsData, isLoading: isReturnsLoading, refetch: refetchReturns } = useQuery({
    queryKey: ['sales-returns', 'finished-goods-tab'],
    queryFn: () => salesReturnsApi.list({ page: 1, page_size: 100 }).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const returnRows = returnsData?.items || (returnsData as { data?: SalesReturnListItem[] } | undefined)?.data || []

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
      const shortName = x.ten_xuong.replace(/^Xưởng\s+/i, '')
      return { key: String(x.id), label: `Kho TP ${shortName} (${count})` }
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

  // Lọc phiếu trả theo xưởng đang chọn (dựa vào sales_order_id khớp với filteredData)
  const filteredReturnRows = useMemo(() => {
    if (activeXuong === 'all' && !filterPhapNhan) return returnRows
    const soIds = new Set(filteredData.map(r => r.sales_order_id).filter(Boolean))
    return returnRows.filter(r => soIds.has(r.sales_order_id))
  }, [returnRows, filteredData, activeXuong, filterPhapNhan])

  const totalNhap = filteredData.reduce((s, r) => s + r.tong_nhap, 0)
  const totalXuat = filteredData.reduce((s, r) => s + r.tong_xuat, 0)
  const totalTra = filteredData.reduce((s, r) => s + (r.tong_tra || 0), 0)
  const totalTon = filteredData.reduce((s, r) => s + r.ton_kho, 0)

  const returnColumns: ColumnsType<SalesReturnListItem> = [
    {
      title: 'Số phiếu trả',
      dataIndex: 'so_phieu_tra',
      width: 140,
      render: (v: string, r) => (
        <Button type="link" size="small" onClick={() => navigate(`/sales/returns/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày trả',
      dataIndex: 'ngay_tra',
      width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'so_don_ban',
      width: 120,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Lý do trả',
      dataIndex: 'ly_do_tra',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v: string) => (
        <Tag color={SALES_RETURN_TRANG_THAI_COLORS[v] || 'default'}>
          {SALES_RETURN_TRANG_THAI_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'tong_tien_tra',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `${fmtN(v)}đ`,
    },
    {
      title: 'SL trả',
      dataIndex: 'tong_so_luong_tra',
      width: 90,
      align: 'right' as const,
      render: (v: number) => <Text strong>{fmtN(v)}</Text>,
    },
    {
      title: '',
      width: 90,
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/sales/returns/${r.id}`)}>
          Xem
        </Button>
      ),
    },
  ]

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
      width: 130,
      ellipsis: true,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontSize: 11, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nơi sản xuất',
      dataIndex: 'order_ten_phan_xuong',
      width: 130,
      ellipsis: true,
      render: (v: string | null) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Kho hiện tại',
      dataIndex: 'ten_kho_hien_tai',
      width: 160,
      ellipsis: true,
      render: (v: string | null) => v
        ? <Tooltip title={v}><Text style={{ fontSize: 12 }}>{v}</Text></Tooltip>
        : <Text type="secondary">—</Text>,
    },
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
      title: (
        <Tooltip title="Trả về (chờ duyệt / đã duyệt). Tồn kho chỉ cộng phần đã duyệt.">
          <Space size={4}>Trả về<InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 11 }} /></Space>
        </Tooltip>
      ),
      dataIndex: 'tong_tra',
      width: 100,
      align: 'right' as const,
      render: (v: number | undefined, r: TonKhoTPRow) => {
        if (!v || v <= 0) return <Text type="secondary">—</Text>
        const daduyet = r.tong_tra_da_duyet ?? 0
        const choduyet = v - daduyet
        return (
          <Tooltip title={`Đã duyệt: ${fmtN(daduyet)}${choduyet > 0 ? ` | Chờ duyệt: ${fmtN(choduyet)}` : ''}`}>
            <Tag color={choduyet > 0 ? 'orange' : 'green'} style={{ marginInlineEnd: 0 }}>
              {fmtN(v)}
            </Tag>
          </Tooltip>
        )
      },
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
          <Space>
            <Button size="small" icon={<PlusOutlined />} onClick={() => navigate('/sales/returns/create')}>
              Tạo phiếu trả
            </Button>
            <Button size="small" onClick={() => { refetch(); refetchReturns() }}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      {/* Sub-tab xưởng */}
      <Tabs
        size="small"
        activeKey={activeMainTab}
        onChange={key => setActiveMainTab(key as 'stock' | 'returns')}
        items={[
          { key: 'stock', label: 'Tồn kho thành phẩm' },
          { key: 'returns', label: `Hàng trả về (${filteredReturnRows.length})` },
        ]}
        style={{ marginBottom: 8 }}
      />

      {activeMainTab === 'returns' ? (
        <Table<SalesReturnListItem>
          rowKey="id"
          size="small"
          loading={isReturnsLoading}
          dataSource={filteredReturnRows}
          columns={returnColumns}
          locale={{
            emptyText: (
              <Empty
                description="Chưa có phiếu hàng trả về"
              >
                <Space>
                  <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => navigate('/sales/returns/create')}>
                    Tạo phiếu trả
                  </Button>
                  <Button size="small" onClick={() => refetchReturns()}>Làm mới</Button>
                </Space>
              </Empty>
            ),
          }}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          scroll={{ x: 900 }}
        />
      ) : (
        <>
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
          <Col xs={8} sm={5}>
            <Statistic
              title="Hàng trả về"
              value={totalTra}
              formatter={v => fmtN(Number(v))}
              valueStyle={{ fontSize: 18, color: '#389e0d' }}
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
            // Columns: 0=Lệnh SX, 1=Tên hàng, 2=Pháp nhân, 3=Nơi SX, 4=Kho hiện tại,
            //          5=Khách, 6=NV, 7=Thùng KH, 8=Nhập, 9=Xuất, 10=Trả, 11=Tồn, 12=Phiếu xuất
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={8}>
                  <Text strong style={{ fontSize: 12 }}>Tổng cộng</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  <Text strong style={{ fontSize: 12 }}>{fmtN(totalNhap)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9} align="right">
                  <Text strong style={{ color: '#fa8c16', fontSize: 12 }}>{fmtN(totalXuat)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={10} align="right">
                  <Text strong style={{ color: '#389e0d', fontSize: 12 }}>{fmtN(totalTra)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={11} align="right">
                  <Text strong style={{ color: '#389e0d', fontSize: 12 }}>{fmtN(totalTon)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={12} />
              </Table.Summary.Row>
            )
          }}
        />
      </Space>
        </>
      )}
    </div>
  )
}
