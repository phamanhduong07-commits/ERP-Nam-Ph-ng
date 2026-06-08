import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Input, Row, Select, Space, Table, Tag, Tooltip, Typography, message,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { warehousesApi, type Warehouse } from '../../api/warehouses'
import { warehouseApi, type GiaoDich } from '../../api/warehouse'
import { phapNhanApi } from '../../api/phap_nhan'
import { smartExportExcel, smartPrintPdf, buildHtmlTable } from '../../utils/exportUtils'
import { usePermission } from '../../hooks/usePermission'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const LOAI_GD_LABEL: Record<string, string> = {
  NHAP_MUA:        'Nhập mua',
  XUAT_SX:         'Xuất SX',
  NHAP_SX:         'Nhập SX',
  XUAT_BAN:        'Xuất bán',
  CHUYEN_KHO_XUAT: 'Chuyển kho (xuất)',
  CHUYEN_KHO_NHAP: 'Chuyển kho (nhập)',
  DIEU_CHINH_TANG: 'Điều chỉnh tăng',
  DIEU_CHINH_GIAM: 'Điều chỉnh giảm',
  XOA_NHAP_MUA:    '(Hủy nhập mua)',
  XOA_XUAT_SX:     '(Hủy xuất SX)',
  XOA_NHAP_SX:     '(Hủy nhập SX)',
  XOA_XUAT_BAN:    '(Hủy xuất bán)',
  XOA_CHUYEN_XUAT: '(Hủy chuyển xuất)',
  XOA_CHUYEN_NHAP: '(Hủy chuyển nhập)',
}

const NHAP_TYPES = new Set(['NHAP_MUA', 'NHAP_SX', 'CHUYEN_KHO_NHAP', 'DIEU_CHINH_TANG'])
const XUAT_TYPES = new Set(['XUAT_SX', 'XUAT_BAN', 'CHUYEN_KHO_XUAT', 'DIEU_CHINH_GIAM'])

function fmtQ(v: number) {
  return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function fmtVND(v: number) {
  return Number(v).toLocaleString('vi-VN')
}

export default function InventoryCardPage() {
  const today = dayjs()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today.startOf('month'), today])
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [warehouseId, setWarehouseId] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const { hasPermission } = usePermission()
  const canView = hasPermission('inventory.view')

  const { data: whs } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const { data: phapNhans = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 300_000,
  })

  const phanXuongsByPn = phapNhanId ? phanXuongs.filter(px => px.phap_nhan_id === phapNhanId) : phanXuongs
  const allowedPxIds = new Set(phanXuongsByPn.map(px => px.id))
  const filteredWarehouses = (whs ?? []).filter(w =>
    (!phapNhanId || (w.phan_xuong_id !== null && allowedPxIds.has(w.phan_xuong_id))) &&
    (!phanXuongId || w.phan_xuong_id === phanXuongId)
  )
  const selectedWarehouse = warehouseId ? whs?.find(w => w.id === warehouseId) : undefined
  const selectedPhapNhanId = phapNhanId || (selectedWarehouse?.phan_xuong_id
    ? phanXuongs.find(px => px.id === selectedWarehouse.phan_xuong_id)?.phap_nhan_id
    : null)

  // Tự động fetch khi bộ lọc (khoảng ngày, pháp nhân, xưởng, kho) đổi:
  // React Query refetch khi queryKey thay đổi. Không cần bấm nút thủ công.
  const { data: rows = [], isFetching, isError, isFetched, refetch } = useQuery<GiaoDich[]>({
    queryKey: ['giao-dich', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), phapNhanId, phanXuongId, warehouseId],
    queryFn: () =>
      warehouseApi.getGiaoDich({
        tu_ngay: range[0].format('YYYY-MM-DD'),
        den_ngay: range[1].format('YYYY-MM-DD'),
        warehouse_id: warehouseId,
        phan_xuong_id: phanXuongId,
        phap_nhan_id: phapNhanId ?? undefined,
        limit: 1000,
      }).then(r => r.data),
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      r.ten_hang?.toLowerCase().includes(q) || r.ma_hang?.toLowerCase().includes(q),
    )
  }, [rows, search])

  const handleExcel = () => {
    if (!filtered.length) {
      message.warning('Không có dữ liệu để xuất Excel')
      return
    }
    if (!selectedPhapNhanId) {
      message.error('Chỉ xuất Excel thẻ kho khi đã chọn một kho thuộc pháp nhân.')
      return
    }
    const defaultConfig = [
      { key: 'ngay', label: 'Ngày', width: 12 },
      { key: 'ma_hang', label: 'Mã hàng', width: 14 },
      { key: 'ten_hang', label: 'Tên hàng', width: 28 },
      { key: 'ten_kho', label: 'Kho', width: 14 },
      { key: 'loai_gd_lbl', label: 'Loại GD', width: 18 },
      { key: 'sl_nhap', label: 'SL nhập', width: 12 },
      { key: 'sl_xuat', label: 'SL xuất', width: 12 },
      { key: 'ton_sau', label: 'Tồn kho', width: 12 },
      { key: 'don_gia', label: 'Đơn giá', width: 14 },
      { key: 'gia_tri', label: 'Giá trị', width: 16 },
      { key: 'ghi_chu', label: 'Ghi chú', width: 20 },
    ]

    const exportData = filtered.map(r => ({
      ...r,
      ngay: r.ngay_giao_dich ? dayjs(r.ngay_giao_dich).format('DD/MM/YYYY') : '',
      loai_gd_lbl: LOAI_GD_LABEL[r.loai_giao_dich] ?? r.loai_giao_dich,
      sl_nhap: NHAP_TYPES.has(r.loai_giao_dich) ? r.so_luong : '',
      sl_xuat: XUAT_TYPES.has(r.loai_giao_dich) ? r.so_luong : '',
      ton_sau: r.ton_sau_giao_dich,
      ghi_chu: r.ghi_chu ?? '',
    }))

    smartExportExcel('STOCK_CARD', exportData, defaultConfig, `the_kho_${range[0].format('YYYYMMDD')}_${range[1].format('YYYYMMDD')}`, selectedPhapNhanId)
  }

  const handlePrint = () => {
    if (!filtered.length) {
      message.warning('Không có dữ liệu để in')
      return
    }
    if (!selectedPhapNhanId) {
      message.error('Chỉ in thẻ kho khi đã chọn một kho thuộc pháp nhân.')
      return
    }
    const cols = [
      { header: 'Ngày', key: 'ngay' }, 
      { header: 'Mã hàng', key: 'ma_hang' }, 
      { header: 'Tên hàng', key: 'ten_hang' }, 
      { header: 'Kho', key: 'ten_kho' },
      { header: 'Loại GD', key: 'loai_gd' }, 
      { header: 'Nhập', key: 'nhap', align: 'right' as const }, 
      { header: 'Xuất', key: 'xuat', align: 'right' as const }, 
      { header: 'Tồn kho', key: 'ton', align: 'right' as const },
    ]

    const itemRows = filtered.map(r => ({
      ngay: r.ngay_giao_dich ? dayjs(r.ngay_giao_dich).format('DD/MM/YYYY') : '',
      ma_hang: r.ma_hang,
      ten_hang: r.ten_hang,
      ten_kho: r.ten_kho,
      loai_gd: LOAI_GD_LABEL[r.loai_giao_dich] ?? r.loai_giao_dich,
      nhap: NHAP_TYPES.has(r.loai_giao_dich) ? fmtQ(r.so_luong) : '',
      xuat: XUAT_TYPES.has(r.loai_giao_dich) ? fmtQ(r.so_luong) : '',
      ton: fmtQ(r.ton_sau_giao_dich),
    }))

    const table = buildHtmlTable(
      cols.map(c => ({ header: c.header, align: c.align })), 
      itemRows.map(row => cols.map(c => (row as Record<string, string | number>)[c.key])) as (string | number | null | undefined)[][]
    )

    const printData = {
      subtitle: 'THẺ KHO / LỊCH SỬ NHẬP XUẤT TỒN',
      document_date: `${range[0].format('DD/MM/YYYY')} - ${range[1].format('DD/MM/YYYY')}`,
      document_number: `${filtered.length} giao dịch`,
      body_html: table,
      footer_html: `
        <div style="display: flex; justify-content: flex-end; gap: 40px; margin-top: 15px; font-weight: bold;">
          <div>Tổng nhập: ${fmtQ(totalNhap)}</div>
          <div>Tổng xuất: ${fmtQ(totalXuat)}</div>
        </div>
      `
    }

    smartPrintPdf('STOCK_CARD', printData, selectedPhapNhanId)
  }

  const columns: ColumnsType<GiaoDich> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay_giao_dich',
      width: 100,
      sorter: (a, b) => {
        const ta = a.ngay_giao_dich ? dayjs(a.ngay_giao_dich).valueOf() : 0
        const tb = b.ngay_giao_dich ? dayjs(b.ngay_giao_dich).valueOf() : 0
        return ta - tb
      },
      defaultSortOrder: 'descend',
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 120, ellipsis: true },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'Kho', dataIndex: 'ten_kho', width: 120, ellipsis: true },
    {
      title: 'Loại GD',
      dataIndex: 'loai_giao_dich',
      width: 160,
      render: v => {
        const label = LOAI_GD_LABEL[v] ?? v
        const isHuy = v?.startsWith('XOA_')
        const isNhap = NHAP_TYPES.has(v)
        return <Tag color={isHuy ? 'default' : isNhap ? 'blue' : 'volcano'} style={{ fontSize: 11 }}>{label}</Tag>
      },
    },
    {
      title: 'SL nhập',
      width: 100,
      align: 'right',
      sorter: (a, b) =>
        (NHAP_TYPES.has(a.loai_giao_dich) ? a.so_luong : 0) -
        (NHAP_TYPES.has(b.loai_giao_dich) ? b.so_luong : 0),
      render: (_, r) => NHAP_TYPES.has(r.loai_giao_dich) ? (
        <Text style={{ color: '#1b168e' }}>{fmtQ(r.so_luong)}</Text>
      ) : '',
    },
    {
      title: 'SL xuất',
      width: 100,
      align: 'right',
      sorter: (a, b) =>
        (XUAT_TYPES.has(a.loai_giao_dich) ? a.so_luong : 0) -
        (XUAT_TYPES.has(b.loai_giao_dich) ? b.so_luong : 0),
      render: (_, r) => XUAT_TYPES.has(r.loai_giao_dich) ? (
        <Text type="danger">{fmtQ(r.so_luong)}</Text>
      ) : '',
    },
    {
      title: 'Tồn kho',
      dataIndex: 'ton_sau_giao_dich',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.ton_sau_giao_dich - b.ton_sau_giao_dich,
      render: v => <Text strong>{fmtQ(v)}</Text>,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 120,
      align: 'right',
      render: v => Number(v) > 0 ? fmtVND(v) : '',
    },
    {
      title: 'Giá trị',
      dataIndex: 'gia_tri',
      width: 130,
      align: 'right',
      render: v => Number(v) > 0 ? fmtVND(v) : '',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: v => v ?? '',
    },
  ]

  const totalNhap = filtered.filter(r => NHAP_TYPES.has(r.loai_giao_dich)).reduce((s, r) => s + r.so_luong, 0)
  const totalXuat = filtered.filter(r => XUAT_TYPES.has(r.loai_giao_dich)).reduce((s, r) => s + r.so_luong, 0)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Thẻ kho / Lịch sử nhập xuất tồn</Title>
        <Space>
          <Tooltip title={canView ? undefined : 'Bạn không có quyền xem/xuất tồn kho'}>
            <Button icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!canView || !filtered.length}>Excel</Button>
          </Tooltip>
          <Tooltip title={canView ? undefined : 'Bạn không có quyền xem/xuất tồn kho'}>
            <Button icon={<FilePdfOutlined />} onClick={handlePrint} disabled={!canView || !filtered.length}>In PDF</Button>
          </Tooltip>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={range}
            onChange={v => v && setRange([v[0]!, v[1]!])}
          />
          <Select
            style={{ width: 190 }}
            placeholder="Tat ca phap nhan"
            allowClear
            value={phapNhanId}
            onChange={v => { setPhapNhanId(v); setPhanXuongId(undefined); setWarehouseId(undefined) }}
            options={phapNhans.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
          />
          <Select
            style={{ width: 180 }}
            placeholder="Tat ca xuong"
            allowClear
            value={phanXuongId}
            onChange={v => { setPhanXuongId(v); setWarehouseId(undefined) }}
            options={phanXuongsByPn.map(px => ({ value: px.id, label: px.ten_xuong }))}
          />
          <Select
            style={{ width: 200 }}
            placeholder="Tất cả kho"
            allowClear
            value={warehouseId}
            onChange={v => setWarehouseId(v)}
            options={filteredWarehouses.map((w: Warehouse) => ({ value: w.id, label: `${w.ma_kho} - ${w.ten_kho}` }))}
          />
          <Input
            style={{ width: 220 }}
            placeholder="Tìm mã/tên hàng..."
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={isFetching} onClick={() => refetch()}>
            Làm mới
          </Button>
        </Space>
      </Card>

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Không tải được dữ liệu"
          description="Không thể tải lịch sử nhập xuất tồn. Kiểm tra kết nối server rồi thử lại."
          action={<Button size="small" danger onClick={() => refetch()}>Thử lại</Button>}
        />
      )}

      {isFetched && !isError && (
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: '#888' }}>Tổng nhập kỳ</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1b168e' }}>{fmtQ(totalNhap)}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: '#888' }}>Tổng xuất kỳ</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#cf1322' }}>{fmtQ(totalXuat)}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: '#888' }}>Số giao dịch</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{filtered.length}</div>
            </Card>
          </Col>
        </Row>
      )}

      {!isError && (
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={filtered}
          loading={isFetching}
          pagination={{ pageSize: 50, showTotal: t => `${t} giao dịch` }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: <EmptyState size="small" preset={isFetched ? "search" : "default"} /> }}
        />
      )}
    </div>
  )
}
