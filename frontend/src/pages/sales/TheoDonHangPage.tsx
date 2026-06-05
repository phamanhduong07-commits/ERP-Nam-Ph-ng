import React, { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Input, Row,
  Select, Space, Statistic, Table, Tag, Typography,
} from 'antd'
import {
  DownloadOutlined, LeftOutlined, RightOutlined,
  SearchOutlined, SyncOutlined, WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import client from '../../api/client'
import { theoDoiApi, STAGE_COLORS } from '../../api/theoDoi'
import type { DonHangTheoDoiRow, PhanXuongItem } from '../../api/theoDoi'
import { usePhapNhanList } from '../../hooks/usePhapNhan'
import { exportToExcel } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"
import { storage, TTL } from '../../utils/storage'

const { Text, Title } = Typography

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const FILTER_SCREEN_KEY = 'theo-doi'

interface SavedFilters {
  phanXuongId?: number
  nvTheodoiId?: number
  phapNhanId?: number
  includeHoanThanh: boolean
}

const DEFAULT_FILTERS: SavedFilters = { includeHoanThanh: false }

function loadFilters(): SavedFilters {
  return storage.loadFilters<SavedFilters>(FILTER_SCREEN_KEY) ?? DEFAULT_FILTERS
}

function saveFilters(f: SavedFilters) {
  storage.saveFilters(FILTER_SCREEN_KEY, f)
}

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtDate = (v: string | null | undefined) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—'

function DeliveryBadge({ v }: { v: string }) {
  const diff = dayjs(v).startOf('day').diff(dayjs().startOf('day'), 'day')
  const isLate = diff < 0
  const isSoon = !isLate && diff <= 3
  return (
    <div>
      <Text style={{ color: isLate ? '#ff4d4f' : isSoon ? '#fa8c16' : undefined, fontWeight: (isLate || isSoon) ? 600 : undefined }}>
        {isLate && <WarningOutlined style={{ marginRight: 3 }} />}
        {fmtDate(v)}
      </Text>
      {isLate && (
        <div><Tag color="red" style={{ fontSize: 10, padding: '0 3px', margin: '2px 0 0' }}>Trễ {Math.abs(diff)} ngày</Tag></div>
      )}
      {diff === 0 && (
        <div><Tag color="orange" style={{ fontSize: 10, padding: '0 3px', margin: '2px 0 0' }}>Hôm nay!</Tag></div>
      )}
      {isSoon && diff > 0 && (
        <div><Tag color="gold" style={{ fontSize: 10, padding: '0 3px', margin: '2px 0 0' }}>Còn {diff} ngày</Tag></div>
      )}
    </div>
  )
}

export default function TheoDonHangPage() {
  const saved = loadFilters()

  // Drawer — index vào filtered array (-1 = đóng)
  const [drawerIdx, setDrawerIdx] = useState<number>(-1)

  // Server-side filters (persist localStorage)
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>(saved.phanXuongId)
  const [nvTheodoiId, setNvTheodoiId] = useState<number | undefined>(saved.nvTheodoiId)
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>(saved.phapNhanId)
  const [includeHoanThanh, setIncludeHoanThanh] = useState(saved.includeHoanThanh)
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([undefined, undefined])

  // Client-side filters (session only)
  const [search, setSearch] = useState('')
  const [filterKhach, setFilterKhach] = useState<string | undefined>()
  const [filterStage, setFilterStage] = useState<string | undefined>()
  const [filterQuaHan, setFilterQuaHan] = useState(false)

  // Row selection for summary panel
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    saveFilters({ phanXuongId, nvTheodoiId, phapNhanId, includeHoanThanh })
  }, [phanXuongId, nvTheodoiId, phapNhanId, includeHoanThanh])

  const { data: phanXuongs = [] } = useQuery<PhanXuongItem[]>({
    queryKey: ['theo-doi-phan-xuong'],
    queryFn: () => theoDoiApi.listPhanXuong().then(r => r.data),
  })

  const { data: users = [] } = useQuery<{ id: number; ho_ten: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => client.get<{ id: number; ho_ten: string }[]>('/users').then(r => r.data),
  })

  const { data: phapNhanList = [] } = usePhapNhanList()

  // Khi search theo mã LSX/đơn hàng cụ thể → bao gồm cả hoàn thành để không bị ẩn
  const searchIsSpecific = debouncedSearch.trim().length >= 6
  const effectiveIncludeHoanThanh = searchIsSpecific || includeHoanThanh

  const {
    data: rows = [], isLoading, refetch, dataUpdatedAt,
  } = useQuery<DonHangTheoDoiRow[]>({
    queryKey: ['theo-doi-don-hang', phanXuongId, nvTheodoiId, phapNhanId, effectiveIncludeHoanThanh, dateRange],
    queryFn: () =>
      theoDoiApi.getDonHang({
        phan_xuong_id: phanXuongId,
        nv_theo_doi_id: nvTheodoiId,
        phap_nhan_id: phapNhanId,
        include_hoan_thanh: effectiveIncludeHoanThanh,
        tu_ngay: dateRange[0],
        den_ngay: dateRange[1],
      }).then(r => r.data),
    refetchInterval: 2 * 60 * 1000,
  })

  const today = dayjs().format('YYYY-MM-DD')
  const lastRefreshTime = dataUpdatedAt > 0 ? dayjs(dataUpdatedAt).format('HH:mm:ss') : null

  const khachOptions = useMemo(() => {
    const seen = new Set<string>()
    return rows
      .map(r => r.ten_khach_hang)
      .filter((v): v is string => !!v && !seen.has(v) && !!seen.add(v))
      .sort()
      .map(v => ({ label: v, value: v }))
  }, [rows])

  const stageOptions = useMemo(() => {
    const seen = new Set<string>()
    return rows
      .filter(r => r.stage && !seen.has(r.stage) && !!seen.add(r.stage))
      .map(r => ({ label: r.stage_label, value: r.stage }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  }, [rows])

  // Stage counts from server-filtered rows (for the summary bar above table)
  const stageCounts = useMemo(() => {
    const map: Record<string, { count: number; label: string }> = {}
    rows.forEach(r => {
      if (!map[r.stage]) map[r.stage] = { count: 0, label: r.stage_label }
      map[r.stage].count++
    })
    return map
  }, [rows])

  const filtered = useMemo(() => {
    let data = rows
    if (filterKhach) data = data.filter(r => r.ten_khach_hang === filterKhach)
    if (filterStage) data = data.filter(r => r.stage === filterStage)
    if (filterQuaHan) data = data.filter(r => r.ngay_giao_hang && r.ngay_giao_hang < today && r.stage !== 'hoan_thanh')
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase()
      data = data.filter(r =>
        (r.so_lenh ?? '').toLowerCase().includes(s) ||
        (r.ten_khach_hang ?? '').toLowerCase().includes(s) ||
        (r.so_don ?? '').toLowerCase().includes(s) ||
        (r.ten_hang ?? '').toLowerCase().includes(s) ||
        (r.ten_nv_theo_doi ?? '').toLowerCase().includes(s) ||
        (r.ten_phan_xuong ?? '').toLowerCase().includes(s)
      )
    }
    return data
  }, [rows, debouncedSearch, filterKhach, filterStage, filterQuaHan, today])

  // Drawer row derived from index — stable reference into filtered
  const drawerRow = drawerIdx >= 0 && drawerIdx < filtered.length ? filtered[drawerIdx] : null

  // Keyboard navigation: ←/→ khi drawer mở, Esc để đóng
  useEffect(() => {
    if (drawerIdx < 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && drawerIdx > 0) setDrawerIdx(i => i - 1)
      else if (e.key === 'ArrowRight' && drawerIdx < filtered.length - 1) setDrawerIdx(i => i + 1)
      else if (e.key === 'Escape') setDrawerIdx(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drawerIdx, filtered.length])

  const selectedRows = useMemo(
    () => filtered.filter(r => {
      const key = r.production_order_id != null ? r.production_order_id : `so-${r.sales_order_id}`
      return selectedKeys.includes(key)
    }),
    [filtered, selectedKeys]
  )
  const totThuong = selectedRows.reduce((s, r) => s + r.so_luong_ke_hoach, 0)
  const totKhoi = selectedRows.reduce((s, r) => s + (r.so_khoi ?? 0), 0)

  const quaHanCount = useMemo(
    () => rows.filter(r => r.ngay_giao_hang && r.ngay_giao_hang < today && r.stage !== 'hoan_thanh').length,
    [rows, today]
  )

  function handleExportExcel() {
    exportToExcel(`theo-doi-don-hang-${dayjs().format('YYYYMMDD-HHmm')}`, [{
      name: 'Theo dõi ĐH',
      headers: [
        'LSX', 'Số đơn', 'Pháp nhân', 'Khách hàng', 'Tên hàng',
        'Xưởng', 'Kho SX', 'NV theo dõi', 'Số thùng',
        'Nhập phôi', 'Chuyển phôi', 'Tồn phôi', 'Giai đoạn', 'Ngày giao',
      ],
      rows: filtered.map(r => [
        r.so_lenh ?? '', r.so_don ?? '', r.ten_phap_nhan ?? '', r.ten_khach_hang ?? '',
        r.ten_hang ?? '', r.ten_phan_xuong ?? '', r.ten_kho_sx ?? '', r.ten_nv_theo_doi ?? '',
        r.so_luong_ke_hoach, r.tong_nhap_phoi, r.tong_chuyen_phoi, r.ton_kho_phoi,
        r.stage_label, r.ngay_giao_hang ?? '',
      ]),
      colWidths: [14, 14, 10, 20, 25, 12, 15, 15, 10, 10, 10, 10, 15, 12],
    }])
  }

  function getRowClass(r: DonHangTheoDoiRow) {
    if (r.production_order_id == null) return 'row-no-lsx'
    if (r.ngay_giao_hang && r.ngay_giao_hang < today && r.stage !== 'hoan_thanh') return 'row-qua-han'
    if (r.ngay_giao_hang && r.stage !== 'hoan_thanh') {
      const diff = dayjs(r.ngay_giao_hang).startOf('day').diff(dayjs().startOf('day'), 'day')
      if (diff >= 0 && diff <= 3) return 'row-sap-den'
    }
    return ''
  }

  const columns: ColumnsType<DonHangTheoDoiRow> = [
    {
      title: 'LSX', dataIndex: 'so_lenh', width: 130, fixed: 'left',
      render: (v, r) => (
        <div>
          <Button
            type="link"
            style={{
              padding: 0, height: 'auto',
              fontWeight: v ? 600 : 400,
              fontSize: 13,
              color: v ? undefined : '#8c8c8c',
              fontStyle: v ? undefined : 'italic',
            }}
            onClick={() => setDrawerIdx(filtered.indexOf(r))}
          >
            {v ?? 'Chưa có LSX'}
          </Button>
          {r.so_don && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.so_don}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 90,
      render: v => v ? <Tag style={{ fontSize: 11, margin: 0 }}>{v}</Tag> : <Text type="secondary">—</Text>,
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
      title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 90,
      render: v => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Kho SX', dataIndex: 'ten_kho_sx', width: 100, ellipsis: true,
      render: v => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'NV theo dõi', dataIndex: 'ten_nv_theo_doi', width: 110, ellipsis: true,
      render: v => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Số thùng', dataIndex: 'so_luong_ke_hoach', width: 90, align: 'right' as const,
      render: v => <Text strong style={{ color: '#1677ff' }}>{fmtN(v)}</Text>,
    },
    {
      title: 'Nhập phôi', width: 110,
      render: (_, r) =>
        r.tong_nhap_phoi > 0 ? (
          <div>
            <Text strong style={{ color: '#389e0d' }}>{fmtN(r.tong_nhap_phoi)} tấm</Text>
            {r.ngay_nhap_cuoi && <div><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.ngay_nhap_cuoi)}</Text></div>}
          </div>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Chuyển phôi', width: 100,
      render: (_, r) =>
        r.tong_chuyen_phoi > 0 ? (
          <div>
            <Tag color="geekblue" style={{ margin: 0 }}>{fmtN(r.tong_chuyen_phoi)}</Tag>
            {r.ngay_chuyen_cuoi && <div><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.ngay_chuyen_cuoi)}</Text></div>}
          </div>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tồn phôi', dataIndex: 'ton_kho_phoi', width: 90,
      render: v =>
        v > 0 ? <Tag color="lime">{fmtN(v)}</Tag>
        : v < 0 ? <Tag color="red">{fmtN(v)}</Tag>
        : <Text type="secondary">0</Text>,
    },
    {
      title: 'Tồn TP', width: 100,
      render: (_, r) =>
        r.ton_kho_tp > 0 ? (
          <div>
            <Tag color="cyan" style={{ margin: 0 }}>{fmtN(r.ton_kho_tp)}</Tag>
            {r.ngay_nhap_tp_cuoi && <div><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.ngay_nhap_tp_cuoi)}</Text></div>}
          </div>
        ) : r.ton_kho_tp < 0 ? <Tag color="red">{fmtN(r.ton_kho_tp)}</Tag>
        : <Text type="secondary">0</Text>,
    },
    {
      title: 'Giai đoạn', width: 150,
      render: (_, r) => (
        <div>
          <Tag color={STAGE_COLORS[r.stage] ?? 'default'}>{r.stage_label}</Tag>
          {r.ten_may_in && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.ten_may_in}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Giao hàng', dataIndex: 'ngay_giao_hang', width: 120,
      render: v => v ? <DeliveryBadge v={v} /> : <Text type="secondary">—</Text>,
      sorter: (a, b) => (a.ngay_giao_hang ?? '9999') < (b.ngay_giao_hang ?? '9999') ? -1 : 1,
      defaultSortOrder: 'ascend' as const,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .row-no-lsx > td { background: #fffbe6 !important; }
        .row-qua-han > td { background: #fff1f0 !important; }
        .row-sap-den > td { background: #fff7e6 !important; }
      `}</style>
      <Title level={4} style={{ marginBottom: 16 }}>Theo dõi đơn hàng</Title>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">

          {/* ── Hàng filter 1 ── */}
          <Row gutter={[8, 8]} align="middle">
            <Col>
              <Select
                placeholder="Tất cả pháp nhân"
                allowClear
                style={{ width: 160 }}
                options={phapNhanList.map(p => ({ label: p.ten_viet_tat || p.ten_phap_nhan, value: p.id }))}
                value={phapNhanId}
                onChange={v => setPhapNhanId(v)}
              />
            </Col>
            <Col>
              <Select
                placeholder="Tất cả xưởng"
                allowClear
                style={{ width: 150 }}
                options={phanXuongs.map(p => ({ label: p.ten_xuong, value: p.id }))}
                value={phanXuongId}
                onChange={v => setPhanXuongId(v)}
              />
            </Col>
            <Col>
              <Select
                placeholder="Tất cả khách hàng"
                allowClear
                style={{ width: 170 }}
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
                style={{ width: 160 }}
                showSearch
                optionFilterProp="label"
                options={users.map(u => ({ label: u.ho_ten, value: u.id }))}
                value={nvTheodoiId}
                onChange={v => setNvTheodoiId(v)}
              />
            </Col>
            <Col>
              <Select
                placeholder="Tất cả giai đoạn"
                allowClear
                style={{ width: 150 }}
                options={stageOptions}
                value={filterStage}
                onChange={v => setFilterStage(v)}
              />
            </Col>
          </Row>

          {/* ── Hàng filter 2 ── */}
          <Row gutter={[8, 8]} align="middle">
            <Col>
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                placeholder={['Từ ngày lệnh', 'Đến ngày lệnh']}
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
                placeholder="Tìm LSX / khách / hàng / NV / xưởng..."
                prefix={<SearchOutlined />}
                style={{ width: 270 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col>
              <Button
                type={filterQuaHan ? 'primary' : 'default'}
                danger={filterQuaHan}
                size="small"
                icon={<WarningOutlined />}
                onClick={() => setFilterQuaHan(v => !v)}
              >
                Quá hạn {quaHanCount > 0 && `(${quaHanCount})`}
              </Button>
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
              <Button
                size="small"
                icon={<SyncOutlined spin={isLoading} />}
                onClick={() => refetch()}
              >
                Làm mới
              </Button>
            </Col>
            {lastRefreshTime && (
              <Col>
                <Text type="secondary" style={{ fontSize: 11 }}>Cập nhật {lastRefreshTime}</Text>
              </Col>
            )}
            <Col>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleExportExcel}
              >
                Xuất Excel
              </Button>
            </Col>
            <Col flex="auto" />
            <Col>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedKeys.length > 0
                  ? `Đã chọn ${selectedKeys.length} / ${filtered.length} lệnh`
                  : `${filtered.length} lệnh SX`}
              </Text>
            </Col>
          </Row>

          {/* ── Stage summary bar — click để lọc nhanh ── */}
          {Object.keys(stageCounts).length > 0 && (
            <Row gutter={[4, 4]} align="middle">
              {Object.entries(stageCounts)
                .sort((a, b) => a[1].label.localeCompare(b[1].label, 'vi'))
                .map(([stage, { count, label }]) => (
                  <Col key={stage}>
                    <Tag
                      color={filterStage === stage ? (STAGE_COLORS[stage] ?? 'default') : undefined}
                      style={{
                        cursor: 'pointer',
                        userSelect: 'none',
                        opacity: filterStage && filterStage !== stage ? 0.4 : 1,
                        transition: 'opacity 0.2s',
                      }}
                      onClick={() => setFilterStage(filterStage === stage ? undefined : stage)}
                    >
                      {label}{' '}
                      <Text style={{ fontWeight: 700, fontSize: 11, color: filterStage === stage ? 'inherit' : '#1677ff' }}>
                        {count}
                      </Text>
                    </Tag>
                  </Col>
                ))
              }
              {filterStage && (
                <Col>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, fontSize: 11 }}
                    onClick={() => setFilterStage(undefined)}
                  >
                    ✕ Bỏ lọc giai đoạn
                  </Button>
                </Col>
              )}
            </Row>
          )}

          <Table<DonHangTheoDoiRow>
            rowKey={r => r.production_order_id != null ? r.production_order_id : `so-${r.sales_order_id}`}
            size="small"
            loading={isLoading}
            dataSource={filtered}
            columns={columns}
            pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
            scroll={{ x: 'max-content' }}
            rowClassName={getRowClass}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: setSelectedKeys,
              preserveSelectedRowKeys: true,
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span>
                      Không có lệnh nào
                      {(filterKhach || filterStage || filterQuaHan || debouncedSearch) && (
                        <>
                          {' — '}
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0 }}
                            onClick={() => {
                              setFilterKhach(undefined)
                              setFilterStage(undefined)
                              setFilterQuaHan(false)
                              setSearch('')
                            }}
                          >
                            Bỏ bộ lọc
                          </Button>
                        </>
                      )}
                    </span>
                  }
                />
              ),
            }}
          />

          {/* ── Summary panel khi có chọn ── */}
          {selectedKeys.length > 0 && (
            <div style={{
              padding: '10px 20px',
              background: '#e6f7ff',
              border: '1px solid #91caff',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 32,
            }}>
              <Text strong style={{ color: '#1677ff' }}>Đã chọn {selectedKeys.length} lệnh:</Text>
              <Statistic
                title="Tổng số thùng"
                value={totThuong}
                precision={0}
                valueStyle={{ fontSize: 18, color: '#1677ff', fontWeight: 600 }}
              />
              <Statistic
                title="Tổng số khối (m³)"
                value={totKhoi}
                precision={3}
                valueStyle={{ fontSize: 18, fontWeight: 600 }}
                suffix="m³"
              />
              <Button size="small" onClick={() => setSelectedKeys([])}>Bỏ chọn</Button>
            </div>
          )}
        </Space>
      </Card>

      {/* ── Drawer xem nhanh LSX — có điều hướng Trước/Tiếp ── */}
      <Drawer
        title={
          <Space>
            <span>
              {drawerRow?.so_lenh
                ? `Lệnh SX: ${drawerRow.so_lenh}`
                : drawerRow?.so_don
                  ? `Đơn hàng: ${drawerRow.so_don}`
                  : 'Chi tiết'}
            </span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {drawerIdx + 1} / {filtered.length}
            </Text>
          </Space>
        }
        open={drawerIdx >= 0}
        onClose={() => setDrawerIdx(-1)}
        width={420}
        footer={
          <Row justify="space-between" align="middle">
            <Col>
              <Button
                icon={<LeftOutlined />}
                disabled={drawerIdx <= 0}
                onClick={() => setDrawerIdx(i => i - 1)}
              >
                Trước
              </Button>
            </Col>
            <Col>
              <Text type="secondary">{drawerIdx + 1} / {filtered.length}</Text>
            </Col>
            <Col>
              <Button
                disabled={drawerIdx >= filtered.length - 1}
                onClick={() => setDrawerIdx(i => i + 1)}
              >
                Tiếp <RightOutlined />
              </Button>
            </Col>
          </Row>
        }
      >
        {drawerRow && (() => {
          const d = drawerRow
          const ddiff = d.ngay_giao_hang
            ? dayjs(d.ngay_giao_hang).startOf('day').diff(dayjs().startOf('day'), 'day')
            : null
          const dLate = ddiff != null && ddiff < 0
          const dSoon = ddiff != null && !dLate && ddiff <= 3

          return (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Số đơn hàng">
                {d.so_don ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Pháp nhân">
                {d.ten_phap_nhan ? <Tag>{d.ten_phap_nhan}</Tag> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {d.ten_khach_hang ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Tên hàng">
                {d.ten_hang ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Xưởng SX">
                {d.ten_phan_xuong ? <Tag>{d.ten_phan_xuong}</Tag> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Kho SX">
                {d.ten_kho_sx ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="NV theo dõi">
                {d.ten_nv_theo_doi ?? <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày lệnh">
                {fmtDate(d.ngay_lenh)}
              </Descriptions.Item>
              <Descriptions.Item label="Giao hàng">
                {d.ngay_giao_hang ? (
                  <div>
                    <Text style={{ color: dLate ? '#ff4d4f' : dSoon ? '#fa8c16' : undefined, fontWeight: (dLate || dSoon) ? 600 : undefined }}>
                      {dLate && <WarningOutlined style={{ marginRight: 4 }} />}
                      {fmtDate(d.ngay_giao_hang)}
                    </Text>
                    {dLate && <Tag color="red" style={{ marginLeft: 6, fontSize: 11 }}>Trễ {Math.abs(ddiff!)} ngày</Tag>}
                    {!dLate && ddiff === 0 && <Tag color="orange" style={{ marginLeft: 6, fontSize: 11 }}>Hôm nay!</Tag>}
                    {!dLate && ddiff! > 0 && dSoon && <Tag color="gold" style={{ marginLeft: 6, fontSize: 11 }}>Còn {ddiff} ngày</Tag>}
                  </div>
                ) : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Số thùng KH">
                <Text strong style={{ color: '#1677ff' }}>{fmtN(d.so_luong_ke_hoach)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Nhập phôi">
                {d.tong_nhap_phoi > 0
                  ? <Text style={{ color: '#389e0d' }}>{fmtN(d.tong_nhap_phoi)} tấm</Text>
                  : <Text type="secondary">Chưa nhập</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Chuyển phôi">
                {d.tong_chuyen_phoi > 0
                  ? <Tag color="geekblue">{fmtN(d.tong_chuyen_phoi)}</Tag>
                  : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Tồn kho phôi">
                {d.ton_kho_phoi > 0
                  ? <Tag color="lime">{fmtN(d.ton_kho_phoi)}</Tag>
                  : <Text type="secondary">0</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Tồn thành phẩm">
                {d.ton_kho_tp > 0
                  ? <Tag color="cyan">{fmtN(d.ton_kho_tp)}</Tag>
                  : <Text type="secondary">0</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Giai đoạn">
                <Tag color={STAGE_COLORS[d.stage] ?? 'default'}>{d.stage_label}</Tag>
              </Descriptions.Item>
              {d.so_phieu_in && (
                <Descriptions.Item label="Phiếu in">{d.so_phieu_in}</Descriptions.Item>
              )}
              {d.ten_may_in && (
                <Descriptions.Item label="Máy in">{d.ten_may_in}</Descriptions.Item>
              )}
              {d.so_luong_in_ok != null && (
                <Descriptions.Item label="Đã in OK">
                  <Text strong style={{ color: '#52c41a' }}>{fmtN(d.so_luong_in_ok)}</Text>
                  <Text type="secondary"> / {fmtN(d.so_luong_ke_hoach)} thùng</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Số khối (m³)">
                <Text strong>{d.so_khoi > 0 ? d.so_khoi.toFixed(3) : '—'}</Text>
              </Descriptions.Item>
            </Descriptions>
          )
        })()}
      </Drawer>
    </div>
  )
}
