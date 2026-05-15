import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, Space, Tag, Card, Typography,
  DatePicker, Row, Col, Tooltip, Popconfirm, message, Pagination,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  PlayCircleOutlined, CheckCircleOutlined, CloseOutlined,
  FileExcelOutlined, FilePdfOutlined, ShoppingCartOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionOrdersApi,
  TRANG_THAI_LABELS,
  TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type { ProductionOrderListItem } from '../../api/productionOrders'
import { exportToExcel, printToPdf, fmtDate, fmtNum, buildHtmlTable, smartExportExcel, smartPrintPdf, resolveSinglePhapNhanId } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const FILTER_KEY = 'prod_order_filters'

function loadFilters() {
  try {
    const saved = sessionStorage.getItem(FILTER_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch { return {} }
}

interface Props {
  selectedId?: number | null
  onSelect?: (id: number) => void
}

// ── Gom nhóm lệnh SX theo đơn hàng ──────────────────────────────────────────

interface DonHangGroup {
  key: string
  sales_order_id: number | null
  so_don: string | null
  ten_khach_hang: string | null
  so_lenh_count: number
  tong_sl: number
  trang_thai_list: string[]
  orders: ProductionOrderListItem[]
}

function groupOrders(orders: ProductionOrderListItem[]): DonHangGroup[] {
  const map = new Map<string, DonHangGroup>()
  orders.forEach(o => {
    const key = o.sales_order_id != null
      ? `don-${o.sales_order_id}`
      : `standalone-${o.id}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        sales_order_id: o.sales_order_id,
        so_don: o.so_don,
        ten_khach_hang: o.ten_khach_hang,
        so_lenh_count: 0,
        tong_sl: 0,
        trang_thai_list: [],
        orders: [],
      })
    }
    const g = map.get(key)!
    g.so_lenh_count += 1
    g.tong_sl += Number(o.tong_sl_ke_hoach)
    if (!g.trang_thai_list.includes(o.trang_thai)) g.trang_thai_list.push(o.trang_thai)
    g.orders.push(o)
  })
  return Array.from(map.values())
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProductionOrderList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const saved = loadFilters()

  const [inputSearch, setInputSearch] = useState<string>(saved.search ?? '')
  const [search, setSearch] = useState<string>(saved.search ?? '')
  const [trangThai, setTrangThai] = useState<string | undefined>(saved.trangThai)
  const [shortcutFilter, setShortcutFilter] = useState<string | null>(saved.shortcutFilter ?? null)
  const [dateRange, setDateRange] = useState<[string, string] | null>(saved.dateRange ?? null)
  const [page, setPage] = useState<number>(saved.page ?? 1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isEmbedded = !!onSelect

  // Debounce search 400ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!inputSearch) { setSearch(''); setPage(1); return }
    debounceRef.current = setTimeout(() => { setSearch(inputSearch); setPage(1) }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [inputSearch])

  // Persist filters to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({ search, trangThai, shortcutFilter, dateRange, page }))
    } catch {}
  }, [search, trangThai, shortcutFilter, dateRange, page])

  // Effective trangThai for API: shortcut overrides Select (except 'qua_han')
  const effectiveTrangThai = shortcutFilter === 'moi' || shortcutFilter === 'dang_chay'
    ? shortcutFilter
    : trangThai

  const handleExportExcel = () => {
    const items = data?.items ?? []
    const resolvedPhapNhanId = resolveSinglePhapNhanId(items)
    if (!items.length) {
      message.warning('Không có dữ liệu để xuất Excel')
      return
    }
    if (!resolvedPhapNhanId) {
      message.error('Chỉ xuất Excel lệnh sản xuất khi danh sách thuộc một pháp nhân. Vui lòng lọc hoặc tìm theo một pháp nhân.')
      return
    }
    const defaultConfig = [
      { key: 'stt', label: 'STT', width: 5 },
      { key: 'so_lenh', label: 'Số lệnh', width: 18 },
      { key: 'ngay_lenh', label: 'Ngày lệnh', width: 12 },
      { key: 'so_don', label: 'Đơn hàng', width: 16 },
      { key: 'ten_khach_hang', label: 'Khách hàng', width: 20 },
      { key: 'ten_hang', label: 'Mã/Tên hàng', width: 28 },
      { key: 'ngay_hoan_thanh_ke_hoach', label: 'Hoàn thành DK', width: 18 },
      { key: 'so_dong', label: 'Số dòng', width: 8 },
      { key: 'tong_sl_ke_hoach', label: 'SL kế hoạch', width: 14 },
      { key: 'trang_thai_lbl', label: 'Trạng thái', width: 14 },
    ]

    const exportData = items.map((r, i) => ({
      ...r,
      stt: i + 1,
      ngay_lenh: fmtDate(r.ngay_lenh),
      ngay_hoan_thanh_ke_hoach: fmtDate(r.ngay_hoan_thanh_ke_hoach),
      tong_sl_ke_hoach: Number(r.tong_sl_ke_hoach),
      trang_thai_lbl: TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
    }))

    smartExportExcel('PRODUCTION_ORDER', exportData, defaultConfig, `LenhSX_${dayjs().format('YYYYMMDD')}`, resolvedPhapNhanId)
  }

  const handleExportPdf = () => {
    const items = data?.items ?? []
    const resolvedPhapNhanId = resolveSinglePhapNhanId(items)
    if (!items.length) {
      message.warning('Không có dữ liệu để in')
      return
    }
    if (!resolvedPhapNhanId) {
      message.error('Chỉ in danh sách lệnh sản xuất khi danh sách thuộc một pháp nhân. Vui lòng lọc hoặc tìm theo một pháp nhân.')
      return
    }
    const cols = [
      { header: 'STT', key: 'stt', align: 'center' as const },
      { header: 'Số lệnh', key: 'so_lenh' },
      { header: 'Ngày lệnh', key: 'ngay_lenh' },
      { header: 'Đơn hàng', key: 'so_don' },
      { header: 'Khách hàng', key: 'ten_khach_hang' },
      { header: 'Mã/Tên hàng', key: 'ten_hang' },
      { header: 'Hoàn thành DK', key: 'ngay_hoan_thanh_ke_hoach' },
      { header: 'Số dòng', key: 'so_dong', align: 'center' as const },
      { header: 'SL kế hoạch', key: 'tong_sl_ke_hoach', align: 'right' as const },
      { header: 'Trạng thái', key: 'trang_thai_lbl' },
    ]

    const rows = items.map((r, i) => ({
      stt: i + 1,
      so_lenh: r.so_lenh,
      ngay_lenh: fmtDate(r.ngay_lenh),
      so_don: r.so_don ?? '',
      ten_khach_hang: r.ten_khach_hang ?? '',
      ten_hang: r.ten_hang ?? '',
      ngay_hoan_thanh_ke_hoach: fmtDate(r.ngay_hoan_thanh_ke_hoach),
      so_dong: r.so_dong,
      tong_sl_ke_hoach: fmtNum(r.tong_sl_ke_hoach),
      trang_thai_lbl: TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
    }))

    const table = buildHtmlTable(cols.map(c => ({ header: c.header, align: c.align })), rows.map(r => cols.map(c => (r as any)[c.key])))

    const printData = {
      subtitle: 'DANH SÁCH LỆNH SẢN XUẤT',
      document_date: dayjs().format('DD/MM/YYYY HH:mm'),
      document_number: `${items.length} lệnh`,
      body_html: table,
    }

    smartPrintPdf('PRODUCTION_ORDER', printData, resolvedPhapNhanId)
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['production-orders', search, effectiveTrangThai, dateRange, page],
    queryFn: () =>
      productionOrdersApi
        .list({
          search,
          trang_thai: effectiveTrangThai,
          tu_ngay: dateRange?.[0],
          den_ngay: dateRange?.[1],
          page,
          page_size: 20,
        })
        .then((r) => r.data),
  })

  // Quá hạn: filter on frontend (active orders past deadline)
  const today = dayjs().startOf('day')
  const displayItems = useMemo(() => {
    const items = data?.items ?? []
    if (shortcutFilter !== 'qua_han') return items
    return items.filter(o =>
      ['moi', 'dang_chay'].includes(o.trang_thai) &&
      o.ngay_hoan_thanh_ke_hoach != null &&
      dayjs(o.ngay_hoan_thanh_ke_hoach).isBefore(today)
    )
  }, [data?.items, shortcutFilter])

  // Gom nhóm theo đơn hàng (chỉ dùng cho chế độ full)
  const groups = useMemo(() => groupOrders(displayItems), [displayItems])

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

  const handleChuyenMuaPhoi = async (id: number, soLenh: string) => {
    try {
      await productionOrdersApi.chuyenMuaPhoi(id)
      message.success(`Lệnh ${soLenh} đã chuyển sang mua phôi ngoài. Bộ phận mua hàng sẽ lên đơn.`)
      refetch()
    } catch {
      message.error('Thất bại')
    }
  }

  // ── Cột compact (sidebar — child rows bên trong nhóm đơn hàng) ──────────
  const compactColumns: ColumnsType<ProductionOrderListItem> = [
    {
      dataIndex: 'so_lenh',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ color: '#1677ff', fontWeight: 500, fontSize: 12 }}>{v}</Text>
          {r.ten_hang && <Text style={{ fontSize: 11 }}>{r.ten_hang}</Text>}
        </Space>
      ),
    },
    {
      dataIndex: 'ngay_lenh',
      width: 66,
      render: (v) => <Text style={{ fontSize: 11 }}>{dayjs(v).format('DD/MM/YY')}</Text>,
    },
    {
      dataIndex: 'trang_thai',
      width: 82,
      render: (v) => <Tag color={TRANG_THAI_COLORS[v]} style={{ fontSize: 10 }}>{TRANG_THAI_LABELS[v] || v}</Tag>,
    },
  ]

  // ── Cột bảng con: lệnh SX bên trong đơn hàng ─────────────────────────────
  const orderColumns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Lệnh SX / Mã hàng',
      render: (_, r) => (
        <Space direction="vertical" size={1}>
          <Space size={4}>
            <Button type="link" style={{ padding: 0, height: 'auto', fontSize: 13 }}
              onClick={() => navigate(`/production/orders/${r.id}`)}>
              {r.so_lenh}
            </Button>
            {r.de_xuat_mua_ngoai && r.trang_thai !== 'mua_ngoai' && (
              <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>Khổ ≥2m</Tag>
            )}
          </Space>
          {r.ten_hang && (
            <Text style={{ fontSize: 12, fontWeight: 500 }}>{r.ten_hang}</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Ngày lập',
      dataIndex: 'created_at',
      width: 130,
      render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Ngày lệnh',
      dataIndex: 'ngay_lenh',
      width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Số dòng',
      dataIndex: 'so_dong',
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'SL kế hoạch',
      dataIndex: 'tong_sl_ke_hoach',
      width: 120,
      align: 'right' as const,
      render: (v) => new Intl.NumberFormat('vi-VN').format(v),
    },
    {
      title: 'Hoàn thành DK',
      dataIndex: 'ngay_hoan_thanh_ke_hoach',
      width: 140,
      render: (v, r) => {
        if (!v) return '—'
        const d = dayjs(v)
        const isActive = ['moi', 'dang_chay'].includes(r.trang_thai)
        const diffDays = d.diff(today, 'day')
        if (isActive && diffDays < 0) {
          return (
            <Space size={4}>
              <WarningOutlined style={{ color: '#cf1322' }} />
              <span style={{ color: '#cf1322', fontWeight: 600 }}>{d.format('DD/MM/YYYY')}</span>
            </Space>
          )
        }
        if (isActive && diffDays <= 3) {
          return <span style={{ color: '#d46b08', fontWeight: 500 }}>{d.format('DD/MM/YYYY')}</span>
        }
        return d.format('DD/MM/YYYY')
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v) => <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 120,
      render: (v) => v ?? '—',
    },
    {
      title: 'Người lập',
      dataIndex: 'created_by_name',
      width: 120,
      render: (v) => v ?? '—',
    },
    {
      title: 'Thao tác',
      width: 150,
      align: 'center' as const,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/production/orders/${r.id}`)} />
          </Tooltip>
          {r.trang_thai === 'moi' && (
            <Tooltip title="Bắt đầu SX">
              <Popconfirm title={`Bắt đầu sản xuất lệnh ${r.so_lenh}?`}
                onConfirm={() => handleStart(r.id, r.so_lenh)} okText="Bắt đầu">
                <Button size="small" type="primary" icon={<PlayCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['moi', 'dang_chay'].includes(r.trang_thai) && (
            <Tooltip title="Hoàn thành">
              <Popconfirm title={`Đánh dấu hoàn thành lệnh ${r.so_lenh}?`}
                onConfirm={() => handleComplete(r.id, r.so_lenh)} okText="Hoàn thành">
                <Button size="small" icon={<CheckCircleOutlined />}
                  style={{ color: 'green', borderColor: 'green' }} />
              </Popconfirm>
            </Tooltip>
          )}
          {['moi', 'dang_chay'].includes(r.trang_thai) && (
            <Tooltip title="Huỷ lệnh">
              <Popconfirm title={`Huỷ lệnh ${r.so_lenh}?`}
                onConfirm={() => handleCancel(r.id, r.so_lenh)}
                okText="Huỷ" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<CloseOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['moi', 'dang_chay'].includes(r.trang_thai) && (
            <Tooltip title="Mua phôi ngoài">
              <Popconfirm
                title={`Chuyển lệnh ${r.so_lenh} sang mua phôi ngoài?`}
                description="Bộ phận mua hàng sẽ vào lên đơn mua phôi."
                onConfirm={() => handleChuyenMuaPhoi(r.id, r.so_lenh)}
                okText="Chuyển"
              >
                <Button size="small" icon={<ShoppingCartOutlined />}
                  style={{ color: '#722ed1', borderColor: '#722ed1' }} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // ── Cột bảng cha: đơn hàng ────────────────────────────────────────────────
  const groupColumns: ColumnsType<DonHangGroup> = [
    {
      title: 'Đơn hàng',
      render: (_, g) => g.so_don ? (
        <Space direction="vertical" size={1}>
          <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{g.so_don}</Text>
          {g.ten_khach_hang && (
            <Text type="secondary" style={{ fontSize: 12 }}>{g.ten_khach_hang}</Text>
          )}
        </Space>
      ) : (
        <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>Lệnh SX độc lập</Text>
      ),
    },
    {
      title: 'Số lệnh SX',
      width: 100,
      align: 'center' as const,
      render: (_, g) => (
        <Tag color="blue" style={{ fontSize: 12 }}>{g.so_lenh_count} lệnh</Tag>
      ),
    },
    {
      title: 'Tổng SL kế hoạch',
      width: 150,
      align: 'right' as const,
      render: (_, g) => (
        <Text strong>{new Intl.NumberFormat('vi-VN').format(g.tong_sl)}</Text>
      ),
    },
    {
      title: 'Trạng thái',
      width: 200,
      render: (_, g) => (
        <Space size={4} wrap>
          {g.trang_thai_list.map(tt => (
            <Tag key={tt} color={TRANG_THAI_COLORS[tt]} style={{ fontSize: 11 }}>
              {TRANG_THAI_LABELS[tt] ?? tt}
            </Tag>
          ))}
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
            <Space size={4}>
              {!isEmbedded && (
                <>
                  <Tooltip title="Xuất Excel">
                    <Button size="small" icon={<FileExcelOutlined />}
                      style={{ color: '#217346', borderColor: '#217346' }}
                      onClick={handleExportExcel} />
                  </Tooltip>
                  <Tooltip title="Xuất PDF">
                    <Button size="small" icon={<FilePdfOutlined />}
                      style={{ color: '#e53935', borderColor: '#e53935' }}
                      onClick={handleExportPdf} />
                  </Tooltip>
                </>
              )}
              <Button type="primary" size="small" icon={<PlusOutlined />}
                onClick={() => navigate('/production/orders/new')}>
                Tạo lệnh SX
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số lệnh / khách hàng / tên hàng..."
              prefix={<SearchOutlined />}
              size="small"
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
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
              onChange={(v) => { setTrangThai(v); setShortcutFilter(null); setPage(1) }}
              options={Object.entries(TRANG_THAI_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Col>
        </Row>

        <Row style={{ marginTop: 8 }}>
          <Col span={24}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder={['Ngày lệnh từ', 'Đến ngày']}
              value={dateRange
                ? [dayjs(dateRange[0], 'YYYY-MM-DD'), dayjs(dateRange[1], 'YYYY-MM-DD')]
                : null}
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

        {/* ── Shortcut filter buttons ── */}
        <Row style={{ marginTop: 8 }} gutter={6}>
          <Col>
            <Button
              size="small"
              type={shortcutFilter === 'moi' ? 'primary' : 'default'}
              onClick={() => {
                setShortcutFilter(shortcutFilter === 'moi' ? null : 'moi')
                setTrangThai(undefined)
                setPage(1)
              }}
            >
              Mới
            </Button>
          </Col>
          <Col>
            <Button
              size="small"
              type={shortcutFilter === 'dang_chay' ? 'primary' : 'default'}
              onClick={() => {
                setShortcutFilter(shortcutFilter === 'dang_chay' ? null : 'dang_chay')
                setTrangThai(undefined)
                setPage(1)
              }}
            >
              Đang SX
            </Button>
          </Col>
          <Col>
            <Button
              size="small"
              danger={shortcutFilter === 'qua_han'}
              type={shortcutFilter === 'qua_han' ? 'primary' : 'default'}
              icon={shortcutFilter === 'qua_han' ? <WarningOutlined /> : undefined}
              onClick={() => {
                setShortcutFilter(shortcutFilter === 'qua_han' ? null : 'qua_han')
                setTrangThai(undefined)
                setPage(1)
              }}
            >
              Quá hạn
            </Button>
          </Col>
        </Row>
      </Card>

      {/* ── Chế độ embedded (sidebar): 2 cấp compact ── */}
      {isEmbedded && (
        <>
          <Table<DonHangGroup>
            rowKey="key"
            size="small"
            loading={isLoading}
            dataSource={groups}
            showHeader={false}
            defaultExpandAllRows
            columns={[
              {
                render: (_, g) => g.so_don ? (
                  <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{g.so_don}</Text>
                    {g.ten_khach_hang && (
                      <Text type="secondary" style={{ fontSize: 11 }}>{g.ten_khach_hang}</Text>
                    )}
                  </Space>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>Lệnh độc lập</Text>
                ),
              },
              {
                width: 80,
                align: 'right' as const,
                render: (_, g) => (
                  <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{g.so_lenh_count} lệnh</Tag>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (g) => (
                <div style={{ padding: '0 0 6px 20px' }}>
                  <Table<ProductionOrderListItem>
                    rowKey="id"
                    size="small"
                    showHeader={false}
                    dataSource={g.orders}
                    pagination={false}
                    rowClassName={(r) => r.id === selectedId ? 'md-selected-row' : ''}
                    onRow={(r) => ({
                      onClick: () => onSelect!(r.id),
                      style: { cursor: 'pointer' },
                    })}
                    columns={compactColumns}
                  />
                </div>
              ),
            }}
            pagination={false}
          />
          {(data?.total ?? 0) > 20 && (
            <div style={{ textAlign: 'right', marginTop: 6 }}>
              <Pagination
                total={data?.total}
                current={page}
                pageSize={20}
                onChange={setPage}
                showSizeChanger={false}
                size="small"
              />
            </div>
          )}
        </>
      )}

      {/* ── Chế độ full: bảng 2 cấp — đơn hàng → lệnh SX ── */}
      {!isEmbedded && (
        <>
          <Table<DonHangGroup>
            rowKey="key"
            size="small"
            loading={isLoading}
            dataSource={groups}
            columns={groupColumns}
            defaultExpandAllRows
            expandable={{
              expandedRowRender: (g) => (
                <div style={{ padding: '2px 0 10px 36px', background: '#fafafa' }}>
                  <Table<ProductionOrderListItem>
                    rowKey="id"
                    size="small"
                    dataSource={g.orders}
                    columns={orderColumns}
                    pagination={false}
                    scroll={{ x: 1000 }}
                  />
                </div>
              ),
            }}
            pagination={false}
            scroll={{ x: 700 }}
          />

          {/* Phân trang lệnh SX */}
          {(data?.total ?? 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {groups.length} đơn hàng &nbsp;·&nbsp; {data?.total} lệnh SX
              </Text>
              <Pagination
                total={data?.total}
                current={page}
                pageSize={20}
                onChange={setPage}
                showSizeChanger={false}
                size="small"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
