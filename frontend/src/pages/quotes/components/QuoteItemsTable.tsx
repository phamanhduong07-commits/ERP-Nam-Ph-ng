import { Table, Button, Space, Tag, Typography, Popconfirm, Tooltip } from 'antd'
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { QuoteItem } from '../../../api/quotes'
import { buildPaperSymbol } from '../../../api/quotes'
import EmptyState from '../../../components/EmptyState'

const { Text } = Typography

interface QuoteItemsTableProps {
  items: QuoteItem[]
  editingIdx: number | null
  isReadonly: boolean
  paperCodes: Record<string, string>
  onEdit: (idx: number) => void
  onDelete: (idx: number) => void
  onCopy: (idx: number) => void
}

export default function QuoteItemsTable({
  items, editingIdx, isReadonly, paperCodes, onEdit, onDelete, onCopy,
}: QuoteItemsTableProps) {
  const columns: ColumnsType<QuoteItem> = [
    { title: 'STT', dataIndex: 'stt', width: 45, align: 'center' },
    {
      title: 'Mã hàng', dataIndex: 'ma_amis', width: 100,
      render: (v: string) => v ? <Text code style={{ fontSize: 10 }}>{v}</Text> : '—',
    },
    {
      title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true,
      render: (v: string, r: QuoteItem) => (
        <div>
          <Text>{v}</Text>
          {r.loai && <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>({r.loai})</Text>}
        </div>
      ),
    },
    { title: 'ĐVT', dataIndex: 'dvt', width: 55 },
    { title: 'SL', dataIndex: 'so_luong', width: 65, align: 'right' },
    {
      title: 'Kết cấu', width: 90,
      render: (_: unknown, r: QuoteItem) => (
        <Space size={2} direction="vertical" style={{ lineHeight: 1.2 }}>
          <Tag style={{ fontSize: 10, margin: 0 }}>{r.so_lop}L</Tag>
          {r.to_hop_song && <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>{r.to_hop_song}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Loại thùng', dataIndex: 'loai_thung', width: 75,
      render: (v: string) => v ? <Tag style={{ fontSize: 10 }}>{v}</Tag> : '—',
    },
    {
      title: 'Mã Ký Hiệu', dataIndex: 'ma_ky_hieu', width: 150,
      render: (v: string | null, r: QuoteItem) => v || buildPaperSymbol(r, paperCodes) || '—',
    },
    {
      title: 'D×R×C (cm)', width: 120,
      render: (_: unknown, r: QuoteItem) => r.dai ? `${r.dai}×${r.rong}×${r.cao}` : '—',
    },
    {
      title: 'S (m²)', dataIndex: 'dien_tich', width: 68, align: 'right' as const,
      render: (v: number | string | null) => (v != null && v !== '') ? Number(v).toFixed(4) : '—',
    },
    {
      title: 'Loại in', dataIndex: 'loai_in', width: 90,
      render: (v: string, r: QuoteItem) => {
        const opt = [
          { value: 'khong_in', label: 'Không in' },
          { value: 'flexo', label: 'Flexo' },
          { value: 'ky_thuat_so', label: 'KTS' },
        ].find(o => o.value === v)
        const hasIn = opt && opt.value !== 'khong_in'
        if (!hasIn && !r.co_tem_offset) return '—'
        return (
          <Space size={2} direction="vertical" style={{ lineHeight: 1.2 }}>
            {hasIn && <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{opt!.label}</Tag>}
            {r.co_tem_offset && <Tag color="magenta" style={{ fontSize: 10, margin: 0 }}>Offset</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Đơn giá', dataIndex: 'gia_ban', width: 115, align: 'right',
      render: (v: number, r: QuoteItem) => {
        if (v > 0) return <Text strong style={{ color: '#f5222d' }}>{v.toLocaleString('vi-VN')}</Text>
        if (r.ten_hang) return <Tag color="warning" style={{ fontSize: 11 }}>Chưa có giá</Tag>
        return '—'
      },
    },
    {
      title: 'Giá phôi', dataIndex: 'gia_phoi', width: 100, align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#52c41a', fontSize: 12 }}>{v.toLocaleString('vi-VN')}</Text>
        : <Text style={{ color: '#bfbfbf', fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Giá TP', dataIndex: 'gia_noi_bo', width: 100, align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#722ed1', fontSize: 12 }}>{v.toLocaleString('vi-VN')}</Text>
        : <Text style={{ color: '#bfbfbf', fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Thành tiền', width: 115, align: 'right',
      render: (_: unknown, r: QuoteItem) => {
        const tt = (r.gia_ban || 0) * (r.so_luong || 0)
        return tt ? <Text strong style={{ color: '#1677ff' }}>{tt.toLocaleString('vi-VN')}</Text> : '—'
      },
    },
    {
      title: 'Ghi Chú', dataIndex: 'ghi_chu', width: 140, ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Xưởng SX', dataIndex: 'ten_phan_xuong', width: 110,
      render: (v: string | null) => v
        ? <Tag color="cyan" style={{ fontSize: 10 }}>{v}</Tag>
        : <Tag color="default" style={{ fontSize: 10, color: '#aaa' }}>Theo đơn</Tag>,
    },
    ...(!isReadonly ? [{
      title: '', key: 'act', width: 110,
      render: (_: unknown, _row: QuoteItem, idx: number) => (
        <Space size={2}>
          <Tooltip title="Sao chép dòng này">
            <Button size="small" type="text" icon={<CopyOutlined />}
              onClick={() => onCopy(idx)} style={{ color: '#1890ff' }} />
          </Tooltip>
          <Button size="small" type="link" onClick={() => onEdit(idx)}>Sửa</Button>
          <Popconfirm title="Xoá dòng này?" onConfirm={() => onDelete(idx)}>
            <Button size="small" danger type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <Table
      locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
      rowKey={(_, idx) => String(idx)}
      dataSource={items}
      columns={columns}
      pagination={false}
      size="small"
      scroll={{ x: 900 }}
      rowClassName={(row, idx) => {
        if (idx === editingIdx) return 'editing-row'
        if (row.ten_hang && !(row.gia_ban > 0)) return 'no-price-row'
        return ''
      }}
      onRow={(_, idx) => ({
        onDoubleClick: () => !isReadonly && idx !== undefined && onEdit(idx),
        style: { cursor: isReadonly ? 'default' : 'pointer' },
      })}
    />
  )
}
