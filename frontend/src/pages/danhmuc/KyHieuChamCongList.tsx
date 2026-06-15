import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Tag, Popconfirm, message, Typography, Row, Col, Switch, Select,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import type { ApiError } from '../../api/types'
import EmptyState from '../../components/EmptyState'
import { useHotkey } from '../../hooks/useHotkey'

const { Title } = Typography

interface KyHieuChamCong {
  id: number
  ky_hieu: string
  ten_ky_hieu: string
  loai: string
  he_so_cong: number
  tinh_luong: boolean
  ghi_chu: string | null
  trang_thai: boolean
}

type KyHieuChamCongInput = Omit<KyHieuChamCong, 'id'>

const kyHieuApi = {
  list: () => client.get<KyHieuChamCong[]>('/ky-hieu-cham-cong'),
  create: (d: KyHieuChamCongInput) => client.post<KyHieuChamCong>('/ky-hieu-cham-cong', d),
  update: (id: number, d: Partial<KyHieuChamCongInput>) =>
    client.put<KyHieuChamCong>(`/ky-hieu-cham-cong/${id}`, d),
  delete: (id: number) => client.delete(`/ky-hieu-cham-cong/${id}`),
}

const LOAI_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'di_lam', label: 'Đi làm', color: 'green' },
  { value: 'nghi_phep', label: 'Nghỉ phép', color: 'blue' },
  { value: 'tang_ca', label: 'Tăng ca', color: 'orange' },
  { value: 'vang_mat', label: 'Vắng mặt', color: 'red' },
  { value: 'nghi_le', label: 'Nghỉ lễ', color: 'cyan' },
  { value: 'nghi_khong_luong', label: 'KLương', color: 'default' },
]

const LOAI_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  LOAI_OPTIONS.map((o) => [o.value, { label: o.label, color: o.color }])
)

function errMsg(e: unknown, fallback: string): string {
  return (e as ApiError)?.response?.data?.detail || fallback
}

export default function KyHieuChamCongList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<KyHieuChamCong | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['ky-hieu-cham-cong'],
    queryFn: () => kyHieuApi.list().then((r) => r.data),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ky-hieu-cham-cong'] })

  const createMut = useMutation({
    mutationFn: (d: KyHieuChamCongInput) => kyHieuApi.create(d),
    onSuccess: () => {
      invalidate()
      closeModal()
      message.success('Đã thêm ký hiệu chấm công')
    },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi khi thêm')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<KyHieuChamCongInput> }) =>
      kyHieuApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi khi cập nhật')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => kyHieuApi.delete(id),
    onSuccess: () => {
      invalidate()
      message.success('Đã xoá')
    },
    onError: (e: unknown) => message.error(errMsg(e, 'Lỗi khi xoá')),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ he_so_cong: 1, tinh_luong: true, trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: KyHieuChamCong) => {
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
    const payload: KyHieuChamCongInput = {
      ky_hieu: vals.ky_hieu,
      ten_ky_hieu: vals.ten_ky_hieu,
      loai: vals.loai,
      he_so_cong: vals.he_so_cong ?? 1,
      tinh_luong: vals.tinh_luong ?? true,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  useHotkey('ctrl+n', openCreate, 'Thêm ký hiệu chấm công mới')
  useHotkey('ctrl+s', handleSave, 'Lưu ký hiệu chấm công', 'Trang hiện tại', modalOpen)

  const columns: ColumnsType<KyHieuChamCong> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: KyHieuChamCong, index: number) => index + 1,
    },
    {
      title: 'Ký hiệu',
      dataIndex: 'ky_hieu',
      width: 100,
      render: (v: string) => <strong>{v}</strong>,
    },
    { title: 'Tên', dataIndex: 'ten_ky_hieu' },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 120,
      render: (v: string) => {
        const info = LOAI_MAP[v]
        return <Tag color={info?.color ?? 'default'}>{info?.label ?? v}</Tag>
      },
    },
    {
      title: 'Hệ số công',
      dataIndex: 'he_so_cong',
      width: 100,
      align: 'right',
      render: (v: number) => Number(v).toFixed(2),
    },
    {
      title: 'Tính lương',
      dataIndex: 'tinh_luong',
      width: 110,
      align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Có' : 'Không'}</Tag>,
    },
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
      render: (_: unknown, r: KyHieuChamCong) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá ký hiệu chấm công này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
            <Title level={4} style={{ margin: 0 }}>Ký hiệu chấm công</Title>
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
        title={editing ? 'Sửa ký hiệu chấm công' : 'Thêm ký hiệu chấm công'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            label="Ký hiệu"
            name="ky_hieu"
            rules={[{ required: true, message: 'Nhập ký hiệu' }]}
          >
            <Input maxLength={10} style={{ width: 120 }} placeholder="VD: P, NP, OT" />
          </Form.Item>
          <Form.Item
            label="Tên"
            name="ten_ky_hieu"
            rules={[{ required: true, message: 'Nhập tên ký hiệu' }]}
          >
            <Input placeholder="VD: Có mặt, Nghỉ phép..." />
          </Form.Item>
          <Form.Item
            label="Loại"
            name="loai"
            rules={[{ required: true, message: 'Chọn loại' }]}
          >
            <Select
              placeholder="Chọn loại"
              options={LOAI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Form.Item>
          <Form.Item label="Hệ số công" name="he_so_cong">
            <InputNumber step={0.1} min={0} max={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Tính lương" name="tinh_luong" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input.TextArea rows={2} placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
