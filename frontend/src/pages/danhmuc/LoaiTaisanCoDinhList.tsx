import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import EmptyState from '../../components/EmptyState'

const { Title } = Typography
const { TextArea } = Input

interface LoaiTaisanCoDinh {
  id: number
  ma_loai: string
  ten_loai: string
  ty_le_khau_hao: number | null
  thoi_gian_sd: number | null
  tk_nguyen_gia: string | null
  tk_hao_mon: string | null
  tk_khau_hao: string | null
  ghi_chu: string | null
  trang_thai: boolean
}

type LoaiTaisanCoDinhInput = Omit<LoaiTaisanCoDinh, 'id'>

const ENDPOINT = '/loai-tai-san-co-dinh'

const api = {
  list: () => client.get<LoaiTaisanCoDinh[]>(ENDPOINT),
  create: (d: LoaiTaisanCoDinhInput) => client.post<LoaiTaisanCoDinh>(ENDPOINT, d),
  update: (id: number, d: LoaiTaisanCoDinhInput) => client.put<LoaiTaisanCoDinh>(`${ENDPOINT}/${id}`, d),
  delete: (id: number) => client.delete(`${ENDPOINT}/${id}`),
}

export default function LoaiTaisanCoDinhList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LoaiTaisanCoDinh | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['loai-tai-san-co-dinh'],
    queryFn: () => api.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: LoaiTaisanCoDinhInput) => api.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loai-tai-san-co-dinh'] })
      closeModal()
      message.success('Đã thêm loại tài sản cố định')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LoaiTaisanCoDinhInput }) => api.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loai-tai-san-co-dinh'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loai-tai-san-co-dinh'] })
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

  const openEdit = (row: LoaiTaisanCoDinh) => {
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
    const payload: LoaiTaisanCoDinhInput = {
      ma_loai: vals.ma_loai,
      ten_loai: vals.ten_loai,
      ty_le_khau_hao: vals.ty_le_khau_hao ?? null,
      thoi_gian_sd: vals.thoi_gian_sd ?? null,
      tk_nguyen_gia: vals.tk_nguyen_gia || null,
      tk_hao_mon: vals.tk_hao_mon || null,
      tk_khau_hao: vals.tk_khau_hao || null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<LoaiTaisanCoDinh> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: LoaiTaisanCoDinh, index: number) => index + 1,
    },
    { title: 'Mã', dataIndex: 'ma_loai', width: 120 },
    { title: 'Tên', dataIndex: 'ten_loai' },
    {
      title: 'Tỷ lệ KH (%/năm)',
      dataIndex: 'ty_le_khau_hao',
      width: 140,
      align: 'right',
      render: (v: number | null) => (v ? `${v}%` : '—'),
    },
    {
      title: 'Thời gian SD',
      dataIndex: 'thoi_gian_sd',
      width: 120,
      align: 'right',
      render: (v: number | null) => (v ? `${v} năm` : '—'),
    },
    { title: 'TK nguyên giá', dataIndex: 'tk_nguyen_gia', width: 120, render: (v: string | null) => v ?? '—' },
    { title: 'TK hao mòn', dataIndex: 'tk_hao_mon', width: 110, render: (v: string | null) => v ?? '—' },
    { title: 'TK khấu hao', dataIndex: 'tk_khau_hao', width: 110, render: (v: string | null) => v ?? '—' },
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
      render: (_: unknown, r: LoaiTaisanCoDinh) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá loại tài sản cố định này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
            <Title level={4} style={{ margin: 0 }}>Loại tài sản cố định</Title>
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
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa loại tài sản cố định' : 'Thêm loại tài sản cố định'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã" name="ma_loai" rules={[{ required: true, message: 'Nhập mã loại tài sản' }]}>
            <Input placeholder="VD: NHA-XUONG, MAY-MOC..." />
          </Form.Item>
          <Form.Item label="Tên" name="ten_loai" rules={[{ required: true, message: 'Nhập tên loại tài sản' }]}>
            <Input placeholder="VD: Nhà xưởng, Máy móc thiết bị" />
          </Form.Item>
          <Form.Item label="Tỷ lệ khấu hao" name="ty_le_khau_hao">
            <InputNumber
              style={{ width: '100%' }}
              step={0.01}
              min={0}
              max={100}
              addonAfter="%/năm"
              placeholder="VD: 10.00"
            />
          </Form.Item>
          <Form.Item label="Thời gian sử dụng" name="thoi_gian_sd">
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              addonAfter="năm"
              placeholder="VD: 10"
            />
          </Form.Item>
          <Form.Item label="TK nguyên giá" name="tk_nguyen_gia">
            <Input placeholder="VD: 211" />
          </Form.Item>
          <Form.Item label="TK hao mòn lũy kế" name="tk_hao_mon">
            <Input placeholder="VD: 214" />
          </Form.Item>
          <Form.Item label="TK chi phí khấu hao" name="tk_khau_hao">
            <Input placeholder="VD: 6274" />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <TextArea rows={3} placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
