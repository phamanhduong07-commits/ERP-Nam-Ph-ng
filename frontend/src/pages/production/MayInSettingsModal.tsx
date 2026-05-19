import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Modal, Table, Button, Input, Space, Popconfirm, message, Form, InputNumber, Select,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons'
import { cd2Api, MayIn } from '../../api/cd2'
import { warehouseApi } from '../../api/warehouse'
import type { PhanXuong } from '../../api/warehouse'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function MayInSettingsModal({ open, onClose, onSaved }: Props) {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<{ ten_may: string; phan_xuong_id?: number | null }>({ ten_may: '' })

  const { data: mayIns = [], isLoading } = useQuery({
    queryKey: ['may-in-list'],
    queryFn: () => cd2Api.listMayIn().then(r => r.data),
    enabled: open,
  })

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['may-in-list'] })

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMayIn({
        ten_may: values.ten_may,
        sort_order: values.sort_order ?? 0,
        phan_xuong_id: values.phan_xuong_id ?? undefined,
      })
      message.success('Đã thêm máy in')
      form.resetFields()
      invalidate()
      onSaved()
    } catch {
      message.error('Lỗi thêm máy in')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!editValues.ten_may.trim()) return
    try {
      await cd2Api.updateMayIn(id, {
        ten_may: editValues.ten_may,
        phan_xuong_id: editValues.phan_xuong_id ?? undefined,
      })
      message.success('Đã cập nhật')
      setEditingId(null)
      invalidate()
      onSaved()
    } catch {
      message.error('Lỗi cập nhật')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await cd2Api.deleteMayIn(id)
      message.success('Đã xoá')
      invalidate()
      onSaved()
    } catch {
      message.error('Lỗi xoá')
    }
  }

  const xuongOptions = [
    { value: null, label: '— Tất cả xưởng —' },
    ...phanXuongList.map(px => ({ value: px.id, label: px.ten_xuong })),
  ]

  const columns = [
    {
      title: 'Tên máy',
      dataIndex: 'ten_may',
      render: (v: string, r: MayIn) =>
        editingId === r.id ? (
          <Input
            value={editValues.ten_may}
            onChange={e => setEditValues(prev => ({ ...prev, ten_may: e.target.value }))}
            size="small"
            autoFocus
            onPressEnter={() => handleSaveEdit(r.id)}
          />
        ) : v,
    },
    {
      title: 'Xưởng',
      dataIndex: 'phan_xuong_id',
      width: 160,
      render: (v: number | null, r: MayIn) =>
        editingId === r.id ? (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={editValues.phan_xuong_id ?? null}
            onChange={val => setEditValues(prev => ({ ...prev, phan_xuong_id: val }))}
            options={xuongOptions}
          />
        ) : (
          <span style={{ color: v ? undefined : '#bbb', fontSize: 12 }}>
            {phanXuongList.find(px => px.id === v)?.ten_xuong ?? '—'}
          </span>
        ),
    },
    { title: 'Thứ tự', dataIndex: 'sort_order', width: 70, align: 'center' as const },
    {
      title: '',
      width: 100,
      render: (_: unknown, r: MayIn) =>
        editingId === r.id ? (
          <Space size={4}>
            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => handleSaveEdit(r.id)} />
            <Button size="small" onClick={() => setEditingId(null)}>Huỷ</Button>
          </Space>
        ) : (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingId(r.id)
                setEditValues({ ten_may: r.ten_may, phan_xuong_id: r.phan_xuong_id ?? null })
              }}
            />
            <Popconfirm title="Xoá máy in này?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ]

  return (
    <Modal
      open={open}
      title="Cấu hình máy in"
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={580}
    >
      <Table
        rowKey="id"
        size="small"
        dataSource={mayIns}
        columns={columns}
        loading={isLoading}
        pagination={false}
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="inline">
        <Form.Item name="ten_may" rules={[{ required: true, message: 'Nhập tên máy' }]}>
          <Input placeholder="Tên máy mới..." size="small" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="phan_xuong_id">
          <Select
            placeholder="Chọn xưởng"
            size="small"
            allowClear
            style={{ width: 140 }}
            options={phanXuongList.map(px => ({ value: px.id, label: px.ten_xuong }))}
          />
        </Form.Item>
        <Form.Item name="sort_order">
          <InputNumber placeholder="Thứ tự" size="small" style={{ width: 80 }} min={0} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
