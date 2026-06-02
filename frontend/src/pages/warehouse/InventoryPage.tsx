import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Row, Select, Input, Spin, Table, Tag, Tooltip,
  Typography, Space, Statistic, Tabs, message, Progress, Badge,
} from 'antd'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND, fmtNum, smartExportExcel, smartPrintPdf } from '../../utils/exportUtils'
import ImportExcelDialog from '../../components/ImportExcelDialog'
import EmptyState from '../../components/EmptyState'
import {
  DatabaseOutlined, FileExcelOutlined, FilePdfOutlined,
  WarningOutlined, UploadOutlined, SyncOutlined,
  InboxOutlined, DollarOutlined, AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import { warehouseApi, PhanXuongWithWarehouses, WarehouseSlot, TonKho, TonKhoGiayRow, GiayRoll } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { phapNhanApi } from '../../api/phap_nhan'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const LOAI_LABELS: Record<string, string> = {
  GIAY_CUON: 'Giấy cuộn', NVL_PHU: 'NVL phụ', PHOI: 'Phôi sóng', THANH_PHAM: 'Thành phẩm',
}
const ALL_LOAI = ['GIAY_CUON', 'NVL_PHU', 'PHOI', 'THANH_PHAM']

const LOAI_COLORS: Record<string, string> = {
  GIAY_CUON: '#1677ff', NVL_PHU: '#fa8c16', NVL: '#fa8c16',
  PHOI: '#52c41a', THANH_PHAM: '#722ed1', TP: '#722ed1', KHAC: '#8c8c8c',
}

const LOAI_DISPLAY: Record<string, string> = {
  GIAY_CUON: 'Giấy cuộn', NVL_PHU: 'NVL phụ', NVL: 'NVL phụ',
  PHOI: 'Phôi sóng', THANH_PHAM: 'Thành phẩm', TP: 'Thành phẩm', KHAC: 'Khác',
}

function fmtB(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' tỷ'
  if (v >= 1e6) return (v / 1e6).toFixed(0) + ' tr'
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
}

function getSlot(px: PhanXuongWithWarehouses, loai: string): WarehouseSlot | null | undefined {
  const slot = (px.warehouses as Record<string, unknown>)[loai]
  if (slot && typeof slot === 'object' && 'not_applicable' in slot) return null
  return slot as WarehouseSlot | null
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['ton-kho-summary'],
    queryFn: () => warehouseApi.getTonKhoSummary().then(r => r.data),
    refetchInterval: 120_000,
  })

  if (isLoading) return <Spin style={{ margin: 60, display: 'block', textAlign: 'center' }} />
  if (!summary) return null

  const pieData = (summary.by_loai ?? []).map(b => ({
    name: LOAI_DISPLAY[b.loai_kho] || b.loai_kho,
    value: b.gia_tri,
    color: LOAI_COLORS[b.loai_kho] || '#8c8c8c',
  }))

  const barData = (summary.by_warehouse ?? [])
    .filter(w => w.gia_tri > 0)
    .slice(0, 10)
    .map(w => ({
      name: w.ten_kho.length > 18 ? w.ten_kho.slice(0, 16) + '…' : w.ten_kho,
      fullName: w.ten_kho,
      gia_tri: w.gia_tri,
      so_mat_hang: w.so_mat_hang,
    }))

  return (
    <div>
      {/* KPI Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #1677ff' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Tổng mặt hàng</Text>}
              value={summary.total_mat_hang}
              prefix={<InboxOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #52c41a' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Tổng giá trị tồn</Text>}
              value={summary.total_gia_tri}
              formatter={v => fmtB(Number(v))}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${summary.low_stock_count > 0 ? '#ff4d4f' : '#52c41a'}` }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Cần nhập thêm</Text>}
              value={summary.low_stock_count}
              prefix={<WarningOutlined style={{ color: summary.low_stock_count > 0 ? '#ff4d4f' : '#52c41a' }} />}
              valueStyle={{ color: summary.low_stock_count > 0 ? '#ff4d4f' : '#52c41a', fontSize: 24 }}
              suffix={<Text style={{ fontSize: 13 }}>mặt hàng</Text>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #fa8c16' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Số kho đang quản lý</Text>}
              value={summary.by_warehouse.length}
              prefix={<DatabaseOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontSize: 24 }}
              suffix={<Text style={{ fontSize: 13 }}>kho</Text>}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {/* Bar chart: giá trị theo kho */}
        <Col xs={24} lg={15}>
          <Card
            size="small"
            title={<Space><DatabaseOutlined /><span>Giá trị tồn theo kho (Top 10)</span></Space>}
            style={{ height: 320 }}
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtB(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <RTooltip
                  formatter={(v: unknown) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="gia_tri" fill="#1677ff" radius={[0, 3, 3, 0]} maxBarSize={22}
                  label={{ position: 'right', formatter: (v: unknown) => fmtB(Number(v)), fontSize: 11, fill: '#555' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Pie: phân loại */}
        <Col xs={24} lg={9}>
          <Card
            size="small"
            title={<Space><AppstoreOutlined /><span>Phân loại tồn kho</span></Space>}
            style={{ height: 320 }}
          >
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip
                  formatter={(v: unknown) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'}
                  contentStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Low stock alerts */}
      {(summary.low_stock ?? []).length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              <Text strong style={{ color: '#ff4d4f' }}>Cảnh báo tồn kho thấp ({summary.low_stock.length} mặt hàng)</Text>
            </Space>
          }
          style={{ borderColor: '#ffbb96' }}
        >
          <Row gutter={[8, 8]}>
            {(summary.low_stock ?? []).map(item => (
              <Col key={item.id} xs={24} sm={12} lg={8}>
                <div style={{
                  background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6,
                  padding: '8px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 12, color: '#cf1322' }}>{item.ten_hang}</Text>
                    <Tag color="red" style={{ fontSize: 11, margin: 0 }}>{item.pct}%</Tag>
                  </div>
                  <Progress
                    percent={Math.min(item.pct, 100)}
                    size="small"
                    strokeColor={item.pct < 25 ? '#ff4d4f' : '#fa8c16'}
                    trailColor="#ffccc7"
                    showInfo={false}
                    style={{ marginBottom: 2 }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item.ten_kho} · {item.ton_luong.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} / {item.ton_toi_thieu.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} {item.don_vi}
                  </Text>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  )
}

// ─── Chi tiết Tab ─────────────────────────────────────────────────────────────
function RollsExpand({ pmId, whId }: { pmId: number | null; whId: number }) {
  const { data: rolls = [], isLoading } = useQuery({
    queryKey: ['giay-rolls-expand', pmId, whId],
    queryFn: () => warehouseApi.listGiayRolls({ paper_material_id: pmId ?? undefined, warehouse_id: whId, trang_thai: 'trong_kho' }).then(r => r.data),
    enabled: pmId != null,
    staleTime: 60_000,
  })
  if (isLoading) return <Spin size="small" style={{ margin: 8 }} />
  if (!rolls.length) return <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>Chưa có cuộn nào đăng ký</Text>
  return (
    <Table<GiayRoll>
      dataSource={rolls} rowKey="id" size="small" pagination={false}
      style={{ marginLeft: 48 }}
      columns={[
        { title: 'Mã cuộn', dataIndex: 'barcode', width: 130,
          render: (v: string) => <Text code style={{ color: '#1677ff', fontWeight: 600 }}>{v}</Text> },
        { title: 'KL ban đầu', dataIndex: 'trong_luong_ban_dau', width: 120, align: 'right' as const,
          render: (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kg` },
        { title: 'KL còn lại', dataIndex: 'trong_luong_con_lai', width: 120, align: 'right' as const,
          render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kg</Text> },
        { title: 'Phiếu nhập', dataIndex: 'so_phieu_nhap', width: 160,
          render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—' },
        { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 110,
          render: (v: string | null) => v ? <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> : '—' },
      ]}
    />
  )
}

function ChiTietTab() {
  const qc = useQueryClient()
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [warehouseId, setWarehouseId] = useState<number | undefined>()
  const [loaiFilter, setLoaiFilter] = useState<string>('giay')  // mặc định xem giấy cuộn
  const [khoFilter, setKhoFilter] = useState<number | undefined>()
  const [loaiGiayFilter, setLoaiGiayFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [importVisible, setImportVisible] = useState(false)

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })
  const { data: phapNhans = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 300_000,
  })
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })
  const loaiParam = loaiFilter === 'tat-ca' ? undefined : loaiFilter
  const { data: tonKho = [], isLoading, isError } = useQuery({
    queryKey: ['ton-kho', phapNhanId, phanXuongId, warehouseId, loaiParam],
    queryFn: () => warehouseApi.getTonKho({ phap_nhan_id: phapNhanId, phan_xuong_id: phanXuongId, warehouse_id: warehouseId, loai: loaiParam }).then(r => r.data),
    refetchInterval: 60_000,
  })

  const phanXuongsByPn = phapNhanId ? phanXuongs.filter(x => x.phap_nhan_id === phapNhanId) : phanXuongs
  const allowedPxIds = new Set(phanXuongsByPn.map(x => x.id))
  const filteredWarehouses = warehouses.filter(w =>
    (!phapNhanId || (w.phan_xuong_id != null && allowedPxIds.has(w.phan_xuong_id))) &&
    (!phanXuongId || w.phan_xuong_id === phanXuongId)
  )

  const khoOptions = useMemo(() => {
    const vals = [...new Set(tonKho.map(r => r.kho_mm).filter((v): v is number => v != null))]
    return vals.sort((a, b) => a - b).map(v => ({ value: v, label: `${v} mm` }))
  }, [tonKho])

  const filtered = tonKho.filter(r => {
    if (khoFilter != null && r.kho_mm !== khoFilter) return false
    if (loaiGiayFilter && r.loai_giay !== loaiGiayFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.ten_hang.toLowerCase().includes(q) ||
        (r.ma_chinh || '').toLowerCase().includes(q) ||
        (r.ma_ky_hieu || '').toLowerCase().includes(q)
    }
    return true
  })

  const isGiay = loaiFilter === 'giay'
  const tongGiaTri = filtered.reduce((s, r) => s + r.gia_tri_ton, 0)

  const handleExportExcel = () => {
    const resolvedPhapNhanId = phapNhanId ?? (phanXuongId ? (phanXuongs.find(px => px.id === phanXuongId)?.phap_nhan_id ?? null) : null)
    if (!filtered.length) { message.warning('Không có dữ liệu để xuất Excel'); return }
    if (!resolvedPhapNhanId) { message.error('Chọn phân xưởng có pháp nhân để xuất Excel.'); return }
    const cfg = isGiay
      ? [
          { key: 'stt', label: 'STT', width: 5 },
          { key: 'ma_chinh', label: 'Mã chính', width: 22 },
          { key: 'ma_ky_hieu', label: 'Mã ký hiệu', width: 12 },
          { key: 'ten_hang', label: 'Tên hàng', width: 30 },
          { key: 'kho_mm', label: 'Khổ (mm)', width: 10 },
          { key: 'dinh_luong', label: 'ĐL (g/m²)', width: 10 },
          { key: 'ton_luong', label: 'Tồn kho (kg)', width: 13 },
          { key: 'don_gia_binh_quan', label: 'Đơn giá BQ', width: 14 },
          { key: 'gia_tri_ton', label: 'Giá trị tồn', width: 16 },
          { key: 'ten_kho', label: 'Kho', width: 16 },
        ]
      : [
          { key: 'stt', label: 'STT', width: 5 },
          { key: 'ten_hang', label: 'Tên hàng', width: 35 },
          { key: 'ten_kho', label: 'Kho', width: 18 },
          { key: 'ton_luong', label: 'Tồn kho', width: 12 },
          { key: 'don_vi', label: 'ĐVT', width: 8 },
          { key: 'don_gia_binh_quan', label: 'Đơn giá BQ', width: 14 },
          { key: 'gia_tri_ton', label: 'Giá trị tồn', width: 16 },
        ]
    smartExportExcel('INVENTORY', filtered.map((r, i) => ({ ...r, stt: i + 1 })), cfg, `TonKho_${loaiFilter}_${dayjs().format('YYYYMMDD')}`, resolvedPhapNhanId)
  }

  // Columns chung
  const colTonLuong = {
    title: 'Tồn kho',
    width: 170,
    render: (_: unknown, r: TonKho) => {
      const hasMins = r.ton_toi_thieu > 0
      const pct = hasMins ? Math.min(Math.round((r.ton_luong / r.ton_toi_thieu) * 100), 200) : null
      const low = hasMins && r.ton_luong < r.ton_toi_thieu
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: hasMins ? 2 : 0 }}>
            <Text strong style={{ fontSize: 13, color: low ? '#ff4d4f' : '#1677ff' }}>
              {r.ton_luong.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>{r.don_vi}</Text>
            </Text>
            {pct !== null && <Text type="secondary" style={{ fontSize: 11 }}>{pct}%</Text>}
          </div>
          {hasMins && (
            <Progress percent={pct!} size="small"
              strokeColor={low ? '#ff4d4f' : (pct! < 120 ? '#fa8c16' : '#52c41a')}
              showInfo={false} style={{ margin: 0 }} />
          )}
        </div>
      )
    },
  }

  const colGiaTri = {
    title: 'Giá trị tồn',
    dataIndex: 'gia_tri_ton',
    width: 120,
    align: 'right' as const,
    render: (v: number) => <Text strong style={{ color: '#52c41a', fontSize: 12 }}>{fmtB(v)}</Text>,
  }

  const colDonGia = {
    title: 'Đơn giá BQ',
    dataIndex: 'don_gia_binh_quan',
    width: 115,
    align: 'right' as const,
    render: (v: number) => v > 0
      ? <Text style={{ fontSize: 12 }}>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text>
      : <Text type="secondary">—</Text>,
  }

  const colCapNhat = {
    title: 'Cập nhật',
    dataIndex: 'cap_nhat_luc',
    width: 90,
    render: (v: string | null) => v
      ? <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('DD/MM HH:mm')}</Text>
      : '—',
  }

  // Cột riêng cho giấy cuộn — ký hiệu là ưu tiên
  const columnsGiay = [
    {
      title: 'Mã ký hiệu',
      dataIndex: 'ma_ky_hieu',
      width: 100,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, padding: '2px 8px' }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Mã chính',
      dataIndex: 'ma_chinh',
      width: 180,
      render: (v: string | null) => v
        ? <Text code style={{ fontSize: 11 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tên giấy',
      dataIndex: 'ten_hang',
      render: (v: string, r: TonKho) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{v}</Text>
          <Space size={4}>
            {r.kho_mm && <Tag style={{ fontSize: 10, margin: 0 }}>Khổ {r.kho_mm}mm</Tag>}
            {r.dinh_luong && <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>{r.dinh_luong} g/m²</Tag>}
          </Space>
        </Space>
      ),
    },
    { title: 'Kho', dataIndex: 'ten_kho', width: 140,
      render: (v: string) => <Tag style={{ fontSize: 11 }}>{v}</Tag> },
    colTonLuong,
    colDonGia,
    colGiaTri,
    colCapNhat,
  ]

  // Cột cho NVL / Thành phẩm / Tất cả
  const columnsDefault = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      render: (v: string, r: TonKho) => (
        <Space>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          {r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0 && (
            <Tooltip title={`Tồn tối thiểu: ${r.ton_toi_thieu} ${r.don_vi}`}>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: 'Kho', dataIndex: 'ten_kho', width: 150,
      render: (v: string) => <Tag style={{ fontSize: 11 }}>{v}</Tag> },
    colTonLuong,
    colDonGia,
    colGiaTri,
    colCapNhat,
  ]

  const columns = isGiay ? columnsGiay : columnsDefault

  return (
    <div>
      {/* Toolbar */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {filtered.length} mặt hàng · Giá trị: <Text strong style={{ color: '#52c41a' }}>{fmtB(tongGiaTri)}</Text>
          </Text>
        </Col>
        <Col>
          <Space size={4}>
            <Button size="small" icon={<UnorderedListOutlined />}
              type={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')} />
            <Button size="small" icon={<AppstoreOutlined />}
              type={viewMode === 'cards' ? 'primary' : 'default'}
              onClick={() => setViewMode('cards')} />
            <Button size="small" icon={<UploadOutlined />}
              onClick={() => { if (!warehouseId) return message.warning('Chọn kho để import'); setImportVisible(true) }}>
              Import tồn đầu
            </Button>
            <Tooltip title="Xuất Excel">
              <Button size="small" icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel} />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={5}>
            <Select placeholder="Tất cả pháp nhân" style={{ width: '100%' }} allowClear value={phapNhanId}
              onChange={v => { setPhapNhanId(v); setPhanXuongId(undefined); setWarehouseId(undefined) }}
              options={phapNhans.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))} />
          </Col>
          <Col xs={24} sm={5}>
            <Select placeholder="Tất cả xưởng" style={{ width: '100%' }} allowClear value={phanXuongId}
              onChange={v => { setPhanXuongId(v); setWarehouseId(undefined) }}
              options={phanXuongsByPn.map(x => ({ value: x.id, label: x.ten_xuong }))} />
          </Col>
          <Col xs={24} sm={5}>
            <Select placeholder="Tất cả kho" style={{ width: '100%' }} allowClear value={warehouseId}
              onChange={setWarehouseId}
              options={filteredWarehouses.filter(w => w.trang_thai).map(w => ({ value: w.id, label: w.ten_kho }))} />
          </Col>
          <Col xs={24} sm={4}>
            <Select style={{ width: '100%' }} value={loaiFilter}
              onChange={v => { setLoaiFilter(v); setKhoFilter(undefined); setLoaiGiayFilter(undefined) }}
              options={[
                { value: 'giay', label: '🔵 Giấy cuộn' },
                { value: 'khac', label: '🟠 NVL phụ' },
                { value: 'tp', label: '🟣 Thành phẩm' },
                { value: 'tat-ca', label: '⬜ Tất cả' },
              ]} />
          </Col>
          <Col xs={24} sm={5}>
            <Input.Search
              placeholder={isGiay ? 'Tìm tên, mã chính, ký hiệu...' : 'Tìm tên hàng...'}
              value={search} onChange={e => setSearch(e.target.value)} allowClear />
          </Col>
          {isGiay && (
            <Col xs={24} sm={4}>
              <Select
                placeholder="Lọc theo khổ (mm)"
                style={{ width: '100%' }}
                allowClear
                value={khoFilter}
                onChange={setKhoFilter}
                options={khoOptions}
                showSearch
                optionFilterProp="label"
              />
            </Col>
          )}
          {isGiay && (
            <Col xs={24} sm={4}>
              <Select
                placeholder="Loại giấy"
                style={{ width: '100%' }}
                allowClear
                value={loaiGiayFilter}
                onChange={setLoaiGiayFilter}
                options={[
                  { value: 'nau',   label: '🟤 Nâu' },
                  { value: 'trang', label: '⬜ Trắng' },
                  { value: 'xeo',   label: '🔘 Xeo' },
                  { value: 'vang',  label: '🟡 Vàng' },
                  { value: 'khac',  label: '— Khác' },
                ]}
              />
            </Col>
          )}
        </Row>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Spin style={{ margin: 40, display: 'block' }} />
      ) : isError ? (
        <Card size="small">
          <Text type="danger">Không thể tải dữ liệu. Kiểm tra kết nối server.</Text>
        </Card>
      ) : viewMode === 'table' ? (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            locale={{ emptyText: <EmptyState size="small" /> }}
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: ['50','100','200','500'], showTotal: t => `${t} mặt hàng` }}
            scroll={{ x: isGiay ? 1000 : 800 }}
            rowClassName={(r: TonKho) =>
              r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0 ? 'ant-table-row-danger' : ''}
            expandable={isGiay ? {
              expandedRowRender: (r: TonKho) => <RollsExpand pmId={r.paper_material_id} whId={r.warehouse_id} />,
              rowExpandable: (r: TonKho) => r.paper_material_id != null,
            } : undefined}
          />
        </Card>
      ) : (
        /* Card view */
        <Row gutter={[10, 10]}>
          {filtered.length === 0
            ? <Col span={24}><EmptyState size="small" /></Col>
            : filtered.map(r => {
              const hasMins = r.ton_toi_thieu > 0
              const pct = hasMins ? Math.min(Math.round((r.ton_luong / r.ton_toi_thieu) * 100), 200) : null
              const low = hasMins && r.ton_luong < r.ton_toi_thieu
              const accentColor = low ? '#ff4d4f' : (LOAI_COLORS[r.loai_kho || ''] || '#1677ff')
              return (
                <Col key={r.id} xs={24} sm={12} lg={8} xl={6}>
                  <Card size="small" style={{ borderLeft: `4px solid ${accentColor}`, height: '100%' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ flex: 1 }}>
                        {r.ma_ky_hieu && (
                          <Tag color="blue" style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{r.ma_ky_hieu}</Tag>
                        )}
                        <div>
                          <Text strong style={{ fontSize: 12, lineHeight: 1.3 }}>{r.ten_hang}</Text>
                        </div>
                      </div>
                      {low && <WarningOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />}
                    </div>
                    {/* Specs giấy */}
                    {isGiay && (r.kho_mm || r.dinh_luong) && (
                      <Space size={4} style={{ marginBottom: 4 }}>
                        {r.kho_mm && <Tag style={{ fontSize: 10, margin: 0 }}>Khổ {r.kho_mm}mm</Tag>}
                        {r.dinh_luong && <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>{r.dinh_luong} g/m²</Tag>}
                      </Space>
                    )}
                    {isGiay && r.ma_chinh && (
                      <Text code style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>{r.ma_chinh}</Text>
                    )}
                    <Tag style={{ fontSize: 10, marginBottom: 6 }}>{r.ten_kho}</Tag>
                    {/* Tồn */}
                    <div>
                      <Text strong style={{ fontSize: 18, color: low ? '#ff4d4f' : '#1677ff' }}>
                        {r.ton_luong.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{r.don_vi}</Text>
                    </div>
                    {hasMins && (
                      <>
                        <Progress percent={pct!} size="small"
                          strokeColor={low ? '#ff4d4f' : (pct! < 120 ? '#fa8c16' : '#52c41a')}
                          showInfo={false} style={{ margin: '4px 0' }} />
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          Min: {r.ton_toi_thieu.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} {r.don_vi}
                        </Text>
                      </>
                    )}
                    {r.gia_tri_ton > 0 && (
                      <div style={{ marginTop: 6, textAlign: 'right' }}>
                        <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 600 }}>{fmtB(r.gia_tri_ton)}</Text>
                      </div>
                    )}
                  </Card>
                </Col>
              )
            })
          }
        </Row>
      )}

      <ImportExcelDialog
        title={`Import tồn kho đầu kỳ — ${warehouses.find(w => w.id === warehouseId)?.ten_kho}`}
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onSuccess={() => { qc.invalidateQueries({ queryKey: ['ton-kho'] }); qc.invalidateQueries({ queryKey: ['ton-kho-summary'] }) }}
        importFn={(file, commit) => warehouseApi.importInventory(warehouseId!, file, commit).then(r => r.data)}
        templateUrl={warehouseId ? `/api/warehouse/inventory/import-template?warehouse_id=${warehouseId}` : undefined}
      />
    </div>
  )
}

// ─── Giấy cuộn Tab ────────────────────────────────────────────────────────────
type GiayCuonGrouped = {
  ky_hieu: string
  items: TonKho[]
  total_kg: number
  total_cuon: number
  total_gia_tri: number
}


function GiayCuonTab() {
  const [khoFilter, setKhoFilter] = useState<number | undefined>()
  const [loaiGiayFilter, setLoaiGiayFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['ton-kho', undefined, undefined, undefined, 'giay'],
    queryFn: () => warehouseApi.getTonKho({ loai: 'giay' }).then(r => r.data),
    refetchInterval: 60_000,
  })

  const khoOptions = useMemo(() => {
    const vals = [...new Set(data.map(r => r.kho_mm).filter((v): v is number => v != null))]
    return vals.sort((a, b) => a - b).map(v => ({ value: v, label: `${v} mm` }))
  }, [data])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (khoFilter != null && r.kho_mm !== khoFilter) return false
      if (loaiGiayFilter && r.loai_giay !== loaiGiayFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return r.ten_hang.toLowerCase().includes(q) ||
          (r.ma_chinh || '').toLowerCase().includes(q) ||
          (r.ma_ky_hieu || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [data, khoFilter, loaiGiayFilter, search])

  // Sắp xếp: theo ky_hieu asc, dinh_luong desc
  const tableRows = useMemo(() =>
    [...filtered].sort((a, b) => {
      const kCmp = (a.ma_ky_hieu || '').localeCompare(b.ma_ky_hieu || '')
      if (kCmp !== 0) return kCmp
      return (b.dinh_luong || 0) - (a.dinh_luong || 0)
    }),
  [filtered])

  const totalKg = filtered.reduce((s, r) => s + r.ton_luong, 0)
  const totalGiaTri = filtered.reduce((s, r) => s + r.gia_tri_ton, 0)
  const totalNhap = data.filter(r => (r.bien_dong ?? 0) > 0).reduce((s, r) => s + (r.bien_dong ?? 0), 0)
  const totalXuat = data.filter(r => (r.bien_dong ?? 0) < 0).reduce((s, r) => s + Math.abs(r.bien_dong ?? 0), 0)
  const hasBienDong = data.some(r => r.bien_dong != null)

  // Top 5 khổ + định lượng — tính từ data gốc (không bị filter ảnh hưởng)
  const topKho = useMemo(() => {
    const map = new Map<number, { kg: number; cuon: number }>()
    for (const r of data) {
      if (r.kho_mm == null) continue
      const cur = map.get(r.kho_mm) ?? { kg: 0, cuon: 0 }
      map.set(r.kho_mm, { kg: cur.kg + r.ton_luong, cuon: cur.cuon + 1 })
    }
    return [...map.entries()]
      .sort((a, b) => b[1].kg - a[1].kg)
      .slice(0, 5)
      .map(([kho, v]) => ({ label: `${kho} mm`, ...v }))
  }, [data])

  const topDL = useMemo(() => {
    const map = new Map<number, { kg: number; cuon: number }>()
    for (const r of data) {
      if (r.dinh_luong == null) continue
      const cur = map.get(r.dinh_luong) ?? { kg: 0, cuon: 0 }
      map.set(r.dinh_luong, { kg: cur.kg + r.ton_luong, cuon: cur.cuon + 1 })
    }
    return [...map.entries()]
      .sort((a, b) => b[1].kg - a[1].kg)
      .slice(0, 5)
      .map(([dl, v]) => ({ label: `${dl} g/m²`, ...v }))
  }, [data])

  const maxKhoKg = topKho[0]?.kg ?? 1
  const maxDLKg = topDL[0]?.kg ?? 1

  if (isLoading) return <Spin style={{ margin: 60, display: 'block', textAlign: 'center' }} />

  const filterBar = (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Row gutter={[8, 8]} align="middle">
        <Col xs={24} sm={5}>
          <Select placeholder="Lọc theo khổ (mm)" style={{ width: '100%' }} allowClear
            value={khoFilter} onChange={setKhoFilter}
            options={khoOptions} showSearch optionFilterProp="label" />
        </Col>
        <Col xs={24} sm={5}>
          <Select placeholder="Loại giấy" style={{ width: '100%' }} allowClear
            value={loaiGiayFilter} onChange={setLoaiGiayFilter}
            options={[
              { value: 'nau',   label: '🟤 Nâu' },
              { value: 'trang', label: '⬜ Trắng' },
              { value: 'xeo',   label: '🔘 Xeo' },
              { value: 'vang',  label: '🟡 Vàng' },
              { value: 'khac',  label: '— Khác' },
            ]} />
        </Col>
        <Col xs={24} sm={9}>
          <Input.Search placeholder="Tìm tên, mã chính, ký hiệu..."
            value={search} onChange={e => setSearch(e.target.value)} allowClear />
        </Col>
        <Col xs={24} sm={5}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <Text strong style={{ color: '#1677ff' }}>{filtered.length} cuộn</Text>
            {' · '}tổng <Text strong>{Math.round(totalKg).toLocaleString('vi-VN')} kg</Text>
          </Text>
        </Col>
      </Row>
    </Card>
  )

  const columns = [
    {
      title: 'Mã giấy',
      dataIndex: 'ma_ky_hieu',
      width: 90,
      align: 'center' as const,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'ĐL',
      dataIndex: 'dinh_luong',
      width: 70,
      align: 'right' as const,
      render: (v: number | null) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khổ (mm)',
      dataIndex: 'kho_mm',
      width: 80,
      align: 'right' as const,
      render: (v: number | null) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tên giấy',
      dataIndex: 'ten_hang',
      render: (v: string, r: TonKho) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <Text style={{ fontSize: 12 }}>{v}</Text>
            {r.ma_chinh && <Text type="secondary" style={{ fontSize: 10 }}>({r.ma_chinh})</Text>}
          </Space>
          {r.ten_nsx && <Text type="secondary" style={{ fontSize: 10 }}>{r.ten_nsx}</Text>}
        </Space>
      ),
    },
    {
      title: 'Nhập gần nhất',
      dataIndex: 'ngay_nhap_gan_nhat',
      width: 100,
      align: 'center' as const,
      render: (v: string | null) => v
        ? <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Tồn (kg)',
      dataIndex: 'ton_luong',
      width: 110,
      align: 'right' as const,
      sorter: (a: TonKho, b: TonKho) => a.ton_luong - b.ton_luong,
      render: (v: number, r: TonKho) => (
        <Space size={4} direction="vertical" style={{ gap: 0 }}>
          <Text strong style={{ color: '#389e0d', fontSize: 13 }}>
            {Math.round(v).toLocaleString('vi-VN')}
          </Text>
          {r.bien_dong != null && Math.abs(r.bien_dong) >= 1 && (
            <Text style={{ fontSize: 11, color: r.bien_dong > 0 ? '#1677ff' : '#ff4d4f' }}>
              {r.bien_dong > 0 ? '▲' : '▼'} {Math.abs(Math.round(r.bien_dong)).toLocaleString('vi-VN')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Giá trị',
      dataIndex: 'gia_tri_ton',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ fontSize: 12, color: '#52c41a' }}>{fmtB(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
  ]

  const renderRankPanel = (
    title: string,
    rows: { label: string; kg: number; cuon: number }[],
    maxKg: number,
    color: string,
    onClickFilter: (label: string) => void,
  ) => (
    <Card size="small" title={<Text strong style={{ fontSize: 13 }}>{title}</Text>} styles={{ body: { padding: '8px 12px' } }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => onClickFilter(r.label)}>
          <Row justify="space-between" style={{ marginBottom: 2 }}>
            <Space size={6}>
              <Text style={{ color: '#999', fontSize: 11, width: 14, display: 'inline-block' }}>#{i + 1}</Text>
              <Text strong style={{ fontSize: 13 }}>{r.label}</Text>
            </Space>
            <Space size={12}>
              <Text style={{ color: '#1677ff', fontSize: 12 }}>{r.cuon} cuộn</Text>
              <Text strong style={{ color, fontSize: 13 }}>{Math.round(r.kg).toLocaleString('vi-VN')} kg</Text>
            </Space>
          </Row>
          <Progress
            percent={Math.round((r.kg / maxKg) * 100)}
            showInfo={false}
            strokeColor={color}
            trailColor="#f0f0f0"
            size={['100%', 6] as any}
          />
        </div>
      ))}
    </Card>
  )

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={12}>
          {renderRankPanel(
            '🔢 Top 5 khổ giấy tồn nhiều nhất',
            topKho, maxKhoKg, '#389e0d',
            (label) => {
              const mm = parseFloat(label)
              if (!isNaN(mm)) setKhoFilter(mm)
            },
          )}
        </Col>
        <Col span={12}>
          {renderRankPanel(
            '⚖️ Top 5 định lượng tồn nhiều nhất',
            topDL, maxDLKg, '#d46b08',
            () => {},
          )}
        </Col>
      </Row>
      {hasBienDong && (
        <Card size="small" style={{ marginBottom: 12 }}
          styles={{ body: { padding: '8px 16px' } }}>
          <Row gutter={24} align="middle">
            <Col><Text strong style={{ fontSize: 13 }}>📊 Biến động hôm nay</Text></Col>
            <Col>
              <Text style={{ color: '#1677ff' }}>
                ▲ Nhập: <Text strong style={{ color: '#1677ff' }}>{Math.round(totalNhap).toLocaleString('vi-VN')} kg</Text>
              </Text>
            </Col>
            <Col>
              <Text style={{ color: '#ff4d4f' }}>
                ▼ Xuất/giảm: <Text strong style={{ color: '#ff4d4f' }}>{Math.round(totalXuat).toLocaleString('vi-VN')} kg</Text>
              </Text>
            </Col>
            <Col>
              <Text type="secondary" style={{ fontSize: 12 }}>
                (so với lần sync trước)
              </Text>
            </Col>
          </Row>
        </Card>
      )}
      {filterBar}
      <Card
        size="small"
        styles={{ body: { padding: 0 } }}
        title={
          <Space>
            <UnorderedListOutlined />
            <span>Kg theo mã ký hiệu giấy</span>
          </Space>
        }
      >
        <Table
          dataSource={tableRows}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 700, y: 600 }}
          bordered
          locale={{ emptyText: <EmptyState size="small" /> }}
          summary={() => (
            <Table.Summary.Row style={{ background: '#f6ffed' }}>
              <Table.Summary.Cell index={0} colSpan={3} align="right">
                <Text strong>Tổng cộng</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="left">
                <Text strong style={{ color: '#1677ff' }}>{tableRows.length} cuộn</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong style={{ color: '#389e0d', fontSize: 13 }}>
                  {Math.round(totalKg).toLocaleString('vi-VN')} kg
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong style={{ color: '#52c41a' }}>{fmtB(totalGiaTri)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  )
}

// ─── Theo xưởng Tab ───────────────────────────────────────────────────────────
// ─── Đối soát kho giấy cuộn ──────────────────────────────────────────────────
function DoiSoatTab() {
  const [nccId, setNccId] = useState<number | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list-doi-soat'],
    queryFn: () => import('../../api/suppliers').then(m => m.suppliersApi.list({ trang_thai: true, page_size: 200 })).then(r => r.data.items ?? r.data),
  })

  const params = {
    ncc_id: nccId,
    date_from: dateRange?.[0] || undefined,
    date_to: dateRange?.[1] || undefined,
  }
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['doi-soat-giay', params],
    queryFn: () => warehouseApi.getDoiSoatGiay(params).then(r => r.data),
  })

  const tongLenh = data.length
  const tongKhop = data.filter(r => Math.abs(r.chenh_lech) <= 50 && (r.ty_le_khop == null || r.ty_le_khop >= 80)).length
  const tongLech = tongLenh - tongKhop

  function rowClass(r: import('../../api/warehouse').DoiSoatGiayRow) {
    if (Math.abs(r.chenh_lech) > 50 || (r.ty_le_khop != null && r.ty_le_khop < 80))
      return 'doi-soat-row-lech'
    return ''
  }

  const columns = [
    {
      title: 'Mã', width: 110, fixed: 'left' as const,
      render: (_: unknown, r: import('../../api/warehouse').DoiSoatGiayRow) => (
        <div>
          <Text strong style={{ fontSize: 12 }}>{r.ma_chinh ?? '—'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.ma_ky_hieu ?? ''}</Text>
        </div>
      ),
    },
    {
      title: 'Tên / NSX / Loại', width: 170,
      render: (_: unknown, r: import('../../api/warehouse').DoiSoatGiayRow) => (
        <div>
          <div style={{ fontSize: 12 }}>{r.ten ?? '—'}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.ten_nsx ?? ''}</Text>
          {r.loai_giay && (
            <Tag style={{ marginLeft: 4, fontSize: 10 }} color={
              r.loai_giay === 'nau' ? 'volcano' : r.loai_giay === 'trang' ? 'default' :
              r.loai_giay === 'vang' ? 'gold' : r.loai_giay === 'xeo' ? 'cyan' : 'default'
            }>{r.loai_giay}</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Tồn SQL (kg)', dataIndex: 'ton_sql', width: 110, align: 'right' as const,
      sorter: (a: import('../../api/warehouse').DoiSoatGiayRow, b: import('../../api/warehouse').DoiSoatGiayRow) => a.ton_sql - b.ton_sql,
      render: (v: number) => <Text strong>{fmtNum(v)}</Text>,
    },
    {
      title: 'Nhập ERP (kg)', dataIndex: 'tong_nhap_erp', width: 120, align: 'right' as const,
      sorter: (a: import('../../api/warehouse').DoiSoatGiayRow, b: import('../../api/warehouse').DoiSoatGiayRow) => a.tong_nhap_erp - b.tong_nhap_erp,
      render: (v: number) => fmtNum(v),
    },
    {
      title: 'Chênh lệch (kg)', dataIndex: 'chenh_lech', width: 130, align: 'right' as const,
      defaultSortOrder: 'descend' as const,
      sorter: (a: import('../../api/warehouse').DoiSoatGiayRow, b: import('../../api/warehouse').DoiSoatGiayRow) => Math.abs(b.chenh_lech) - Math.abs(a.chenh_lech),
      render: (v: number) => {
        const color = Math.abs(v) > 50 ? '#cf1322' : v > 0 ? '#389e0d' : '#595959'
        return <Text style={{ color, fontWeight: Math.abs(v) > 50 ? 700 : 400 }}>{v > 0 ? '+' : ''}{fmtNum(v)}</Text>
      },
    },
    {
      title: 'Tỷ lệ khớp', dataIndex: 'ty_le_khop', width: 110, align: 'right' as const,
      sorter: (a: import('../../api/warehouse').DoiSoatGiayRow, b: import('../../api/warehouse').DoiSoatGiayRow) => (a.ty_le_khop ?? 0) - (b.ty_le_khop ?? 0),
      render: (v: number | null) => {
        if (v == null) return <Text type="secondary">—</Text>
        const color = v < 80 ? '#cf1322' : v < 95 ? '#d46b08' : '#389e0d'
        return <Text style={{ color, fontWeight: v < 80 ? 700 : 400 }}>{v}%</Text>
      },
    },
    {
      title: 'Giá SQL (đ/kg)', dataIndex: 'gia_sql', width: 120, align: 'right' as const,
      render: (v: number) => v ? fmtVND(v) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Giá ERP (đ/kg)', dataIndex: 'gia_erp', width: 120, align: 'right' as const,
      render: (v: number) => v ? fmtVND(v) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Chênh giá', dataIndex: 'chenh_gia', width: 110, align: 'right' as const,
      render: (v: number) => {
        if (!v) return <Text type="secondary">—</Text>
        const color = Math.abs(v) > 1000 ? '#cf1322' : '#595959'
        return <Text style={{ color }}>{v > 0 ? '+' : ''}{fmtVND(v)}</Text>
      },
    },
    {
      title: 'Nhập ERP gần nhất', dataIndex: 'ngay_nhap_erp', width: 130,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : <Text type="secondary">—</Text>,
    },
  ]

  const exportDefaultConfig = [
    { key: 'ma_chinh', label: 'Mã chính', width: 14 },
    { key: 'ma_ky_hieu', label: 'Mã ký hiệu', width: 14 },
    { key: 'ten', label: 'Tên', width: 30 },
    { key: 'ten_nsx', label: 'NSX', width: 18 },
    { key: 'loai_giay', label: 'Loại giấy', width: 12 },
    { key: 'ton_sql', label: 'Tồn SQL (kg)', width: 16 },
    { key: 'tong_nhap_erp', label: 'Nhập ERP (kg)', width: 16 },
    { key: 'chenh_lech', label: 'Chênh lệch (kg)', width: 16 },
    { key: 'ty_le_khop', label: 'Tỷ lệ khớp (%)', width: 14 },
    { key: 'gia_sql', label: 'Giá SQL (đ/kg)', width: 16 },
    { key: 'gia_erp', label: 'Giá ERP (đ/kg)', width: 16 },
    { key: 'chenh_gia', label: 'Chênh giá (đ/kg)', width: 16 },
    { key: 'ngay_nhap_erp', label: 'Nhập ERP gần nhất', width: 18 },
  ]
  function handleExport() {
    smartExportExcel('DOI_SOAT_GIAY', data, exportDefaultConfig, `DoiSoatGiay_${dayjs().format('YYYYMMDD')}`)
  }

  return (
    <div>
      <style>{`.doi-soat-row-lech td { background: #fff1f0 !important; }`}</style>
      <Card size="small" style={{ marginBottom: 10 }}>
        <Row gutter={[8, 8]} align="middle">
          <Col>
            <Select
              allowClear placeholder="Lọc NCC"
              style={{ width: 180 }} value={nccId} onChange={setNccId}
              options={(Array.isArray(suppliers) ? suppliers : ((suppliers as unknown as { items?: unknown[] }).items ?? [])).map((s) => {
                const sup = s as { id: number; ten_viet_tat?: string; ten_ncc?: string }
                return { value: sup.id, label: sup.ten_viet_tat || sup.ten_ncc || String(sup.id) }
              })}
            />
          </Col>
          <Col>
            <Space>
              <Text style={{ fontSize: 12 }}>Từ:</Text>
              <Input type="date" style={{ width: 130 }}
                value={dateRange?.[0] ?? ''} onChange={e => setDateRange(prev => [e.target.value, prev?.[1] ?? ''])} />
              <Text style={{ fontSize: 12 }}>Đến:</Text>
              <Input type="date" style={{ width: 130 }}
                value={dateRange?.[1] ?? ''} onChange={e => setDateRange(prev => [prev?.[0] ?? '', e.target.value])} />
              {dateRange && <Button size="small" onClick={() => setDateRange(null)}>Xóa</Button>}
            </Space>
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              <Tag color="green">Khớp: {tongKhop}</Tag>
              <Tag color="red">Lệch: {tongLech}</Tag>
              <Button size="small" icon={<SyncOutlined />} onClick={() => refetch()}>Làm mới</Button>
              <Button size="small" icon={<FileExcelOutlined />} onClick={handleExport}>Excel</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          locale={{ emptyText: <EmptyState size="small" /> }}
          dataSource={data}
          columns={columns}
          rowKey="paper_material_id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: 1240 }}
          rowClassName={rowClass}
        />
      </Card>
    </div>
  )
}

function TheoXuongTab() {
  const { data: khoTheoXuong = [], isLoading } = useQuery({
    queryKey: ['kho-theo-xuong'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data),
  })

  function fmtMoney(v: number) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + 'đ'
  }

  const xuongColumns = [
    {
      title: 'Xưởng', dataIndex: 'ten_xuong', width: 160, fixed: 'left' as const,
      render: (v: string, r: PhanXuongWithWarehouses) => (
        <Space>
          <Tag color={r.cong_doan === 'cd1_cd2' ? 'blue' : 'green'}>{r.cong_doan === 'cd1_cd2' ? 'CD1+2' : 'CD2'}</Tag>
          <span style={{ fontWeight: 600 }}>{v}</span>
        </Space>
      ),
    },
    ...ALL_LOAI.map(loai => ({
      title: LOAI_LABELS[loai],
      key: loai,
      width: 190,
      render: (_: unknown, px: PhanXuongWithWarehouses) => {
        const slot = getSlot(px, loai)
        if (slot === null) return <Tag color="default" style={{ fontSize: 11 }}>N/A</Tag>
        if (!slot) return <Tag color="orange" style={{ fontSize: 11 }}>Chưa tạo</Tag>
        const hasVal = slot.tong_so_luong > 0
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 13, color: LOAI_COLORS[loai] }}>
                {slot.tong_so_luong.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}> {slot.don_vi_suc_chua ?? ''}</Text>
              </Text>
              {hasVal && <Badge color={LOAI_COLORS[loai]} />}
            </div>
            {hasVal && (
              <Text style={{ color: '#52c41a', fontSize: 12 }}>{fmtMoney(slot.tong_gia_tri)}</Text>
            )}
          </div>
        )
      },
    })),
  ]

  return (
    <Card size="small" styles={{ body: { padding: 0 } }} style={{ marginTop: 8 }}>
      <Table
        locale={{ emptyText: <EmptyState size="small" /> }}
        dataSource={khoTheoXuong as PhanXuongWithWarehouses[]}
        columns={xuongColumns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 960 }}
      />
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 4 }}>
        <Col>
          <Space>
            <DatabaseOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Quản lý tồn kho</Title>
          </Space>
        </Col>
        <Col>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <SyncOutlined spin={false} /> Tự cập nhật mỗi 60s
          </Text>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 12 }}
        items={[
          { key: 'dashboard', label: <Space><AppstoreOutlined />Tổng quan</Space> },
          { key: 'giay-cuon', label: <Space><InboxOutlined style={{ color: '#1677ff' }} />Giấy cuộn</Space> },
          { key: 'chi-tiet', label: <Space><UnorderedListOutlined />Chi tiết tồn kho</Space> },
          { key: 'theo-xuong', label: <Space><DatabaseOutlined />Theo xưởng</Space> },
          { key: 'doi-soat', label: <Space><WarningOutlined style={{ color: '#faad14' }} />Đối soát</Space> },
        ]}
      />

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'giay-cuon' && <GiayCuonTab />}
      {activeTab === 'chi-tiet' && <ChiTietTab />}
      {activeTab === 'theo-xuong' && <TheoXuongTab />}
      {activeTab === 'doi-soat' && <DoiSoatTab />}
    </div>
  )
}
