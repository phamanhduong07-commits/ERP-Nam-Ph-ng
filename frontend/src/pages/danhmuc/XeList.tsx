import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { xeApi, type Xe } from '../../api/simpleApis'

const { Title } = Typography

export default function XeList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Xe | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['xe'],
    queryFn: () => xeApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<Xe, 'id'>) => xeApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xe'] })
      closeModal()
      message.success('Đã thêm xe')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Xe, 'id'>> }) =>
      xeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xe'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => xeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xe'] })
      message.success('Đã xoá')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: Xe) => {
    setEditing(row)
    form.setFieldsValue({ ...row })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: Omit<Xe, 'id'> = {
      bien_so: vals.bien_so,
      loai_xe: vals.loai_xe || null,
      trong_tai: vals.trong_tai ?? null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<Xe> = [
    { title: 'Biển số', dataIndex: 'bien_so', width: 130 },
    { title: 'Loại xe', dataIndex: 'loai_xe', render: (v: string | null) => v ?? '—' },
    {
      title: 'Trọng tải (tấn)',
      dataIndex: 'trong_tai',
      width: 130,
      align: 'right',
      render: (v: number | null) => v != null ? v : '—',
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngừng'}</Tag>,
    },
    {
      title: '',
      key: 'act',
      width: 90,
      render: (_: unknown, r: Xe) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá xe này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Danh mục xe</Title>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm mới
            </Button>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? 'Sửa xe' : 'Thêm xe'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Biển số" name="bien_so" rules={[{ required: true, message: 'Nhập biển số xe' }]}>
            <Input placeholder="VD: 51A-12345" disabled={!!editing} />
          </Form.Item>
          <Form.Item label="Loại xe" name="loai_xe">
            <Input placeholder="VD: Tải nhẹ, Container..." />
          </Form.Item>
          <Form.Item label="Trọng tải (tấn)" name="trong_tai">
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="VD: 1.5" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
