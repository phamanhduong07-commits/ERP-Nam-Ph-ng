import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Modal, Table, Button, Input, Space, Popconfirm, message, Form, InputNumber,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons'
import { cd2Api, MayIn } from '../../api/cd2'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function MayInSettingsModal({ open, onClose, onSaved }: Props) {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const { data: mayIns = [], isLoading } = useQuery({
    queryKey: ['may-in-list'],
    queryFn: () => cd2Api.listMayIn().then(r => r.data),
    enabled: open,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['may-in-list'] })

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMayIn({ ten_may: values.ten_may, sort_order: values.sort_order ?? 0 })
      message.success('Đã thêm máy in')
      form.resetFields()
      invalidate()
      onSaved()
    } catch {
      message.error('Lỗi thêm máy in')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return
    try {
      await cd2Api.updateMayIn(id, { ten_may: editName })
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

  const columns = [
    {
      title: 'Tên máy',
      dataIndex: 'ten_may',
      render: (v: string, r: MayIn) =>
        editingId === r.id ? (
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            size="small"
            autoFocus
            onPressEnter={() => handleSaveEdit(r.id)}
          />
        ) : v,
    },
    { title: 'Thứ tự', dataIndex: 'sort_order', width: 80, align: 'center' as const },
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
              onClick={() => { setEditingId(r.id); setEditName(r.ten_may) }}
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
      width={480}
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
          <Input placeholder="Tên máy mới..." size="small" style={{ width: 200 }} />
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
