import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Modal, Table, Button, Input, Space, Popconfirm, message, Form, InputNumber,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons'
import { cd2Api, MayScan } from '../../api/cd2'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface EditState {
  ten_may: string
  don_gia: number | null
}

export default function MayScanSettingsModal({ open, onClose, onSaved }: Props) {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState>({ ten_may: '', don_gia: null })

  const { data: mayScanList = [], isLoading } = useQuery({
    queryKey: ['may-scan-settings'],
    queryFn: () => cd2Api.listMayScan().then(r => r.data),
    enabled: open,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['may-scan-settings'] })
    qc.invalidateQueries({ queryKey: ['may-scan'] })
  }

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMayScan({
        ten_may: values.ten_may,
        sort_order: values.sort_order ?? 0,
        don_gia: values.don_gia ?? undefined,
      })
      message.success('Đã thêm máy scan')
      form.resetFields()
      invalidate()
      onSaved()
    } catch {
      message.error('Lỗi thêm máy scan')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!editState.ten_may.trim()) return
    try {
      await cd2Api.updateMayScan(id, {
        ten_may: editState.ten_may,
        don_gia: editState.don_gia ?? undefined,
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
      await cd2Api.deleteMayScan(id)
      message.success('Đã xoá')
      invalidate()
      onSaved()
    } catch {
      message.error('Lỗi xoá')
    }
  }

  const columns = [
    {
      title: 'Tên máy',
      dataIndex: 'ten_may',
      render: (v: string, r: MayScan) =>
        editingId === r.id ? (
          <Input
            value={editState.ten_may}
            onChange={e => setEditState(s => ({ ...s, ten_may: e.target.value }))}
            size="small"
            autoFocus
            style={{ width: 150 }}
          />
        ) : v,
    },
    {
      title: 'Đơn giá (đ/m²)',
      dataIndex: 'don_gia',
      width: 130,
      render: (v: number | null, r: MayScan) =>
        editingId === r.id ? (
          <InputNumber
            value={editState.don_gia}
            onChange={val => setEditState(s => ({ ...s, don_gia: val }))}
            size="small"
            style={{ width: 100 }}
            min={0}
          />
        ) : (v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—'),
    },
    {
      title: '',
      width: 100,
      render: (_: unknown, r: MayScan) =>
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
                setEditState({ ten_may: r.ten_may, don_gia: r.don_gia })
              }}
            />
            <Popconfirm title="Xoá máy scan này?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ]

  return (
    <Modal
      open={open}
      title="Cấu hình máy scan"
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={520}
    >
      <Table
        rowKey="id"
        size="small"
        dataSource={mayScanList}
        columns={columns}
        loading={isLoading}
        pagination={false}
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="inline">
        <Form.Item name="ten_may" rules={[{ required: true, message: 'Nhập tên máy' }]}>
          <Input placeholder="Tên máy scan..." size="small" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="don_gia">
          <InputNumber placeholder="Đơn giá đ/m²" size="small" style={{ width: 120 }} min={0} />
        </Form.Item>
        <Form.Item name="sort_order">
          <InputNumber placeholder="Thứ tự" size="small" style={{ width: 70 }} min={0} />
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
