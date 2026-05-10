import { useState, useMemo } from 'react'
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
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionOrdersApi,
  TRANG_THAI_LABELS,
  TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type { ProductionOrderListItem } from '../../api/productionOrders'
import { exportToExcel, printToPdf, fmtDate, fmtNum, buildHtmlTable } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

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
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)

  const isEmbedded = !!onSelect

  const handleExportExcel = () => {
    const items = data?.items ?? []
    exportToExcel(`LenhSX_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Lệnh sản xuất',
      headers: ['STT', 'Số lệnh', 'Ngày lệnh', 'Đơn hàng', 'Khách hàng', 'Mã/Tên hàng', 'Hoàn thành dự kiến', 'Số dòng', 'SL kế hoạch', 'Trạng thái'],
      rows: items.map((r, i) => [
        i + 1, r.so_lenh, fmtDate(r.ngay_lenh),
        r.so_don ?? '', r.ten_khach_hang ?? '', r.ten_hang ?? '',
        fmtDate(r.ngay_hoan_thanh_ke_hoach),
        r.so_dong, Number(r.tong_sl_ke_hoach),
        TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
      ]),
      colWidths: [5, 18, 12, 16, 20, 28, 18, 8, 14, 14],
    }])
  }

  const handleExportPdf = () => {
    const items = data?.items ?? []
    const cols = [
      { header: 'STT', align: 'center' as const },
      { header: 'Số lệnh' }, { header: 'Ngày lệnh' },
      { header: 'Đơn hàng' }, { header: 'Khách hàng' }, { header: 'Mã/Tên hàng' },
      { header: 'Hoàn thành DK' },
      { header: 'Số dòng', align: 'center' as const },
      { header: 'SL kế hoạch', align: 'right' as const },
      { header: 'Trạng thái' },
    ]
    const rows = items.map((r, i) => [
      i + 1, r.so_lenh, fmtDate(r.ngay_lenh),
      r.so_don ?? '', r.ten_khach_hang ?? '', r.ten_hang ?? '',
      fmtDate(r.ngay_hoan_thanh_ke_hoach),
      r.so_dong, fmtNum(r.tong_sl_ke_hoach),
      TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
    ])
    printToPdf(
      'Danh sách lệnh sản xuất',
      `<h2>DANH SÁCH LỆNH SẢN XUẤT</h2>
       <p class="meta">Xuất ngày: ${dayjs().format('DD/MM/YYYY HH:mm')} — ${items.length} lệnh</p>
       ${buildHtmlTable(cols, rows)}`,
      true,
    )
  }

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

  // Gom nhóm theo đơn hàng (chỉ dùng cho chế độ full)
  const groups = useMemo(() => groupOrders(data?.items ?? []), [data?.items])

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
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v) => <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] || v}</Tag>,
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
              placeholder="Tìm số lệnh / mã hàng..."
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
              placeholder={['Ngày lệnh từ', 'Đến ngày']}
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
                    scroll={{ x: 820 }}
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
