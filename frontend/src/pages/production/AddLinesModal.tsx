import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Button, DatePicker, Input, InputNumber, message, Modal,
  Space, Table, Typography,
} from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionPlansApi, AvailableItem, calcSoDao, calcKhoTT,
} from '../../api/productionPlans'

const { Text } = Typography

interface EditState {
  ngay_chay: string | null
  kho1: number | null
  kho_giay: number | null
}

interface Props {
  open: boolean
  planId: number
  existingItemIds: number[]
  onClose: () => void
  onAdded: () => void
}

export default function AddLinesModal({ open, planId, existingItemIds, onClose, onAdded }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])       // production_order_item_id[]
  const [editMap, setEditMap] = useState<Record<number, EditState>>({})

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['available-items', search],
    queryFn: () => productionPlansApi.getAvailableItems({ search }).then(r => r.data),
    enabled: open,
  })

  // Lọc bỏ những item đã có trong kế hoạch
  const available = items.filter(i => !existingItemIds.includes(i.production_order_item_id))

  const addMut = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        const item = available.find(i => i.production_order_item_id === id)
        if (!item) continue
        const edit = editMap[id] ?? {}
        const kho1 = edit.kho1 ?? item.kho1_tinh_toan ?? null
        const khoGiay = edit.kho_giay ?? null
        const soDao = calcSoDao(khoGiay, kho1)
        await productionPlansApi.addLine(planId, {
          production_order_item_id: id,
          ngay_chay: edit.ngay_chay ?? null,
          kho1: kho1 ?? undefined,
          kho_giay: khoGiay ?? undefined,
          so_dao: soDao ?? undefined,
          so_luong_ke_hoach: item.so_luong_ke_hoach,
        })
      }
    },
    onSuccess: () => {
      message.success(`Đã thêm ${selected.length} dòng vào kế hoạch`)
      setSelected([])
      setEditMap({})
      onAdded()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi thêm dòng'),
  })

  const setEdit = (id: number, patch: Partial<EditState>) => {
    setEditMap(prev => ({ ...prev, [id]: { ...(prev[id] ?? { ngay_chay: null, kho1: null, kho_giay: null }), ...patch } }))
  }

  const cols: ColumnsType<AvailableItem> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 120,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 110,
      ellipsis: true,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string, r: AvailableItem) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{v}</Text>
          {r.loai_thung && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.loai_thung} {r.so_lop}L {r.to_hop_song} · {r.dai}×{r.rong}×{r.cao}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'SL',
      dataIndex: 'so_luong_ke_hoach',
      width: 75,
      align: 'right' as const,
      render: (v: number) => new Intl.NumberFormat('vi-VN').format(Number(v)),
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 85,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM') : '—',
    },
    {
      title: 'Ngày chạy',
      width: 110,
      render: (_: unknown, r: AvailableItem) => {
        const id = r.production_order_item_id
        if (!selected.includes(id)) return null
        return (
          <DatePicker
            size="small"
            style={{ width: 100 }}
            format="DD/MM/YYYY"
            value={editMap[id]?.ngay_chay ? dayjs(editMap[id].ngay_chay) : null}
            onChange={(d) => setEdit(id, { ngay_chay: d ? d.format('YYYY-MM-DD') : null })}
          />
        )
      },
    },
    {
      title: 'Kho1 (cm)',
      width: 85,
      render: (_: unknown, r: AvailableItem) => {
        const id = r.production_order_item_id
        if (!selected.includes(id)) return (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.kho1_tinh_toan ? Number(r.kho1_tinh_toan).toFixed(1) : '—'}
          </Text>
        )
        const kho1Val = editMap[id]?.kho1 ?? (r.kho1_tinh_toan ? Number(r.kho1_tinh_toan) : null)
        return (
          <InputNumber
            size="small"
            style={{ width: 75 }}
            value={kho1Val ?? undefined}
            min={0}
            step={0.1}
            placeholder={r.kho1_tinh_toan ? Number(r.kho1_tinh_toan).toFixed(1) : undefined}
            onChange={v => setEdit(id, { kho1: v ?? null })}
          />
        )
      },
    },
    {
      title: 'Ch Khổ',
      width: 110,
      render: (_: unknown, r: AvailableItem) => {
        const id = r.production_order_item_id
        if (!selected.includes(id)) return null
        const edit = editMap[id] ?? {}
        const kho1 = edit.kho1 ?? (r.kho1_tinh_toan ? Number(r.kho1_tinh_toan) : null)
        const soDao = calcSoDao(edit.kho_giay ?? null, kho1)
        const khoTT = calcKhoTT(kho1, soDao)
        return (
          <Space direction="vertical" size={0}>
            <InputNumber
              size="small"
              style={{ width: 85 }}
              value={edit.kho_giay ?? undefined}
              min={0}
              step={10}
              placeholder="Khổ giấy"
              onChange={v => setEdit(id, { kho_giay: v ?? null })}
            />
            {soDao !== null && (
              <Text type="secondary" style={{ fontSize: 10 }}>
                → {soDao} dao · {khoTT?.toFixed(1)} cm
              </Text>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Chọn lệnh sản xuất thêm vào kế hoạch"
      width={1000}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button
          key="add"
          type="primary"
          disabled={selected.length === 0}
          loading={addMut.isPending}
          onClick={() => addMut.mutate()}
        >
          Thêm {selected.length > 0 ? `(${selected.length})` : ''} dòng
        </Button>,
      ]}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="Tìm số LSX, tên hàng..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />

      <Table<AvailableItem>
        rowKey="production_order_item_id"
        dataSource={available}
        columns={cols}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: false, size: 'small' }}
        scroll={{ x: 800 }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: keys => {
            const newIds = keys as number[]
            // Khởi tạo edit state cho items mới chọn
            newIds.forEach(id => {
              if (!editMap[id]) {
                const item = available.find(i => i.production_order_item_id === id)
                setEditMap(prev => ({
                  ...prev,
                  [id]: {
                    ngay_chay: null,
                    kho1: item?.kho1_tinh_toan ? Number(item.kho1_tinh_toan) : null,
                    kho_giay: null,
                  },
                }))
              }
            })
            setSelected(newIds)
          },
        }}
      />
    </Modal>
  )
}
