import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { taiXeApi, type TaiXe } from '../../api/simpleApis'

const { Title } = Typography

export default function TaiXeList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaiXe | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['tai-xe'],
    queryFn: () => taiXeApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<TaiXe, 'id'>) => taiXeApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tai-xe'] })
      closeModal()
      message.success('Đã thêm tài xế')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<TaiXe, 'id'>> }) =>
      taiXeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tai-xe'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => taiXeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tai-xe'] })
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

  const openEdit = (row: TaiXe) => {
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
    const payload: Omit<TaiXe, 'id'> = {
      ho_ten: vals.ho_ten,
      so_dien_thoai: vals.so_dien_thoai || null,
      so_bang_lai: vals.so_bang_lai || null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<TaiXe> = [
    { title: 'Họ tên', dataIndex: 'ho_ten' },
    { title: 'SĐT', dataIndex: 'so_dien_thoai', width: 130, render: (v: string | null) => v ?? '—' },
    { title: 'Số bằng lái', dataIndex: 'so_bang_lai', width: 140, render: (v: string | null) => v ?? '—' },
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
      render: (_: unknown, r: TaiXe) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá tài xế này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
            <Title level={4} style={{ margin: 0 }}>Danh mục tài xế</Title>
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
        title={editing ? 'Sửa tài xế' : 'Thêm tài xế'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Họ tên" name="ho_ten" rules={[{ required: true, message: 'Nhập họ tên tài xế' }]}>
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item label="Số điện thoại" name="so_dien_thoai">
            <Input placeholder="VD: 0901234567" />
          </Form.Item>
          <Form.Item label="Số bằng lái" name="so_bang_lai">
            <Input placeholder="VD: 012345678901" />
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
