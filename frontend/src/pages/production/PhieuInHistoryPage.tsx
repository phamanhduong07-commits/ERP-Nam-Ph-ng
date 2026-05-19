import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Row,
  Select, Space, Statistic, Table, Tabs, Tag, Typography,
} from 'antd'
import { BarChartOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { cd2Api, MayIn, MayScan, PhieuIn, ScanLog, TRANG_THAI_COLORS, TRANG_THAI_LABELS } from '../../api/cd2'
import CD2WorkshopSelector from '../../components/CD2WorkshopSelector'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import { exportToExcel } from '../../utils/exportUtils'

const { Title } = Typography
const { RangePicker } = DatePicker

// ── Shared date filter helper ─────────────────────────────────────────────────

function inRange(dateStr: string, range: [Dayjs, Dayjs] | null): boolean {
  if (!range) return true
  const d = dayjs(dateStr)
  return d.isAfter(range[0].startOf('day').subtract(1, 'ms')) &&
    d.isBefore(range[1].endOf('day').add(1, 'ms'))
}

// ── Tab 1: Lịch sử in ────────────────────────────────────────────────────────

function TabLichSuIn() {
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [mayInId, setMayInId] = useState<number | null>(null)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  const { data: mayIns = [] } = useQuery<MayIn[]>({
    queryKey: ['may-in-list'],
    queryFn: () => cd2Api.listMayIn().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const days = dateRange ? Math.max(1, dateRange[1].diff(dateRange[0], 'day') + 1) : 30

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['cd2-history-phieu-in', days, search, trangThai, phanXuongId, mayInId],
    queryFn: () =>
      cd2Api.getHistoryPhieuIn({
        days,
        search: search.trim() || undefined,
        trang_thai: trangThai ?? undefined,
        phan_xuong_id: phanXuongId,
        may_in_id: mayInId ?? undefined,
      }).then(r => r.data),
  })

  const filtered = (rows as PhieuIn[]).filter(r => inRange(r.created_at, dateRange))
  const totalPhoi = filtered.reduce((s, r) => s + (r.so_luong_phoi ?? 0), 0)
  const totalOk   = filtered.reduce((s, r) => s + (r.so_luong_in_ok ?? 0), 0)
  const totalLoi  = filtered.reduce((s, r) => s + (r.so_luong_loi ?? 0), 0)

  const handleExport = () => {
    exportToExcel(`lich-su-in-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Lịch sử in',
      headers: ['Ngày tạo', 'LSX', 'Số phiếu', 'Trạng thái', 'Tên hàng', 'Mã KH', 'SL phôi', 'Ngày in', 'SL in OK', 'SL lỗi', 'Ca', 'Ghi chú'],
      rows: filtered.map(r => [
        dayjs(r.created_at).format('DD/MM/YYYY'),
        r.so_lsx ?? '',
        r.so_phieu,
        TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
        r.ten_hang ?? '',
        r.ma_kh ?? '',
        r.so_luong_phoi ?? '',
        r.ngay_in ? dayjs(r.ngay_in).format('DD/MM/YYYY') : '',
        r.so_luong_in_ok ?? '',
        r.so_luong_loi ?? '',
        r.ca ?? '',
        r.ghi_chu ?? '',
      ]),
      colWidths: [12, 14, 14, 14, 30, 10, 10, 12, 10, 10, 8, 25],
    }])
  }

  const columns = [
    { title: 'Ngày tạo', dataIndex: 'created_at', width: 95, render: (v: string) => dayjs(v).format('DD/MM/YY'), sorter: (a: PhieuIn, b: PhieuIn) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(), defaultSortOrder: 'descend' as const },
    { title: 'LSX', dataIndex: 'so_lsx', width: 130, render: (v: string, r: PhieuIn) => v || r.so_phieu },
    { title: 'Phiếu', dataIndex: 'so_phieu', width: 120 },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 115, render: (v: string) => <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] ?? v}</Tag> },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'KH', dataIndex: 'ma_kh', width: 80 },
    { title: 'SL phôi', dataIndex: 'so_luong_phoi', width: 90, align: 'right' as const, render: (v: number | null) => v != null ? v.toLocaleString('vi-VN') : '—' },
    { title: 'Ngày in', dataIndex: 'ngay_in', width: 90, render: (v: string | null) => v ? dayjs(v).format('DD/MM/YY') : '—' },
    { title: 'SL in OK', dataIndex: 'so_luong_in_ok', width: 90, align: 'right' as const, render: (v: number | null) => v != null ? <span style={{ color: '#52c41a' }}>{v.toLocaleString('vi-VN')}</span> : '—' },
    { title: 'SL lỗi', dataIndex: 'so_luong_loi', width: 80, align: 'right' as const, render: (v: number | null) => v != null && v > 0 ? <span style={{ color: '#ff4d4f' }}>{v.toLocaleString('vi-VN')}</span> : (v != null ? '0' : '—') },
    { title: 'Ca', dataIndex: 'ca', width: 55, render: (v: string | null) => v ?? '—' },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true, render: (v: string | null) => v ?? '' },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 220 }} placeholder="Tìm LSX, số phiếu, tên hàng..." allowClear value={search} onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)} />
          <Select style={{ width: 160 }} placeholder="Tất cả trạng thái" allowClear value={trangThai} onChange={v => setTrangThai(v ?? null)} options={Object.entries(TRANG_THAI_LABELS).map(([value, label]) => ({ value, label }))} />
          <Select style={{ width: 160 }} placeholder="Tất cả máy in" allowClear value={mayInId} onChange={v => setMayInId(v ?? null)} options={mayIns.map(m => ({ value: m.id, label: m.ten_may }))} />
          <RangePicker value={dateRange} onChange={v => setDateRange(v as [Dayjs, Dayjs] | null)} format="DD/MM/YYYY" allowClear />
          <CD2WorkshopSelector value={phanXuongId} onChange={setPhanXuongId} phanXuongList={phanXuongList} />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel</Button>
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={8} sm={6}><Card size="small"><Statistic title="Tổng phiếu" value={filtered.length} /></Card></Col>
        <Col xs={8} sm={6}><Card size="small"><Statistic title="Tổng SL phôi" value={totalPhoi} formatter={v => Number(v).toLocaleString('vi-VN')} /></Card></Col>
        <Col xs={8} sm={6}><Card size="small"><Statistic title="Tổng in OK" value={totalOk} valueStyle={{ color: '#52c41a' }} formatter={v => Number(v).toLocaleString('vi-VN')} /></Card></Col>
        <Col xs={8} sm={6}><Card size="small"><Statistic title="Tổng lỗi" value={totalLoi} valueStyle={{ color: '#ff4d4f' }} formatter={v => Number(v).toLocaleString('vi-VN')} /></Card></Col>
      </Row>

      <Card>
        <Table dataSource={filtered} columns={columns} rowKey="id" size="small" loading={isLoading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} phiếu` }}
          scroll={{ x: 1100 }} />
      </Card>
    </>
  )
}

// ── Tab 2: Lịch sử TP ────────────────────────────────────────────────────────

function TabLichSuTP() {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  const days = dateRange ? Math.max(1, dateRange[1].diff(dateRange[0], 'day') + 1) : 30

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['cd2-history-tp', days, search, phanXuongId],
    queryFn: () =>
      cd2Api.getHistoryPhieuIn({
        days,
        search: search.trim() || undefined,
        phan_xuong_id: phanXuongId,
      }).then(r => r.data),
  })

  // Chỉ lấy phiếu đã có dữ liệu thành phẩm
  const filtered = (rows as PhieuIn[]).filter(r =>
    r.so_luong_sau_in_ok != null && inRange(r.created_at, dateRange)
  )

  const totalTP  = filtered.reduce((s, r) => s + (r.so_luong_sau_in_ok ?? 0), 0)
  const totalLoi = filtered.reduce((s, r) => s + (r.so_luong_sau_in_loi ?? 0), 0)

  const handleExport = () => {
    exportToExcel(`lich-su-tp-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Lịch sử TP',
      headers: ['LSX', 'Số phiếu', 'Tên hàng', 'Mã KH', 'Ngày TP', 'Ca', 'SL TP OK', 'SL lỗi', 'Ghi chú'],
      rows: filtered.map(r => [
        r.so_lsx ?? '',
        r.so_phieu,
        r.ten_hang ?? '',
        r.ma_kh ?? '',
        r.ngay_sau_in ? dayjs(r.ngay_sau_in).format('DD/MM/YYYY') : '',
        r.ca_sau_in ?? '',
        r.so_luong_sau_in_ok ?? '',
        r.so_luong_sau_in_loi ?? '',
        r.ghi_chu_sau_in ?? '',
      ]),
      colWidths: [14, 14, 30, 10, 12, 8, 10, 10, 25],
    }])
  }

  const columns = [
    { title: 'Ngày TP', dataIndex: 'ngay_sau_in', width: 95, render: (v: string | null) => v ? dayjs(v).format('DD/MM/YY') : '—', sorter: (a: PhieuIn, b: PhieuIn) => dayjs(a.ngay_sau_in ?? 0).valueOf() - dayjs(b.ngay_sau_in ?? 0).valueOf(), defaultSortOrder: 'descend' as const },
    { title: 'LSX', dataIndex: 'so_lsx', width: 130, render: (v: string, r: PhieuIn) => v || r.so_phieu },
    { title: 'Phiếu', dataIndex: 'so_phieu', width: 120 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'KH', dataIndex: 'ma_kh', width: 80 },
    { title: 'Ca', dataIndex: 'ca_sau_in', width: 55, render: (v: string | null) => v ?? '—' },
    { title: 'SL TP OK', dataIndex: 'so_luong_sau_in_ok', width: 100, align: 'right' as const, render: (v: number | null) => v != null ? <span style={{ color: '#722ed1', fontWeight: 600 }}>{v.toLocaleString('vi-VN')}</span> : '—' },
    { title: 'SL lỗi', dataIndex: 'so_luong_sau_in_loi', width: 80, align: 'right' as const, render: (v: number | null) => v != null && v > 0 ? <span style={{ color: '#ff4d4f' }}>{v.toLocaleString('vi-VN')}</span> : (v != null ? '0' : '—') },
    { title: 'Ghi chú', dataIndex: 'ghi_chu_sau_in', ellipsis: true, render: (v: string | null) => v ?? '' },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 220 }} placeholder="Tìm LSX, số phiếu, tên hàng..." allowClear value={search} onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)} />
          <RangePicker value={dateRange} onChange={v => setDateRange(v as [Dayjs, Dayjs] | null)} format="DD/MM/YYYY" allowClear />
          <CD2WorkshopSelector value={phanXuongId} onChange={setPhanXuongId} phanXuongList={phanXuongList} />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel</Button>
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={8} sm={8}><Card size="small"><Statistic title="Tổng phiếu TP" value={filtered.length} /></Card></Col>
        <Col xs={8} sm={8}><Card size="small"><Statistic title="Tổng SL TP OK" value={totalTP} valueStyle={{ color: '#722ed1' }} formatter={v => Number(v).toLocaleString('vi-VN')} /></Card></Col>
        <Col xs={8} sm={8}><Card size="small"><Statistic title="Tổng lỗi" value={totalLoi} valueStyle={{ color: '#ff4d4f' }} formatter={v => Number(v).toLocaleString('vi-VN')} /></Card></Col>
      </Row>

      <Card>
        <Table dataSource={filtered} columns={columns} rowKey="id" size="small" loading={isLoading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} phiếu` }}
          scroll={{ x: 900 }} />
      </Card>
    </>
  )
}

// ── Tab Scan (dùng chung) ─────────────────────────────────────────────────────

function TabScanByLoai({ loai, label }: { loai: 'can_mang' | 'xa', label: string }) {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [mayScanId, setMayScanId] = useState<number | null>(null)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  const { data: allMay = [] } = useQuery<MayScan[]>({
    queryKey: ['may-scan-list'],
    queryFn: () => cd2Api.listMayScan().then(r => Array.isArray(r.data) ? r.data : []),
    staleTime: 5 * 60 * 1000,
  })
  const mayScanList = allMay.filter(m => m.loai === loai)

  const days = dateRange ? Math.max(1, dateRange[1].diff(dateRange[0], 'day') + 1) : 30

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['cd2-scan-history', loai, days, mayScanId, phanXuongId],
    queryFn: () =>
      cd2Api.getScanHistory({
        days,
        may_scan_id: mayScanId ?? undefined,
        phan_xuong_id: phanXuongId,
      }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const filtered = (rows as ScanLog[]).filter(r => {
    const matchLoai = r.loai_may === loai
    const matchSearch = !search.trim() ||
      r.so_lsx.toLowerCase().includes(search.toLowerCase()) ||
      (r.ten_hang ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.nguoi_sx ?? '').toLowerCase().includes(search.toLowerCase())
    return matchLoai && matchSearch && inRange(r.created_at, dateRange)
  })

  const totalSL   = filtered.reduce((s, r) => s + (r.so_luong_tp ?? 0), 0)
  const totalTien = filtered.reduce((s, r) => s + (r.tien_luong ?? 0), 0)

  const handleExport = () => {
    exportToExcel(`lich-su-${loai}-${dayjs().format('YYYYMMDD')}`, [{
      name: label,
      headers: ['Ngày giờ', 'LSX', 'Tên hàng', 'Máy scan', 'Người SX', 'SL TP', 'Khổ (mm)', 'Dài (mm)', 'Diện tích', 'Đơn giá', 'Tiền lương'],
      rows: filtered.map(r => [
        dayjs(r.created_at).format('DD/MM/YYYY HH:mm'),
        r.so_lsx,
        r.ten_hang ?? '',
        r.ten_may ?? allMay.find(m => m.id === r.may_scan_id)?.ten_may ?? r.may_scan_id,
        r.nguoi_sx ?? '',
        r.so_luong_tp,
        r.kho_tt ?? '',
        r.dai ?? '',
        r.dien_tich ?? '',
        r.don_gia ?? '',
        r.tien_luong ?? '',
      ]),
      colWidths: [16, 14, 30, 14, 14, 10, 10, 10, 12, 12, 12],
    }])
  }

  const columns = [
    { title: 'Ngày giờ', dataIndex: 'created_at', width: 130, render: (v: string) => dayjs(v).format('DD/MM HH:mm'), sorter: (a: ScanLog, b: ScanLog) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(), defaultSortOrder: 'descend' as const },
    { title: 'LSX', dataIndex: 'so_lsx', width: 130 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true, render: (v: string | undefined) => v ?? '—' },
    { title: 'Máy scan', dataIndex: 'may_scan_id', width: 120, render: (_: number, row: ScanLog) => row.ten_may ?? allMay.find(m => m.id === row.may_scan_id)?.ten_may ?? `Máy #${row.may_scan_id}` },
    { title: 'Người SX', dataIndex: 'nguoi_sx', width: 120, render: (v: string | undefined) => v ?? '—' },
    { title: 'SL TP', dataIndex: 'so_luong_tp', width: 90, align: 'right' as const, render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 600 }}>{v.toLocaleString('vi-VN')}</span> },
    { title: 'Khổ (mm)', dataIndex: 'kho_tt', width: 90, align: 'right' as const, render: (v: number | undefined) => v ?? '—' },
    { title: 'Dài (mm)', dataIndex: 'dai', width: 90, align: 'right' as const, render: (v: number | undefined) => v ?? '—' },
    { title: 'Diện tích', dataIndex: 'dien_tich', width: 90, align: 'right' as const, render: (v: number | undefined) => v != null ? v.toFixed(4) : '—' },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 90, align: 'right' as const, render: (v: number | undefined) => v != null ? v.toLocaleString('vi-VN') : '—' },
    { title: 'Tiền lương', dataIndex: 'tien_luong', width: 110, align: 'right' as const, render: (v: number | undefined) => v != null ? <span style={{ color: '#52c41a' }}>{v.toLocaleString('vi-VN')}</span> : '—' },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input.Search style={{ width: 220 }} placeholder="Tìm LSX, tên hàng, người SX..." allowClear value={search} onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)} />
          <Select style={{ width: 160 }} placeholder="Tất cả máy" allowClear value={mayScanId} onChange={v => setMayScanId(v ?? null)} options={mayScanList.map(m => ({ value: m.id, label: m.ten_may }))} />
          <RangePicker value={dateRange} onChange={v => setDateRange(v as [Dayjs, Dayjs] | null)} format="DD/MM/YYYY" allowClear />
          <CD2WorkshopSelector value={phanXuongId} onChange={setPhanXuongId} phanXuongList={phanXuongList} />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel</Button>
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={8} sm={8}><Card size="small"><Statistic title="Tổng lượt scan" value={filtered.length} /></Card></Col>
        <Col xs={8} sm={8}><Card size="small"><Statistic title="Tổng SL TP" value={totalSL} valueStyle={{ color: '#1677ff' }} formatter={v => Number(v).toLocaleString('vi-VN')} /></Card></Col>
        <Col xs={8} sm={8}><Card size="small"><Statistic title="Tổng tiền lương" value={totalTien} valueStyle={{ color: '#52c41a' }} formatter={v => Number(v).toLocaleString('vi-VN')} suffix="đ" /></Card></Col>
      </Row>

      <Card>
        <Table dataSource={filtered} columns={columns} rowKey="id" size="small" loading={isLoading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} lượt scan` }}
          scroll={{ x: 1100 }} />
      </Card>
    </>
  )
}

// ── Page chính ────────────────────────────────────────────────────────────────

export default function PhieuInHistoryPage() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <BarChartOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Thống kê sản lượng</Title>
          </Space>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="in"
        type="card"
        items={[
          { key: 'in',       label: '🖨️ Lịch sử in',     children: <TabLichSuIn /> },
          { key: 'tp',       label: '📦 Lịch sử TP',      children: <TabLichSuTP /> },
          { key: 'can_mang', label: '🎞️ Lịch sử cán màng', children: <TabScanByLoai loai="can_mang" label="Lịch sử cán màng" /> },
          { key: 'xa',       label: '✂️ Lịch sử xã',      children: <TabScanByLoai loai="xa" label="Lịch sử xã" /> },
        ]}
      />
    </div>
  )
}
