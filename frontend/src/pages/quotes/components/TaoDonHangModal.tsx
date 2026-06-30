import { useState, useEffect } from 'react'
import { Modal, Table, Space, Button, InputNumber, Typography, DatePicker, Input, Form } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { QuoteItem } from '../../../api/quotes'
import dayjs from 'dayjs'

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

export interface TaoDonHangResult {
  items: { id: number; so_luong: number }[]
  ngay_giao_hang: string | null
  dia_chi_giao: string | null
  dien_thoai_giao: string | null
}

interface Props {
  open: boolean
  items: QuoteItem[]
  loading: boolean
  onCancel: () => void
  onOk: (result: TaoDonHangResult) => void
}

export default function TaoDonHangModal({ open, items, loading, onCancel, onOk }: Props) {
  const [rows, setRows] = useState<ItemRow[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [ngayGiao, setNgayGiao] = useState<dayjs.Dayjs | null>(null)
  const [diaChiGiao, setDiaChiGiao] = useState('')
  const [dienThoaiGiao, setDienThoaiGiao] = useState('')

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
    setNgayGiao(null)
    setDiaChiGiao('')
    setDienThoaiGiao('')
  }, [open, items])

  const updateSoLuong = (id: number, val: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, so_luong: val } : r))
  }

  const handleOk = () => {
    const selectedItems = rows
      .filter(r => selectedIds.includes(r.id))
      .map(r => ({ id: r.id, so_luong: r.so_luong }))
    onOk({
      items: selectedItems,
      ngay_giao_hang: ngayGiao ? ngayGiao.format('YYYY-MM-DD') : null,
      dia_chi_giao: diaChiGiao.trim() || null,
      dien_thoai_giao: dienThoaiGiao.trim() || null,
    })
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
      <Form layout="vertical" style={{ marginTop: 16 }} size="small">
        <Form.Item label="Ngày giao hàng" style={{ marginBottom: 8 }}>
          <DatePicker
            format="DD/MM/YYYY"
            value={ngayGiao}
            onChange={setNgayGiao}
            style={{ width: '100%' }}
            placeholder="Chọn ngày giao (tuỳ chọn)"
          />
        </Form.Item>
        <Form.Item label="Điện thoại giao hàng" style={{ marginBottom: 8 }}>
          <Input
            value={dienThoaiGiao}
            onChange={e => setDienThoaiGiao(e.target.value)}
            placeholder="Số điện thoại liên hệ giao hàng (tuỳ chọn)"
            allowClear
          />
        </Form.Item>
        <Form.Item label="Địa chỉ giao hàng" style={{ marginBottom: 0 }}>
          <Input
            value={diaChiGiao}
            onChange={e => setDiaChiGiao(e.target.value)}
            placeholder="Địa chỉ giao hàng (tuỳ chọn)"
            allowClear
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
