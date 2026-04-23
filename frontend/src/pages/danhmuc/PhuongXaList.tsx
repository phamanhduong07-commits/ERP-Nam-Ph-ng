import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Tag, Popconfirm, message, Typography, Row, Col, Switch, Select,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { phuongXaApi, tinhThanhApi, type PhuongXa } from '../../api/simpleApis'

const { Title } = Typography

export default function PhuongXaList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PhuongXa | null>(null)
  const [filterTinh, setFilterTinh] = useState<number | undefined>(undefined)

  const { data: tinhList = [] } = useQuery({
    queryKey: ['tinh-thanh'],
    queryFn: () => tinhThanhApi.list().then(r => r.data),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['phuong-xa', filterTinh],
    queryFn: () => phuongXaApi.list({ tinh_id: filterTinh }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<PhuongXa, 'id' | 'ten_tinh'>) => phuongXaApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phuong-xa'] })
      closeModal()
      message.success('Đã thêm phường xã')
    },
    onError: () => message.error('Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<PhuongXa, 'id' | 'ten_tinh'>> }) =>
      phuongXaApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phuong-xa'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: () => message.error('Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => phuongXaApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phuong-xa'] })
      message.success('Đã xoá')
    },
    onError: () => message.error('Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: PhuongXa) => {
    setEditing(row)
    form.setFieldsValue({
      ma_phuong: row.ma_phuong,
      ten_phuong: row.ten_phuong,
      tinh_id: row.tinh_id,
      trang_thai: row.trang_thai,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: Omit<PhuongXa, 'id' | 'ten_tinh'> = {
      ma_phuong: vals.ma_phuong,
      ten_phuong: vals.ten_phuong,
      tinh_id: vals.tinh_id ?? null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<PhuongXa> = [
    { title: 'Mã phường', dataIndex: 'ma_phuong', width: 130 },
    { title: 'Tên phường', dataIndex: 'ten_phuong' },
    { title: 'Tỉnh thành', dataIndex: 'ten_tinh', width: 180, render: (v: string | null) => v ?? '—' },
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
      render: (_: unknown, r: PhuongXa) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá phường xã này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
            <Title level={4} style={{ margin: 0 }}>Phường / Xã</Title>
          </Col>
          <Col>
            <Space>
              <Select
                placeholder="Lọc theo tỉnh"
                allowClear
                style={{ width: 200 }}
                value={filterTinh}
                onChange={setFilterTinh}
                showSearch
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={tinhList.map(t => ({ value: t.id, label: t.ten_tinh }))}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm mới
              </Button>
            </Space>
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
        title={editing ? 'Sửa phường xã' : 'Thêm phường xã'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã phường" name="ma_phuong" rules={[{ required: true, message: 'Nhập mã phường xã' }]}>
            <Input placeholder="VD: PX001" />
          </Form.Item>
          <Form.Item label="Tên phường" name="ten_phuong" rules={[{ required: true, message: 'Nhập tên phường xã' }]}>
            <Input placeholder="VD: Phường 1, Xã Bình Chánh..." />
          </Form.Item>
          <Form.Item label="Tỉnh thành" name="tinh_id">
            <Select
              allowClear
              showSearch
              placeholder="Chọn tỉnh thành..."
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={tinhList.map(t => ({ value: t.id, label: t.ten_tinh }))}
            />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
