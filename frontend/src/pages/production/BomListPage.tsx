import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Drawer, Input, Select, Space, Table, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalculatorOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { bomApi, vnd } from '../../api/bom'
import type { BomSummaryItem } from '../../api/bom'
import BomCalculatorPanel from './BomCalculatorPanel'

const { Text } = Typography

const TRANG_THAI_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Nháp',     color: 'processing' },
  confirmed: { label: 'Đã duyệt', color: 'success'    },
}

export default function BomListPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [editingId, setEditingId] = useState<number | null>(null)   // BOM id
  const [editingPoiId, setEditingPoiId] = useState<number | null>(null)  // production_order_item_id

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bom-summary', filterTrangThai],
    queryFn: () => bomApi.listSummary({ trang_thai: filterTrangThai }).then(r => r.data),
    staleTime: 30_000,
  })

  // Client-side search filter
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

  const openEditor = (row: BomSummaryItem) => {
    setEditingId(row.id)
    setEditingPoiId(row.production_order_item_id)
  }

  const closeEditor = () => {
    setEditingId(null)
    setEditingPoiId(null)
  }

  const handleBomSaved = () => {
    if (editingPoiId) {
      qc.invalidateQueries({ queryKey: ['bom-by-item', editingPoiId] })
      qc.invalidateQueries({ queryKey: ['bom-from-poi', editingPoiId] })
    }
    refetch()
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
            {r.loai_thung} · {r.dai}×{r.rong}×{r.cao} cm · {r.so_lop} lớp
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
    {
      title: 'Giá bán cuối (đ/thùng)',
      dataIndex: 'gia_ban_cuoi',
      width: 145,
      align: 'right',
      render: v => v != null
        ? <Text strong style={{ color: '#1677ff' }}>{vnd(Number(v))} đ</Text>
        : <Text type="secondary">—</Text>,
    },
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
      width: 110,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          icon={<CalculatorOutlined />}
          type={row.trang_thai === 'confirmed' ? 'default' : 'primary'}
          onClick={() => openEditor(row)}
        >
          {row.trang_thai === 'confirmed' ? 'Xem' : 'Sửa BOM'}
        </Button>
      ),
    },
  ]

  // Find name of item being edited for drawer title
  const editingRow = data?.find(r => r.id === editingId)

  return (
    <div>
      <Card
        title="Định mức BOM"
        extra={
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm lệnh SX, mã hàng, khách hàng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ width: 280 }}
            />
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
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 50, showTotal: t => `${t} định mức` }}
          scroll={{ x: 1300 }}
        />
      </Card>

      {/* Drawer — full BOM calculator / viewer */}
      <Drawer
        open={!!editingId}
        onClose={closeEditor}
        width={Math.min(1200, window.innerWidth - 48)}
        title={
          editingRow
            ? `Định mức BOM — ${editingRow.ten_hang ?? ''}${editingRow.so_lenh ? ` · ${editingRow.so_lenh}` : ''}`
            : 'Định mức BOM'
        }
        destroyOnClose
        bodyStyle={{ padding: 0 }}
      >
        {editingPoiId ? (
          <BomCalculatorPanel
            key={editingPoiId}
            production_order_item_id={editingPoiId}
            onBomSaved={handleBomSaved}
          />
        ) : editingId ? (
          /* BOM không gắn với POI — hiện thông báo */
          <div style={{ padding: 24 }}>
            <Text type="secondary">
              BOM này không gắn với dòng lệnh sản xuất nào. Không thể chỉnh sửa tại đây.
            </Text>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
