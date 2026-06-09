import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, Select,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ApiError } from '../../api/types'
import client from '../../api/client'
import EmptyState from '../../components/EmptyState'

const { Title } = Typography

type LoaiMuc = 'thu' | 'chi' | 'ca_hai'

interface MucThuChi {
  id: number
  ma_muc: string
  ten_muc: string
  loai: LoaiMuc
  ghi_chu: string | null
  trang_thai: boolean
}

const LOAI_OPTIONS = [
  { value: 'thu', label: 'Thu' },
  { value: 'chi', label: 'Chi' },
  { value: 'ca_hai', label: 'Cả hai' },
]

const LOAI_TAG: Record<LoaiMuc, { color: string; label: string }> = {
  thu: { color: 'blue', label: 'Thu' },
  chi: { color: 'red', label: 'Chi' },
  ca_hai: { color: 'purple', label: 'Cả hai' },
}

const mucThuChiApi = {
  list: () => client.get<MucThuChi[]>('/muc-thu-chi'),
  create: (d: Omit<MucThuChi, 'id'>) => client.post<MucThuChi>('/muc-thu-chi', d),
  update: (id: number, d: Partial<Omit<MucThuChi, 'id'>>) =>
    client.put<MucThuChi>(`/muc-thu-chi/${id}`, d),
  delete: (id: number) => client.delete(`/muc-thu-chi/${id}`),
}

export default function MucThuChiList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MucThuChi | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['muc-thu-chi'],
    queryFn: () => mucThuChiApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<MucThuChi, 'id'>) => mucThuChiApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muc-thu-chi'] })
      closeModal()
      message.success('Đã thêm mục thu/chi')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<MucThuChi, 'id'>> }) =>
      mucThuChiApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muc-thu-chi'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => mucThuChiApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muc-thu-chi'] })
      message.success('Đã xoá')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: MucThuChi) => {
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
    const payload: Omit<MucThuChi, 'id'> = {
      ma_muc: vals.ma_muc,
      ten_muc: vals.ten_muc,
      loai: vals.loai,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<MucThuChi> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: MucThuChi, index: number) => index + 1,
    },
    { title: 'Mã', dataIndex: 'ma_muc', width: 140 },
    { title: 'Tên', dataIndex: 'ten_muc' },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 110,
      align: 'center',
      render: (v: LoaiMuc) => {
        const tag = LOAI_TAG[v]
        if (!tag) return <Tag>{v}</Tag>
        return <Tag color={tag.color}>{tag.label}</Tag>
      },
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
      render: (_: unknown, r: MucThuChi) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá mục này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
            <Title level={4} style={{ margin: 0 }}>Mục thu/chi</Title>
          </Col>
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
      </Card>

      <Modal
        title={editing ? 'Sửa mục thu/chi' : 'Thêm mục thu/chi'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã" name="ma_muc" rules={[{ required: true, message: 'Nhập mã mục' }]}>
            <Input placeholder="VD: THU01, CHI01..." />
          </Form.Item>
          <Form.Item label="Tên" name="ten_muc" rules={[{ required: true, message: 'Nhập tên mục' }]}>
            <Input placeholder="VD: Thu tiền bán hàng, Chi lương..." />
          </Form.Item>
          <Form.Item label="Loại" name="loai" rules={[{ required: true, message: 'Chọn loại' }]}>
            <Select options={LOAI_OPTIONS} placeholder="Chọn loại" />
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
