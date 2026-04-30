import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { donViTinhApi, type DonViTinh } from '../../api/simpleApis'

const { Title } = Typography

export default function DvtList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DonViTinh | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['don-vi-tinh'],
    queryFn: () => donViTinhApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<DonViTinh, 'id'>) => donViTinhApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['don-vi-tinh'] })
      closeModal()
      message.success('Đã thêm đơn vị tính')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<DonViTinh, 'id'>> }) =>
      donViTinhApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['don-vi-tinh'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => donViTinhApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['don-vi-tinh'] })
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

  const openEdit = (row: DonViTinh) => {
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
    const payload: Omit<DonViTinh, 'id'> = {
      ten: vals.ten,
      ky_hieu: vals.ky_hieu || null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<DonViTinh> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: DonViTinh, index: number) => index + 1,
    },
    { title: 'Tên', dataIndex: 'ten' },
    { title: 'Ký hiệu', dataIndex: 'ky_hieu', width: 100, render: (v: string | null) => v ?? '—' },
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
      render: (_: unknown, r: DonViTinh) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá đơn vị tính này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
            <Title level={4} style={{ margin: 0 }}>Đơn vị tính</Title>
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
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? 'Sửa đơn vị tính' : 'Thêm đơn vị tính'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Tên" name="ten" rules={[{ required: true, message: 'Nhập tên đơn vị tính' }]}>
            <Input placeholder="VD: Cái, Hộp, Thùng..." />
          </Form.Item>
          <Form.Item label="Ký hiệu" name="ky_hieu">
            <Input placeholder="VD: kg, m, m²..." />
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
