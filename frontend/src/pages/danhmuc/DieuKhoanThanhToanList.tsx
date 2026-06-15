import { useState } from 'react'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ApiError } from '../../api/types'
import client from '../../api/client'
import EmptyState from '../../components/EmptyState'

const { Title } = Typography

interface DieuKhoanThanhToan {
  id: number
  ma_dktt: string
  ten_dktt: string
  so_ngay: number | null
  mo_ta: string | null
  trang_thai: boolean
}

const dieuKhoanApi = {
  list: () => client.get<DieuKhoanThanhToan[]>('/dieu-khoan-thanh-toan'),
  create: (d: Omit<DieuKhoanThanhToan, 'id'>) =>
    client.post<DieuKhoanThanhToan>('/dieu-khoan-thanh-toan', d),
  update: (id: number, d: Partial<Omit<DieuKhoanThanhToan, 'id'>>) =>
    client.put<DieuKhoanThanhToan>(`/dieu-khoan-thanh-toan/${id}`, d),
  delete: (id: number) => client.delete(`/dieu-khoan-thanh-toan/${id}`),
}

export default function DieuKhoanThanhToanList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DieuKhoanThanhToan | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['dieu-khoan-thanh-toan'],
    queryFn: () => dieuKhoanApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<DieuKhoanThanhToan, 'id'>) => dieuKhoanApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dieu-khoan-thanh-toan'] })
      closeModal()
      message.success('Đã thêm điều khoản thanh toán')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<DieuKhoanThanhToan, 'id'>> }) =>
      dieuKhoanApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dieu-khoan-thanh-toan'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => dieuKhoanApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dieu-khoan-thanh-toan'] })
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

  const openEdit = (row: DieuKhoanThanhToan) => {
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
    const payload: Omit<DieuKhoanThanhToan, 'id'> = {
      ma_dktt: vals.ma_dktt,
      ten_dktt: vals.ten_dktt,
      so_ngay: vals.so_ngay ?? null,
      mo_ta: vals.mo_ta || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  useHotkey('ctrl+n', openCreate, 'Thêm điều khoản thanh toán mới')
  useHotkey('ctrl+s', handleSave, 'Lưu điều khoản thanh toán', 'Trang hiện tại', modalOpen)

  const renderSoNgay = (v: number | null) => {
    if (v === 0) return 'COD'
    if (v === null || v === undefined) return '—'
    return `${v} ngày`
  }

  const columns: ColumnsType<DieuKhoanThanhToan> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: DieuKhoanThanhToan, index: number) => index + 1,
    },
    { title: 'Mã', dataIndex: 'ma_dktt', width: 140 },
    { title: 'Tên', dataIndex: 'ten_dktt' },
    {
      title: 'Số ngày',
      dataIndex: 'so_ngay',
      width: 110,
      align: 'center',
      render: renderSoNgay,
    },
    { title: 'Mô tả', dataIndex: 'mo_ta', render: (v: string | null) => v ?? '—' },
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
      render: (_: unknown, r: DieuKhoanThanhToan) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá điều khoản này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
            <Title level={4} style={{ margin: 0 }}>Điều khoản thanh toán</Title>
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
        title={editing ? 'Sửa điều khoản thanh toán' : 'Thêm điều khoản thanh toán'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã" name="ma_dktt" rules={[{ required: true, message: 'Nhập mã điều khoản' }]}>
            <Input placeholder="VD: COD, NET30..." />
          </Form.Item>
          <Form.Item label="Tên" name="ten_dktt" rules={[{ required: true, message: 'Nhập tên điều khoản' }]}>
            <Input placeholder="VD: Thanh toán ngay, Trả sau 30 ngày..." />
          </Form.Item>
          <Form.Item label="Số ngày" name="so_ngay">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0 = COD, để trống = không kỳ hạn" />
          </Form.Item>
          <Form.Item label="Mô tả" name="mo_ta">
            <Input.TextArea rows={3} placeholder="Mô tả thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
