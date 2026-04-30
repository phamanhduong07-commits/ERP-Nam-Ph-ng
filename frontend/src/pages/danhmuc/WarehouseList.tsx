import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Select, Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { warehousesApi, type Warehouse, type WarehouseCreate } from '../../api/warehouses'
import { warehouseApi } from '../../api/warehouse'

const { Title } = Typography

const LOAI_KHO_OPTIONS = [
  { value: 'nguyen_lieu', label: 'Nguyên liệu' },
  { value: 'thanh_pham', label: 'Thành phẩm' },
  { value: 'ban_thanh_pham', label: 'Bán thành phẩm' },
  { value: 'khac', label: 'Khác' },
]

export default function WarehouseList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Warehouse | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: WarehouseCreate) => warehousesApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['warehouses'] }); closeModal(); message.success('Đã thêm kho') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm kho'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WarehouseCreate> }) => warehousesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['warehouses'] }); closeModal(); message.success('Đã cập nhật kho') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehousesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['warehouses'] }); message.success('Đã xoá kho') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: Warehouse) => {
    setEditing(row)
    form.setFieldsValue({ ...row })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: WarehouseCreate = {
      ma_kho: vals.ma_kho,
      ten_kho: vals.ten_kho,
      loai_kho: vals.loai_kho,
      dia_chi: vals.dia_chi || null,
      phan_xuong_id: vals.phan_xuong_id || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  const columns: ColumnsType<Warehouse> = [
    { title: 'Mã kho', dataIndex: 'ma_kho', width: 100 },
    { title: 'Tên kho', dataIndex: 'ten_kho', ellipsis: true },
    {
      title: 'Loại kho', dataIndex: 'loai_kho', width: 150,
      render: (v: string) => {
        const colorMap: Record<string, string> = { nguyen_lieu: 'orange', thanh_pham: 'green', ban_thanh_pham: 'blue', khac: 'default' }
        const labelMap: Record<string, string> = { nguyen_lieu: 'Nguyên liệu', thanh_pham: 'Thành phẩm', ban_thanh_pham: 'Bán thành phẩm', khac: 'Khác' }
        return <Tag color={colorMap[v] ?? 'default'}>{labelMap[v] ?? v}</Tag>
      },
    },
    {
      title: 'Phân xưởng', dataIndex: 'ten_xuong', width: 150,
      render: (v: string | null) => v ? <Tag color="purple">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Địa chỉ', dataIndex: 'dia_chi', ellipsis: true, render: (v: string | null) => v ?? '—' },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 130, align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang hoạt động' : 'Ngừng'}</Tag>,
    },
    {
      title: '', key: 'act', width: 90,
      render: (_: unknown, r: Warehouse) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá kho này?" onConfirm={() => deleteMut.mutate(r.id)}>
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
          <Col><Title level={4} style={{ margin: 0 }}>Danh mục kho</Title></Col>
          <Col><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm kho</Button></Col>
        </Row>
        <Table rowKey="id" dataSource={data} columns={columns} loading={isLoading} size="small" pagination={{ pageSize: 20 }} />
      </Card>

      <Modal
        title={editing ? 'Sửa kho' : 'Thêm kho mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={560}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Mã kho" name="ma_kho" rules={[{ required: true, message: 'Nhập mã kho' }]}>
                <Input disabled={!!editing} placeholder="VD: KHO01" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="Tên kho" name="ten_kho" rules={[{ required: true, message: 'Nhập tên kho' }]}>
                <Input placeholder="Tên kho" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Loại kho" name="loai_kho" rules={[{ required: true, message: 'Chọn loại kho' }]}>
                <Select placeholder="Chọn loại kho" options={LOAI_KHO_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Phân xưởng" name="phan_xuong_id">
                <Select
                  placeholder="Chọn xưởng (nếu có)"
                  allowClear
                  options={phanXuongs.map((x: any) => ({ value: x.id, label: x.ten_xuong }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Địa chỉ" name="dia_chi">
            <Input placeholder="Địa chỉ kho" />
          </Form.Item>
          <Form.Item label="Trạng thái" name="trang_thai" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
