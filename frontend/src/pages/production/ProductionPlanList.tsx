import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Pagination, Popover, Row,
  Select, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  ClockCircleOutlined, FileExcelOutlined, PlusOutlined,
  SearchOutlined, WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  productionPlansApi, PlanListItem, PLAN_TRANG_THAI,
} from '../../api/productionPlans'
import { warehouseApi } from '../../api/warehouse'
import { exportToExcel } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const SS_KEY = 'production_plan_filters'

function readFilter() {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}') } catch { return {} }
}
function writeFilter(v: object) {
  sessionStorage.setItem(SS_KEY, JSON.stringify(v))
}

// ── Màu nơi SX deterministic theo tên ─────────────────────────────────────────
const NOI_SX_COLORS = ['geekblue', 'green', 'purple', 'cyan', 'magenta', 'volcano', 'gold']
function noiSxColor(ten: string | null | undefined): string {
  if (!ten) return 'default'
  let h = 0
  for (let i = 0; i < ten.length; i++) h = (h * 31 + ten.charCodeAt(i)) & 0xffff
  return NOI_SX_COLORS[h % NOI_SX_COLORS.length]
}

interface Props {
  selectedId: number | null
  onSelect: (id: number) => void
}

export default function ProductionPlanList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const saved = readFilter()

  const [inputSearch, setInputSearch] = useState<string>(saved.search ?? '')
  const [search, setSearch] = useState<string>(saved.search ?? '')
  const [trangThai, setTrangThai] = useState<string | undefined>(saved.trangThai ?? undefined)
  const [noiSx, setNoiSx] = useState<string | undefined>(saved.noiSx ?? undefined)
  const [shortcut, setShortcut] = useState<string | null>(saved.shortcut ?? null)
  const [dateRange, setDateRange] = useState<[string, string] | null>(saved.dateRange ?? null)
  const [page, setPage] = useState<number>(saved.page ?? 1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    writeFilter({ search, trangThai, noiSx, shortcut, dateRange, page })
  }, [search, trangThai, noiSx, shortcut, dateRange, page])

  const handleSearchChange = (val: string) => {
    setInputSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val === '') { setSearch(''); setPage(1); return }
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1) }, 400)
  }

  // trangThai effective: shortcut có thể override
  const effectiveTrangThai =
    shortcut === 'nhap' || shortcut === 'da_xuat' || shortcut === 'hoan_thanh'
      ? shortcut
      : trangThai

  // ── API: danh sách KHSX ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['production-plans', search, effectiveTrangThai, noiSx, dateRange, page],
    queryFn: () =>
      productionPlansApi.list({
        search,
        trang_thai: effectiveTrangThai,
        exclude_nhap: shortcut !== 'nhap' && !effectiveTrangThai,
        noi_sx: noiSx,
        tu_ngay: dateRange?.[0],
        den_ngay: dateRange?.[1],
        page,
        page_size: 20,
      }).then(r => r.data),
  })

  // ── Nơi SX: chỉ lấy xưởng có CD1 (Hoàng Gia + Nam Thuận) ────────────────
  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })

  const noiSxOptions = useMemo(() => {
    // Ưu tiên xưởng có CD1 (KHSX chỉ thuộc về xưởng có CD1)
    const cd1 = phanXuongList
      .filter(x => x.cong_doan === 'cd1_cd2')
      .map(x => x.ten_xuong)
      .filter(Boolean)
    // Nếu API chưa có cong_doan → lấy tất cả
    const fromApi = cd1.length > 0
      ? cd1
      : phanXuongList.map(x => x.ten_xuong).filter(Boolean)
    // Bổ sung giá trị thực tế từ data (phòng khi DB cũ chưa có cong_doan)
    const fromData = (data?.items ?? []).map(i => i.noi_sx).filter(Boolean) as string[]
    const all = Array.from(new Set([...fromApi, ...fromData])).sort()
    return all.map(v => ({ value: v, label: v }))
  }, [phanXuongList, data?.items])

  // ── Frontend filter: quá hạn / hôm nay ───────────────────────────────────
  const today = dayjs().startOf('day')
  const displayItems = useMemo(() => {
    const items = data?.items ?? []
    if (shortcut === 'qua_han') {
      return items.filter(r =>
        r.trang_thai !== 'hoan_thanh' &&
        dayjs(r.ngay_ke_hoach).isBefore(today)
      )
    }
    if (shortcut === 'hom_nay') {
      return items.filter(r => dayjs(r.ngay_ke_hoach).isSame(today, 'day'))
    }
    return items
  }, [data?.items, shortcut])

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = data?.items ?? []
    const nhap = all.filter(r => r.trang_thai === 'nhap').length
    const daXuat = all.filter(r => r.trang_thai === 'da_xuat').length
    const quaHan = all.filter(r =>
      r.trang_thai !== 'hoan_thanh' && dayjs(r.ngay_ke_hoach).isBefore(today)
    ).length
    const homNay = all.filter(r => dayjs(r.ngay_ke_hoach).isSame(today, 'day')).length
    return { total: data?.total ?? 0, nhap, daXuat, quaHan, homNay }
  }, [data])

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExport = () => {
    const items = displayItems
    if (!items.length) return
    exportToExcel(`KHSX_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Kế hoạch SX',
      headers: ['STT', 'Số KH', 'Ngày KH', 'Nơi SX', 'Trạng thái', 'Số dòng', 'Tổng SL', 'Người lập'],
      rows: items.map((r, i) => [
        i + 1,
        r.so_ke_hoach,
        dayjs(r.ngay_ke_hoach).format('DD/MM/YYYY'),
        r.noi_sx ?? '',
        PLAN_TRANG_THAI[r.trang_thai]?.label ?? r.trang_thai,
        r.so_dong,
        Number(r.tong_sl),
        r.created_by_name ?? '',
      ]),
    }])
  }

  // ── Màu ngày: plan chưa hoàn thành mà quá hạn → cảnh báo ─────────────────
  const ngayStyle = (item: PlanListItem): React.CSSProperties => {
    if (item.trang_thai === 'hoan_thanh') return {}
    const diff = dayjs(item.ngay_ke_hoach).diff(today, 'day')
    if (diff < 0) return { color: '#cf1322', fontWeight: 700 }
    if (diff === 0) return { color: '#1677ff', fontWeight: 600 }
    if (diff <= 2) return { color: '#d46b08', fontWeight: 500 }
    return {}
  }

  const ngayIcon = (item: PlanListItem) => {
    if (item.trang_thai === 'hoan_thanh') return null
    const diff = dayjs(item.ngay_ke_hoach).diff(today, 'day')
    if (diff < 0) return <WarningOutlined style={{ color: '#cf1322', marginRight: 4 }} />
    if (diff === 0) return <ClockCircleOutlined style={{ color: '#1677ff', marginRight: 4 }} />
    return null
  }

  // ── Cột bảng ─────────────────────────────────────────────────────────────
  const cols: ColumnsType<PlanListItem> = [
    {
      title: 'Số KH',
      dataIndex: 'so_ke_hoach',
      width: 130,
      render: (v: string) => <Text strong style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Ngày KH',
      dataIndex: 'ngay_ke_hoach',
      width: 105,
      render: (v: string, r: PlanListItem) => (
        <span style={ngayStyle(r)}>
          {ngayIcon(r)}
          {dayjs(v).format('DD/MM/YYYY')}
        </span>
      ),
    },
    {
      title: 'Nơi SX',
      dataIndex: 'noi_sx',
      width: 110,
      render: (v: string | null) =>
        v ? (
          <Tag color={noiSxColor(v)} style={{ fontSize: 11, margin: 0 }}>{v}</Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 105,
      render: (v: string) => {
        const s = PLAN_TRANG_THAI[v] ?? { label: v, color: 'default' }
        return <Tag color={s.color} style={{ fontSize: 11 }}>{s.label}</Tag>
      },
    },
    {
      title: 'Dòng / SL',
      width: 85,
      render: (_: unknown, r: PlanListItem) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12, fontWeight: 500 }}>
            {new Intl.NumberFormat('vi-VN').format(Number(r.tong_sl))}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>{r.so_dong} dòng</Text>
        </Space>
      ),
    },
    {
      title: 'Người lập',
      dataIndex: 'created_by_name',
      width: 90,
      ellipsis: true,
      render: (v: string | null) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{v || '—'}</Text>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('production-plan-list', cols, { nonHideable: ['so_ke_hoach'] })

  return (
    <div>
      <style>{`.plan-selected-row > td { background-color: #e6f4ff !important; }`}</style>

      <Card style={{ marginBottom: 8 }} styles={{ body: { padding: '12px 16px' } }}>
        {/* ── Header ── */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
          <Col>
            <Title level={5} style={{ margin: 0 }}>Kế hoạch sản xuất</Title>
          </Col>
          <Col>
            <Space size={4}>
              <Tooltip title="Xuất Excel">
                <Button size="small" icon={<FileExcelOutlined />}
                  style={{ color: '#217346', borderColor: '#217346' }}
                  onClick={handleExport} />
              </Tooltip>
              <Button type="primary" size="small" icon={<PlusOutlined />}
                onClick={() => navigate('/production/plans/new')}>
                Tạo kế hoạch mới
              </Button>
              {settingsButton}
            </Space>
          </Col>
        </Row>

        {/* ── Tìm kiếm + trạng thái ── */}
        <Row gutter={8} style={{ marginBottom: 8 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số kế hoạch..."
              prefix={<SearchOutlined />}
              size="small"
              value={inputSearch}
              onChange={e => handleSearchChange(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Trạng thái"
              size="small"
              style={{ width: 120 }}
              value={trangThai}
              onChange={v => { setTrangThai(v); setShortcut(null); setPage(1) }}
              allowClear
              options={Object.entries(PLAN_TRANG_THAI).map(([v, s]) => ({ value: v, label: s.label }))}
            />
          </Col>
        </Row>

        {/* ── Filter nơi SX + ngày ── */}
        <Row gutter={8} style={{ marginBottom: 8 }}>
          <Col flex="auto">
            <Select
              placeholder="Nơi sản xuất"
              size="small"
              style={{ width: '100%' }}
              allowClear
              value={noiSx}
              onChange={v => { setNoiSx(v); setPage(1) }}
              options={noiSxOptions}
            />
          </Col>
          <Col flex="auto">
            <RangePicker
              format="DD/MM/YYYY"
              size="small"
              style={{ width: '100%' }}
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={(dates) => {
                setDateRange(
                  dates && dates[0] && dates[1]
                    ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
                    : null
                )
                setPage(1)
              }}
              placeholder={['Từ ngày', 'Đến ngày']}
            />
          </Col>
        </Row>

        {/* ── Shortcut buttons ── */}
        <Row gutter={6} style={{ marginBottom: 8 }}>
          {[
            { key: 'nhap',     label: 'Nháp',         danger: false },
            { key: 'da_xuat',  label: 'Đã xuất KH',   danger: false },
            { key: 'qua_han',  label: 'Quá hạn',       danger: true  },
            { key: 'hom_nay',  label: 'Hôm nay',       danger: false },
          ].map(({ key, label, danger }) => (
            <Col key={key}>
              <Button
                size="small"
                danger={danger && shortcut === key}
                type={shortcut === key ? 'primary' : 'default'}
                style={key === 'hom_nay' && shortcut === key
                  ? { borderColor: '#1677ff', background: '#1677ff', color: '#fff' }
                  : key === 'hom_nay'
                  ? { borderColor: '#1677ff', color: '#1677ff' }
                  : {}}
                onClick={() => {
                  const next = shortcut === key ? null : key
                  setShortcut(next)
                  // nhap/da_xuat/hoan_thanh cũng reset Select trạng thái
                  if (['nhap', 'da_xuat', 'hoan_thanh'].includes(key)) setTrangThai(undefined)
                  setPage(1)
                }}
              >
                {label}
                {key === 'qua_han' && stats.quaHan > 0 && (
                  <span style={{
                    marginLeft: 4, background: shortcut === key ? 'rgba(255,255,255,0.3)' : '#ff4d4f',
                    color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 10,
                  }}>
                    {stats.quaHan}
                  </span>
                )}
                {key === 'hom_nay' && stats.homNay > 0 && (
                  <span style={{
                    marginLeft: 4, background: shortcut === key ? 'rgba(255,255,255,0.3)' : '#1677ff',
                    color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 10,
                  }}>
                    {stats.homNay}
                  </span>
                )}
              </Button>
            </Col>
          ))}
        </Row>

        {/* ── Summary stats ── */}
        <Row gutter={12} style={{ paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
          <Col>
            <Statistic title="Tổng KH" value={stats.total} valueStyle={{ fontSize: 15 }} />
          </Col>
          <Col>
            <Statistic title="Nháp" value={stats.nhap}
              valueStyle={{ fontSize: 15, color: '#595959' }} />
          </Col>
          <Col>
            <Statistic title="Đã xuất" value={stats.daXuat}
              valueStyle={{ fontSize: 15, color: '#1677ff' }} />
          </Col>
          <Col>
            <Statistic title="Quá hạn" value={stats.quaHan}
              valueStyle={{ fontSize: 15, color: stats.quaHan > 0 ? '#cf1322' : '#595959' }} />
          </Col>
        </Row>
      </Card>

      {/* ── Bảng danh sách ── */}
      <Table<PlanListItem>
        rowKey="id"
        dataSource={displayItems}
        columns={displayColumns}
        loading={isLoading}
        size="small"
        pagination={false}
        rowClassName={r => r.id === selectedId ? 'plan-selected-row' : ''}
        onRow={r => ({ onClick: () => onSelect(r.id), style: { cursor: 'pointer' } })}
        scroll={{ x: 600 }}
      />

      {(data?.total ?? 0) > 20 && (
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Pagination
            total={data?.total}
            current={page}
            pageSize={20}
            onChange={setPage}
            showTotal={t => `${t} kế hoạch`}
            showSizeChanger={false}
            size="small"
          />
        </div>
      )}
    </div>
  )
}
