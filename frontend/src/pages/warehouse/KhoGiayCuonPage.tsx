import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Select, Input, Typography, Tag, Space, Statistic, Row, Col, Card,
  Button, Badge, Tooltip,
} from 'antd'
import {
  SearchOutlined, WarningOutlined, DatabaseOutlined,
  ThunderboltOutlined, FormOutlined, ClockCircleOutlined, DownloadOutlined, PrinterOutlined,
} from '@ant-design/icons'
import { usePermission } from '../../hooks/usePermission'
import { exportExcelWithTemplate } from '../../utils/exportUtils'
import { useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import { warehouseApi, type TonKhoGiayRow, type GoodsReceipt } from '../../api/warehouse'
import apiClient from '../../api/client'
import { phapNhanApi } from '../../api/phap_nhan'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography

interface GroupedRow {
  key: number
  paper_material_id: number
  ma_chinh: string | null
  ten: string | null
  kho: number | null
  dinh_luong: number | null
  loai_giay: string | null
  ton_toi_thieu: number
  ton_tong: number
  so_cuon_tong: number
  gia_tri_tong: number
  is_low: boolean
  ten_nsx: string | null
  bien_dong: number | null
  ngay_nhap_gan_nhat: string | null
  details: TonKhoGiayRow[]
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  nhap_nhanh: { label: 'Nhập nhanh', color: 'orange' },
  nhap:       { label: 'Chờ duyệt',  color: 'blue'   },
  da_duyet:   { label: 'Đã duyệt',   color: 'green'  },
}

function formatKg(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' kg'
}
function formatVnd(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫'
}

async function openPrintByMaterial(materialId: number, warehouseId?: number) {
  try {
    const res = await apiClient.get<string>(
      warehouseApi.printGiayRollsByMaterial(materialId, warehouseId),
      { responseType: 'text' },
    )
    const blob = new Blob([res.data], { type: 'text/html; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    if (w) {
      w.onload = () => URL.revokeObjectURL(url)
    } else {
      URL.revokeObjectURL(url)
      // eslint-disable-next-line no-alert
      alert('Trình duyệt chặn cửa sổ in. Vui lòng cho phép popup.')
    }
  } catch {
    // eslint-disable-next-line no-alert
    alert('Không in được tem — kiểm tra kết nối server.')
  }
}

export default function KhoGiayCuonPage() {
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const canViewPrice = hasPermission('production.cost_analysis')
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [search, setSearch] = useState('')

  const { data: phapNhans = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 300_000,
  })

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['ton-kho-giay', phapNhanId, phanXuongId],
    queryFn: () =>
      warehouseApi.getTonKhoGiay({ phap_nhan_id: phapNhanId, phan_xuong_id: phanXuongId }).then(r => r.data),
    staleTime: 60_000,
  })

  // Phiếu chờ xử lý (nhập nhanh + chờ duyệt)
  const { data: pendingReceipts = [] } = useQuery({
    queryKey: ['goods-receipts-giay-pending', phapNhanId, phanXuongId],
    queryFn: () =>
      warehouseApi.listGoodsReceipts({
        loai_hang: 'giay',
        phap_nhan_id: phapNhanId,
        phan_xuong_id: phanXuongId,
      }).then(r => r.data.filter(gr => gr.trang_thai === 'nhap_nhanh' || gr.trang_thai === 'nhap')),
    staleTime: 30_000,
  })

  const filteredPhanXuongs = useMemo(
    () => phapNhanId ? phanXuongs.filter(px => px.phap_nhan_id === phapNhanId) : phanXuongs,
    [phanXuongs, phapNhanId],
  )

  const grouped = useMemo<GroupedRow[]>(() => {
    const q = search.trim().toLowerCase()
    const map = new Map<number, GroupedRow>()
    for (const r of rows) {
      if (q) {
        const hay = `${r.ma_chinh ?? ''} ${r.ten ?? ''}`.toLowerCase()
        if (!hay.includes(q)) continue
      }
      let g = map.get(r.paper_material_id)
      if (!g) {
        g = {
          key: r.paper_material_id,
          paper_material_id: r.paper_material_id,
          ma_chinh: r.ma_chinh,
          ten: r.ten,
          kho: r.kho,
          dinh_luong: r.dinh_luong,
          loai_giay: r.loai_giay ?? null,
          ton_toi_thieu: r.ton_toi_thieu,
          ton_tong: 0,
          so_cuon_tong: 0,
          gia_tri_tong: 0,
          is_low: false,
          ten_nsx: r.ten_nsx ?? null,
          bien_dong: r.bien_dong ?? null,
          ngay_nhap_gan_nhat: r.ngay_nhap_gan_nhat ?? null,
          details: [],
        }
        map.set(r.paper_material_id, g)
      }
      g.ton_tong += r.ton_luong
      g.so_cuon_tong += (r.so_cuon ?? 0)
      g.gia_tri_tong += r.gia_tri_ton
      g.details.push(r)
    }
    for (const g of map.values()) {
      g.is_low = g.ton_toi_thieu > 0 && g.ton_tong < g.ton_toi_thieu
    }
    return [...map.values()].sort((a, b) => (a.ma_chinh ?? '').localeCompare(b.ma_chinh ?? ''))
  }, [rows, search])

  const totalKg    = grouped.reduce((s, g) => s + g.ton_tong,    0)
  const totalValue = grouped.reduce((s, g) => s + g.gia_tri_tong, 0)
  const lowCount   = grouped.filter(g => g.is_low).length

  // Pending receipts table
  const pendingColumns: ColumnsType<GoodsReceipt> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 160,
      render: (v) => <Text code>{v}</Text>,
    },
    {
      title: 'Ngày nhập',
      dataIndex: 'ngay_nhap',
      width: 110,
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'ten_ncc',
      ellipsis: true,
    },
    {
      title: 'Kho',
      dataIndex: 'ten_kho',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v) => {
        const s = STATUS_LABEL[v] ?? { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          icon={<FormOutlined />}
          onClick={() => navigate('/warehouse/nhap-giay', { state: { openGrId: r.id } })}
        >
          Hoàn thiện
        </Button>
      ),
    },
  ]

  // Inventory summary table
  const summaryColumns: ColumnsType<GroupedRow> = [
    {
      title: 'Mã giấy',
      dataIndex: 'ma_chinh',
      width: 130,
      render: (v, r) => (
        <Space>
          {r.is_low && <WarningOutlined style={{ color: '#cf1322' }} title="Dưới mức tối thiểu" />}
          <strong>{v || '—'}</strong>
        </Space>
      ),
    },
    {
      title: 'Tên / mô tả',
      dataIndex: 'ten',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text>{v || '—'}</Text>
          {r.ten_nsx && <Text type="secondary" style={{ fontSize: 11 }}>{r.ten_nsx}</Text>}
        </Space>
      ),
    },
    {
      title: 'Khổ (cm)',
      dataIndex: 'kho',
      width: 90,
      align: 'right',
      render: (v) => (v != null ? v.toFixed(1) : '—'),
    },
    {
      title: 'ĐL (g/m²)',
      dataIndex: 'dinh_luong',
      width: 90,
      align: 'right',
      render: (v) => (v != null ? v : '—'),
    },
    {
      title: 'Tồn tối thiểu',
      dataIndex: 'ton_toi_thieu',
      width: 130,
      align: 'right',
      render: (v) => (v > 0 ? formatKg(v) : <span style={{ color: '#bbb' }}>—</span>),
    },
    {
      title: 'Tồn hiện tại',
      dataIndex: 'ton_tong',
      width: 140,
      align: 'right',
      sorter: (a: GroupedRow, b: GroupedRow) => a.ton_tong - b.ton_tong,
      render: (v, r) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
          <span style={{ color: r.is_low ? '#cf1322' : undefined, fontWeight: r.is_low ? 700 : undefined }}>
            {formatKg(v)}
          </span>
          {r.bien_dong != null && Math.abs(r.bien_dong) >= 1 && (
            <Text style={{ fontSize: 11, color: r.bien_dong > 0 ? '#1677ff' : '#ff4d4f' }}>
              {r.bien_dong > 0 ? '▲' : '▼'} {Math.abs(Math.round(r.bien_dong)).toLocaleString('vi-VN')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Số cuộn',
      dataIndex: 'so_cuon_tong',
      width: 90,
      align: 'right',
      render: (v) => <Tag color="blue">{v} cuộn</Tag>,
    },
    {
      title: 'Giá trị tồn',
      dataIndex: 'gia_tri_tong',
      width: 150,
      align: 'right',
      render: (v) => formatVnd(v),
    },
    {
      title: 'Ngày nhập gần nhất',
      dataIndex: 'ngay_nhap_gan_nhat',
      width: 130,
      align: 'center',
      render: (v) => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Số kho',
      width: 70,
      align: 'center',
      render: (_, r) => <Tag>{r.details.length}</Tag>,
    },
  ]

  const LOAI_GIAY_COLOR: Record<string, string> = {
    nau: 'brown', trang: 'default', vang: 'gold', xeo: 'cyan', khac: 'default',
  }
  const LOAI_GIAY_LABEL: Record<string, string> = {
    nau: 'Nâu', trang: 'Trắng', vang: 'Vàng', xeo: 'Xeo', khac: 'Khác',
  }

  const detailColumns: ColumnsType<TonKhoGiayRow> = [
    { title: 'Kho',         dataIndex: 'ten_kho',         width: 180 },
    { title: 'Phân xưởng',  dataIndex: 'ten_phan_xuong',  width: 150, render: v => v || '—' },
    {
      title: 'Loại giấy',
      dataIndex: 'loai_giay',
      width: 90,
      render: v => v
        ? <Tag color={LOAI_GIAY_COLOR[v] ?? 'default'}>{LOAI_GIAY_LABEL[v] ?? v}</Tag>
        : '—',
    },
    { title: 'Số cuộn', dataIndex: 'so_cuon', width: 90, align: 'right', render: v => <Tag color="blue">{v ?? 0} cuộn</Tag> },
    {
      title: 'Tồn (kg)',
      dataIndex: 'ton_luong',
      width: 120,
      align: 'right',
      render: (v, r) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
          <Text strong>{formatKg(v)}</Text>
          {r.bien_dong != null && Math.abs(r.bien_dong) >= 1 && (
            <Text style={{ fontSize: 11, color: r.bien_dong > 0 ? '#1677ff' : '#ff4d4f' }}>
              {r.bien_dong > 0 ? '▲' : '▼'} {Math.abs(Math.round(r.bien_dong)).toLocaleString('vi-VN')}
            </Text>
          )}
        </Space>
      ),
    },
    ...(canViewPrice ? [
      { title: 'Đơn giá BQ',  dataIndex: 'don_gia_binh_quan', width: 130, align: 'right' as const, render: (v: number) => v ? formatVnd(v) + '/kg' : '—' },
      { title: 'Giá trị tồn', dataIndex: 'gia_tri_ton',     width: 140, align: 'right' as const, render: (v: number) => formatVnd(v) },
    ] : []),
    {
      title: 'Ngày nhập gần nhất',
      dataIndex: 'ngay_nhap_gan_nhat',
      width: 130,
      align: 'center',
      render: v => v ? <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: '',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, r: TonKhoGiayRow) => (
        <Tooltip title={`In tem tất cả cuộn đang tồn — ${r.ten_kho}`}>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            style={{ color: '#722ed1', borderColor: '#722ed1' }}
            onClick={() => openPrintByMaterial(r.paper_material_id, r.warehouse_id)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          Kho Giấy cuộn
        </Title>
        <Space>
          <Tooltip title="Xuất danh sách tồn kho giấy">
            <Button
              icon={<DownloadOutlined />}
              onClick={() => exportExcelWithTemplate(
                'ton-kho-giay-cuon.xlsx',
                'Tồn kho',
                grouped,
                [
                  { key: 'ma_chinh',    label: 'Mã chính',          width: 14 },
                  { key: 'ten',         label: 'Tên giấy',           width: 28 },
                  { key: 'kho',         label: 'Khổ (mm)',           width: 12 },
                  { key: 'dinh_luong',  label: 'Định lượng (gsm)',   width: 16 },
                  { key: 'ton_tong',    label: 'Tồn (kg)',           width: 12 },
                  { key: 'so_cuon_tong',label: 'Số cuộn',            width: 10 },
                  { key: 'gia_tri_tong',label: 'Giá trị (đ)',        width: 16 },
                ],
              )}
            >
              Xuất Excel
            </Button>
          </Tooltip>
          <Tooltip title="Ghi nhận nhanh xe vào cổng (bảo vệ / thủ kho)">
            <Button
              icon={<ThunderboltOutlined />}
              disabled={!hasPermission('inventory.import')}
              onClick={() => navigate('/warehouse/nhap-giay', { state: { openQuick: true } })}
            >
              Nhập nhanh
            </Button>
          </Tooltip>
          <Tooltip title="KT nhập đầy đủ thông tin — tạo phiếu mới">
            <Button
              type="primary"
              icon={<FormOutlined />}
              disabled={!hasPermission('inventory.import')}
              onClick={() => navigate('/warehouse/nhap-giay')}
            >
              Nhập đầy đủ
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={6}>
          <Card size="small">
            <Statistic title="Tổng tồn kho" value={totalKg} suffix="kg" precision={0}
              valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small">
            <Statistic title="Giá trị tồn" value={totalValue} suffix="₫" precision={0}
              formatter={v => Number(v).toLocaleString('vi-VN')} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small">
            <Statistic title="Dưới mức tối thiểu" value={lowCount}
              valueStyle={{ color: lowCount > 0 ? '#cf1322' : '#52c41a' }}
              prefix={lowCount > 0 ? <WarningOutlined /> : undefined} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card
            size="small"
            style={{ cursor: pendingReceipts.length > 0 ? 'pointer' : undefined, borderColor: pendingReceipts.length > 0 ? '#faad14' : undefined }}
            onClick={() => pendingReceipts.length > 0 && navigate('/warehouse/nhap-giay')}
          >
            <Statistic
              title={<Space><ClockCircleOutlined />Phiếu chờ xử lý</Space>}
              value={pendingReceipts.length}
              valueStyle={{ color: pendingReceipts.length > 0 ? '#d46b08' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pending receipts panel */}
      {pendingReceipts.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16, borderColor: '#faad14' }}
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#d46b08' }} />
              <span style={{ color: '#d46b08', fontWeight: 600 }}>
                Phiếu chờ xử lý
              </span>
              <Badge count={pendingReceipts.length} color="orange" />
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                — KT bấm "Hoàn thiện" để điền thông tin &amp; duyệt → cập nhật tồn kho
              </Text>
            </Space>
          }
          extra={
            <Button size="small" onClick={() => navigate('/warehouse/nhap-giay')}>
              Xem tất cả →
            </Button>
          }
        >
          <Table<GoodsReceipt>
            dataSource={pendingReceipts}
            columns={pendingColumns}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </Card>
      )}

      {/* Filters */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Pháp nhân"
          style={{ width: 200 }}
          options={phapNhans.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
          value={phapNhanId}
          onChange={v => { setPhapNhanId(v); setPhanXuongId(undefined) }}
        />
        <Select
          allowClear
          placeholder="Phân xưởng"
          style={{ width: 200 }}
          disabled={filteredPhanXuongs.length === 0}
          options={filteredPhanXuongs.map(px => ({ value: px.id, label: px.ten_xuong }))}
          value={phanXuongId}
          onChange={setPhanXuongId}
        />
        <Input
          allowClear
          placeholder="Tìm mã, tên giấy..."
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </Space>

      {/* Inventory table */}
      <Table<GroupedRow>
        loading={isFetching}
        dataSource={grouped}
        columns={summaryColumns}
        rowKey="paper_material_id"
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
        rowClassName={r => r.is_low ? 'row-low-stock' : ''}
        expandable={{
          expandedRowRender: r => (
            <Table<TonKhoGiayRow>
              dataSource={r.details}
              columns={detailColumns}
              rowKey="warehouse_id"
              size="small"
              pagination={false}
              style={{ margin: '0 32px 8px' }}
            />
          ),
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
              <Table.Summary.Cell index={0} colSpan={5}>
                Tổng cộng ({grouped.length} loại giấy)
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">{formatKg(totalKg)}</Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">{formatVnd(totalValue)}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <style>{`
        .row-low-stock td { background: #fff2f0 !important; }
        .row-low-stock:hover td { background: #ffe7e3 !important; }
      `}</style>
    </div>
  )
}
