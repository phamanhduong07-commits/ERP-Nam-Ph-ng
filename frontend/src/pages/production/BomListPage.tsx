import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { BomCalculatorPanelProps } from './BomCalculatorPanel'
import {
  Badge, Button, Card, Drawer, Input, Select, Space, Table, Tabs, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalculatorOutlined, FundOutlined, SearchOutlined, FileExcelOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { bomApi, vnd } from '../../api/bom'
import type { BomSummaryItem, PendingBomItem } from '../../api/bom'
import BomCalculatorPanel from './BomCalculatorPanel'
import ImportExcelDialog from '../../components/ImportExcelDialog'
import { UploadOutlined } from '@ant-design/icons'
import { exportToExcel, printToPdf, fmtVND, buildHtmlTable } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"
import { usePermission } from '../../hooks/usePermission'

const { Text } = Typography

const TRANG_THAI_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Nháp',     color: 'processing' },
  confirmed: { label: 'Đã duyệt', color: 'success'    },
}

export default function BomListPage() {
  const { hasPermission } = usePermission()
  const canViewPrice = hasPermission('production.cost_analysis')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'has_bom' | 'pending'>('has_bom')
  const [search, setSearch] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [editingId, setEditingId] = useState<number | null>(null)       // BOM id
  const [editingPoiId, setEditingPoiId] = useState<number | null>(null) // production_order_item_id
  const [editingInitial, setEditingInitial] = useState<BomCalculatorPanelProps['initialValues'] | null>(null)
  const [importVisible, setImportVisible] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bom-summary', filterTrangThai],
    queryFn: () => bomApi.listSummary({ trang_thai: filterTrangThai }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['bom-pending', search],
    queryFn: () => bomApi.listPending({ search: search || undefined }).then(r => r.data),
    staleTime: 30_000,
    enabled: activeTab === 'pending',
  })

  // Client-side search filter (has_bom tab)
  const rows = (data ?? []).filter(row => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (row.ten_hang ?? '').toLowerCase().includes(s) ||
      (row.so_lenh ?? '').toLowerCase().includes(s) ||
      (row.ten_khach_hang ?? '').toLowerCase().includes(s) ||
      (row.ma_khach_hang ?? '').toLowerCase().includes(s)
    )
  })

  const pendingRows = pendingData ?? []

  const openEditor = (row: BomSummaryItem) => {
    setEditingId(row.id)
    setEditingPoiId(row.production_order_item_id)
    setEditingInitial(null)
  }

  const openNewBom = (pending: PendingBomItem) => {
    setEditingId(null)
    setEditingPoiId(pending.poi_id)
    setEditingInitial({
      loai_thung: pending.loai_thung ?? undefined,
      dai: pending.dai ?? undefined,
      rong: pending.rong ?? undefined,
      cao: pending.cao ?? undefined,
      so_lop: pending.so_lop ?? undefined,
      to_hop_song: pending.to_hop_song ?? undefined,
      so_luong: Number(pending.so_luong_ke_hoach),
    })
  }

  const closeEditor = () => {
    setEditingId(null)
    setEditingPoiId(null)
    setEditingInitial(null)
  }

  const handleExportExcel = () => {
    exportToExcel(`DinhMucBOM_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Định mức BOM',
      headers: ['STT', 'Lệnh SX', 'Sản phẩm', 'Khách hàng', 'Loại thùng', 'Kích thước', 'SL (thùng)', 'CP giấy (đ)', 'CP gián tiếp (đ)', 'Hao hụt (đ)', 'Gia công (đ)', 'Giá bán cuối (đ/thùng)', 'Trạng thái'],
      rows: rows.map((r, i) => [
        i + 1, r.so_lenh ?? '', r.ten_hang ?? '', r.ten_khach_hang ?? '',
        r.loai_thung, `${+r.dai}×${+r.rong}×${+r.cao} cm / ${r.so_lop}L`,
        Number(r.so_luong_sx),
        r.chi_phi_giay != null ? Number(r.chi_phi_giay) : '',
        r.chi_phi_gian_tiep != null ? Number(r.chi_phi_gian_tiep) : '',
        r.chi_phi_hao_hut != null ? Number(r.chi_phi_hao_hut) : '',
        r.chi_phi_addon != null ? Number(r.chi_phi_addon) : '',
        r.gia_ban_cuoi != null ? Number(r.gia_ban_cuoi) : '',
        r.trang_thai === 'confirmed' ? 'Đã duyệt' : 'Nháp',
      ]),
      colWidths: [5, 16, 28, 24, 12, 20, 10, 14, 16, 12, 14, 20, 12],
    }])
  }

  const handleExportPdf = () => {
    const cols = [
      { header: 'STT', align: 'center' as const }, { header: 'Lệnh SX' },
      { header: 'Sản phẩm' }, { header: 'Khách hàng' },
      { header: 'Kích thước' }, { header: 'SL', align: 'right' as const },
      { header: 'CP giấy', align: 'right' as const }, { header: 'CP GT', align: 'right' as const },
      { header: 'Hao hụt', align: 'right' as const }, { header: 'GC thêm', align: 'right' as const },
      { header: 'Giá bán cuối', align: 'right' as const }, { header: 'TT' },
    ]
    const tableRows = rows.map((r, i) => [
      i + 1, r.so_lenh ?? '—', r.ten_hang ?? '—', r.ten_khach_hang ?? '—',
      `${+r.dai}×${+r.rong}×${+r.cao}/${r.so_lop}L`,
      vnd(r.so_luong_sx),
      r.chi_phi_giay != null ? fmtVND(r.chi_phi_giay) : '—',
      r.chi_phi_gian_tiep != null ? fmtVND(r.chi_phi_gian_tiep) : '—',
      r.chi_phi_hao_hut != null ? fmtVND(r.chi_phi_hao_hut) : '—',
      r.chi_phi_addon != null ? fmtVND(r.chi_phi_addon) : '—',
      r.gia_ban_cuoi != null ? fmtVND(r.gia_ban_cuoi) : '—',
      r.trang_thai === 'confirmed' ? 'Đã duyệt' : 'Nháp',
    ])
    printToPdf(
      'Định mức BOM',
      `<h2>ĐỊNH MỨC BOM</h2>
       <p class="meta">Xuất ngày: ${dayjs().format('DD/MM/YYYY HH:mm')} — ${rows.length} định mức</p>
       ${buildHtmlTable(cols, tableRows)}`,
      true,
    )
  }

  const handleBomSaved = () => {
    if (editingPoiId) {
      qc.invalidateQueries({ queryKey: ['bom-by-item', editingPoiId] })
      qc.invalidateQueries({ queryKey: ['bom-from-poi', editingPoiId] })
    }
    refetch()
    refetchPending()
  }

  const columns: ColumnsType<BomSummaryItem> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 130,
      render: v => v ? <Text strong style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Mã hàng / Sản phẩm',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{v ?? '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.loai_thung} · {+r.dai}×{+r.rong}×{+r.cao} cm · {r.so_lop} lớp
            {r.to_hop_song ? ` (${r.to_hop_song})` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
      width: 180,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{v ?? '—'}</Text>
          {r.ma_khach_hang && (
            <Text type="secondary" style={{ fontSize: 11 }}>[{r.ma_khach_hang}]</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'SL (thùng)',
      dataIndex: 'so_luong_sx',
      width: 100,
      align: 'right',
      render: v => vnd(Number(v)),
    },
    {
      title: 'Chi phí giấy',
      dataIndex: 'chi_phi_giay',
      width: 115,
      align: 'right',
      render: v => v != null ? `${vnd(Number(v))} đ` : '—',
    },
    {
      title: 'CP gián tiếp',
      dataIndex: 'chi_phi_gian_tiep',
      width: 115,
      align: 'right',
      render: v => v != null ? `${vnd(Number(v))} đ` : '—',
    },
    {
      title: 'Hao hụt',
      dataIndex: 'chi_phi_hao_hut',
      width: 100,
      align: 'right',
      render: v => v != null ? `${vnd(Number(v))} đ` : '—',
    },
    {
      title: 'Gia công thêm',
      dataIndex: 'chi_phi_addon',
      width: 115,
      align: 'right',
      render: v => v != null ? `${vnd(Number(v))} đ` : '—',
    },
    ...(canViewPrice ? [{
      title: 'Giá bán cuối (đ/thùng)',
      dataIndex: 'gia_ban_cuoi',
      width: 145,
      align: 'right' as const,
      render: (v: number | null) => v != null
        ? <Text strong style={{ color: '#1677ff' }}>{vnd(Number(v))} đ</Text>
        : <Text type="secondary">—</Text>,
    }] : []),
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      align: 'center',
      render: v => {
        const cfg = TRANG_THAI_CONFIG[v] ?? { label: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updated_at',
      width: 105,
      align: 'center',
      render: v => dayjs(v).format('DD/MM/YY HH:mm'),
    },
    {
      title: '',
      key: 'action',
      width: 160,
      align: 'center',
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<CalculatorOutlined />}
            type={row.trang_thai === 'confirmed' ? 'default' : 'primary'}
            onClick={() => openEditor(row)}
          >
            {row.trang_thai === 'confirmed' ? 'Xem' : 'Sửa BOM'}
          </Button>
          {row.production_order_id && canViewPrice && (
            <Button
              size="small"
              icon={<FundOutlined />}
              onClick={() => navigate(`/production/cost-analysis?khsx_id=${row.production_order_id}`)}
            >
              Phân tích
            </Button>
          )}
        </Space>
      ),
    },
  ]

  // Columns for pending tab
  const pendingColumns: ColumnsType<PendingBomItem> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 130,
      render: v => <Text strong style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Mã hàng / Sản phẩm',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{v || '—'}</Text>
          {(r.loai_thung || r.dai) && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {r.loai_thung}{r.loai_thung && r.dai ? ' · ' : ''}
              {r.dai != null ? `${r.dai}×${r.rong}×${r.cao} cm` : ''}
              {r.so_lop ? ` · ${r.so_lop} lớp` : ''}
              {r.to_hop_song ? ` (${r.to_hop_song})` : ''}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 180,
      ellipsis: true,
      render: v => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'SL kế hoạch',
      dataIndex: 'so_luong_ke_hoach',
      width: 110,
      align: 'right',
      render: v => vnd(Number(v)),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'has_draft',
      width: 110,
      align: 'center',
      render: (v: boolean) => v
        ? <Tag color="processing">Có BOM nháp</Tag>
        : <Tag color="warning">Chưa có BOM</Tag>,
    },
    {
      title: '',
      key: 'action',
      width: 200,
      align: 'center',
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openNewBom(row)}
          >
            Tạo BOM
          </Button>
          {canViewPrice && (
            <Button
              size="small"
              icon={<FundOutlined />}
              onClick={() => navigate(`/production/cost-analysis?khsx_id=${row.production_order_id}`)}
            >
              Phân tích
            </Button>
          )}
        </Space>
      ),
    },
  ]

  // Find name of item being edited for drawer title
  const editingRow = data?.find(r => r.id === editingId)
  const editingPendingRow = pendingRows.find(r => r.poi_id === editingPoiId && !editingId)
  const drawerTitle = editingRow
    ? `Định mức BOM — ${editingRow.ten_hang ?? ''}${editingRow.so_lenh ? ` · ${editingRow.so_lenh}` : ''}`
    : editingPendingRow
      ? `Tạo BOM — ${editingPendingRow.ten_hang}${editingPendingRow.so_lenh ? ` · ${editingPendingRow.so_lenh}` : ''}`
      : 'Định mức BOM'

  const toolbarExtra = (
    <Space>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Tìm lệnh SX, mã hàng, khách hàng..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        style={{ width: 280 }}
      />
      {activeTab === 'has_bom' && (
        <Select
          placeholder="Trạng thái"
          value={filterTrangThai}
          onChange={setFilterTrangThai}
          allowClear
          style={{ width: 130 }}
          options={[
            { value: 'draft',     label: 'Nháp' },
            { value: 'confirmed', label: 'Đã duyệt' },
          ]}
        />
      )}
      {activeTab === 'has_bom' && (
        <Button.Group>
          <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>Excel</Button>
          <Button icon={<FilePdfOutlined />} style={{ color: '#e53935', borderColor: '#e53935' }} onClick={handleExportPdf}>PDF</Button>
        </Button.Group>
      )}
      <Button
        icon={<UploadOutlined />}
        onClick={() => setImportVisible(true)}
      >
        Import
      </Button>
    </Space>
  )

  return (
    <div>
      <Card
        title="Định mức BOM"
        extra={toolbarExtra}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={v => setActiveTab(v as 'has_bom' | 'pending')}
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'has_bom',
              label: (
                <Space size={4}>
                  Đã có BOM
                  <Badge count={rows.length} showZero style={{ backgroundColor: '#1677ff' }} />
                </Space>
              ),
              children: (
                <Table
                  locale={{ emptyText: <EmptyState size="small" /> }}
                  columns={columns}
                  dataSource={rows}
                  rowKey="id"
                  loading={isLoading}
                  size="small"
                  pagination={{ pageSize: 50, showTotal: t => `${t} định mức` }}
                  scroll={{ x: 1300 }}
                />
              ),
            },
            {
              key: 'pending',
              label: (
                <Space size={4}>
                  Chưa có BOM
                  <Badge count={pendingRows.length} showZero style={{ backgroundColor: '#faad14' }} />
                </Space>
              ),
              children: (
                <Table
                  locale={{ emptyText: <EmptyState size="small" description="Tất cả lệnh SX đã có BOM" /> }}
                  columns={pendingColumns}
                  dataSource={pendingRows}
                  rowKey="poi_id"
                  loading={pendingLoading}
                  size="small"
                  pagination={{ pageSize: 50, showTotal: t => `${t} lệnh SX` }}
                  scroll={{ x: 900 }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Drawer — full BOM calculator / viewer */}
      <Drawer
        open={!!editingPoiId}
        onClose={closeEditor}
        width={Math.min(1200, window.innerWidth - 48)}
        title={drawerTitle}
        destroyOnClose
        bodyStyle={{ padding: 0 }}
      >
        {editingPoiId ? (
          <BomCalculatorPanel
            key={editingPoiId}
            production_order_item_id={editingPoiId}
            initialValues={editingInitial ?? undefined}
            onBomSaved={handleBomSaved}
          />
        ) : editingId ? (
          <div style={{ padding: 24 }}>
            <Text type="secondary">
              BOM này không gắn với dòng lệnh sản xuất nào. Không thể chỉnh sửa tại đây.
            </Text>
          </div>
        ) : null}
      </Drawer>

      <ImportExcelDialog
        title="Import Định mức BOM từ Excel"
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onSuccess={() => refetch()}
        importFn={(file, commit) => bomApi.importBoms(file, commit).then(r => r.data)}
        templateUrl="/api/bom/import-template"
      />
    </div>
  )
}
