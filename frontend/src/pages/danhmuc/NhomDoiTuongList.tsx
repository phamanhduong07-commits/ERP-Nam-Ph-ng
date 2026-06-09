import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Tag, Popconfirm, message, Typography, Row, Col, Switch, Tabs,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ApiError } from '../../api/types'
import client from '../../api/client'
import EmptyState from '../../components/EmptyState'

const { Title } = Typography

type Loai = 'khach_hang' | 'nha_cung_cap'

interface NhomDoiTuong {
  id: number
  ma_nhom: string
  ten_nhom: string
  loai: string
  ghi_chu: string | null
  trang_thai: boolean
}

const nhomApi = {
  list: (loai: string) =>
    client.get<NhomDoiTuong[]>('/nhom-doi-tuong', { params: { loai } }),
  create: (d: Omit<NhomDoiTuong, 'id'>) =>
    client.post<NhomDoiTuong>('/nhom-doi-tuong', d),
  update: (id: number, d: Partial<Omit<NhomDoiTuong, 'id'>>) =>
    client.put<NhomDoiTuong>(`/nhom-doi-tuong/${id}`, d),
  delete: (id: number) => client.delete(`/nhom-doi-tuong/${id}`),
}

interface NhomTabProps {
  loai: Loai
  label: string
}

function NhomTab({ loai, label }: NhomTabProps) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<NhomDoiTuong | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['nhom-doi-tuong', loai],
    queryFn: () => nhomApi.list(loai).then(r => r.data),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['nhom-doi-tuong', loai] })

  const createMut = useMutation({
    mutationFn: (d: Omit<NhomDoiTuong, 'id'>) => nhomApi.create(d),
    onSuccess: () => {
      invalidate()
      closeModal()
      message.success(`Đã thêm ${label.toLowerCase()}`)
    },
    onError: (e: unknown) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<NhomDoiTuong, 'id'>> }) =>
      nhomApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => nhomApi.delete(id),
    onSuccess: () => {
      invalidate()
      message.success('Đã xoá')
    },
    onError: (e: unknown) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: NhomDoiTuong) => {
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
    const payload: Omit<NhomDoiTuong, 'id'> = {
      ma_nhom: vals.ma_nhom,
      ten_nhom: vals.ten_nhom,
      loai,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<NhomDoiTuong> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: NhomDoiTuong, index: number) => index + 1,
    },
    { title: 'Mã', dataIndex: 'ma_nhom', width: 140 },
    { title: 'Tên', dataIndex: 'ten_nhom' },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngừng'}</Tag>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 90,
      render: (_: unknown, r: NhomDoiTuong) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá nhóm này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="end" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm mới
          </Button>
        </Col>
      </Row>

      <Table
        locale={{ emptyText: <EmptyState size="small" /> }}
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={isLoading}
        pagination={false}
        size="small"
      />

      <Modal
        title={editing ? `Sửa ${label.toLowerCase()}` : `Thêm ${label.toLowerCase()}`}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã" name="ma_nhom" rules={[{ required: true, message: 'Nhập mã nhóm' }]}>
            <Input placeholder="VD: KH01, NCC01..." />
          </Form.Item>
          <Form.Item label="Tên" name="ten_nhom" rules={[{ required: true, message: 'Nhập tên nhóm' }]}>
            <Input placeholder="VD: Khách hàng VIP, NCC giấy cuộn..." />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function NhomDoiTuongList() {
  return (
    <div>
      <Card>
        <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
          Nhóm khách hàng &amp; nhà cung cấp
        </Title>
        <Tabs
          defaultActiveKey="khach_hang"
          items={[
            {
              key: 'khach_hang',
              label: 'Nhóm khách hàng',
              children: <NhomTab loai="khach_hang" label="Nhóm khách hàng" />,
            },
            {
              key: 'nha_cung_cap',
              label: 'Nhóm nhà cung cấp',
              children: <NhomTab loai="nha_cung_cap" label="Nhóm nhà cung cấp" />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
