import { useState, useEffect } from 'react'
import { Modal, Table, Space, Button, InputNumber, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { QuoteItem } from '../../../api/quotes'

const { Text } = Typography

interface ItemRow {
  id: number
  stt: number
  ma_amis: string | null
  ten_hang: string
  so_luong_bao_gia: number
  so_luong: number
  dvt: string
  gia_ban: number
}

interface Props {
  open: boolean
  items: QuoteItem[]
  loading: boolean
  onCancel: () => void
  onOk: (overrides: { id: number; so_luong: number }[]) => void
}

export default function TaoDonHangModal({ open, items, loading, onCancel, onOk }: Props) {
  const [rows, setRows] = useState<ItemRow[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    const initial = items
      .filter(it => it.id != null)
      .map(it => ({
        id: it.id!,
        stt: it.stt,
        ma_amis: it.ma_amis ?? null,
        ten_hang: it.ten_hang,
        so_luong_bao_gia: it.so_luong,
        so_luong: it.so_luong,
        dvt: it.dvt,
        gia_ban: it.gia_ban,
      }))
    setRows(initial)
    setSelectedIds(initial.map(r => r.id))
  }, [open, items])

  const updateSoLuong = (id: number, val: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, so_luong: val } : r))
  }

  const handleOk = () => {
    const overrides = rows
      .filter(r => selectedIds.includes(r.id))
      .map(r => ({ id: r.id, so_luong: r.so_luong }))
    onOk(overrides)
  }

  const columns: ColumnsType<ItemRow> = [
    { title: 'STT', dataIndex: 'stt', width: 48, align: 'center' },
    {
      title: 'Mã hàng',
      dataIndex: 'ma_amis',
      width: 100,
      render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    {
      title: 'SL Báo giá',
      dataIndex: 'so_luong_bao_gia',
      width: 90,
      align: 'right',
      render: (v: number) => <Text type="secondary">{v.toLocaleString('vi-VN')}</Text>,
    },
    {
      title: 'SL Đơn hàng',
      width: 130,
      render: (_: unknown, r: ItemRow) => (
        <InputNumber
          min={1}
          value={r.so_luong}
          disabled={!selectedIds.includes(r.id)}
          onChange={v => updateSoLuong(r.id, v || 1)}
          style={{ width: 100 }}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      ),
    },
    { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
    {
      title: 'Đơn giá',
      dataIndex: 'gia_ban',
      width: 120,
      align: 'right',
      render: (v: number) => <Text style={{ color: '#f5222d' }}>{v.toLocaleString('vi-VN')}</Text>,
    },
  ]

  return (
    <Modal
      title="Chọn mặt hàng để lập đơn hàng"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Lập đơn"
      cancelText="Huỷ"
      confirmLoading={loading}
      okButtonProps={{ disabled: selectedIds.length === 0 }}
      width={780}
    >
      <div style={{ marginBottom: 8 }}>
        <Space>
          <Button size="small" onClick={() => setSelectedIds(rows.map(r => r.id))}>
            Chọn tất cả
          </Button>
          <Button size="small" onClick={() => setSelectedIds([])}>
            Bỏ chọn tất cả
          </Button>
          <Text type="secondary">Đã chọn {selectedIds.length}/{rows.length} mặt hàng</Text>
        </Space>
      </div>
      <Table<ItemRow>
        size="small"
        pagination={false}
        dataSource={rows}
        rowKey="id"
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedIds,
          onChange: keys => setSelectedIds(keys as number[]),
        }}
        columns={columns}
      />
    </Modal>
  )
}
